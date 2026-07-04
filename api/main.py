from __future__ import annotations

import asyncio
import json
import os
import re
from collections.abc import AsyncIterator
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests

from agent.tools import query_breach_history
from agent.workflow import VendorRiskAgent
from frameworks.registry import FrameworkRegistry
from parser.questionnaire import parse_questionnaire_file
from parser.soc2 import parse_soc2_pdf


class ChatCitation(BaseModel):
    source: str
    location: str
    quote: str


class ChatRequest(BaseModel):
    question: str
    citations: list[ChatCitation] = []
    vendor_name: str | None = None


class ChatResponse(BaseModel):
    answer: str
    provider: str
    citations: list[ChatCitation]


app = FastAPI(
    title="Vendor Risk Assessment Agent",
    description="Agentic SOC2/questionnaire vendor risk assessment API for the Vultr hackathon track.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/frameworks")
def frameworks() -> dict[str, object]:
    registry = FrameworkRegistry.from_file()
    return {
        "frameworks": registry.list_frameworks(),
        "categories": registry.categories(),
        "controls": [
            {
                "framework": control.framework,
                "id": control.id,
                "category": control.category,
                "title": control.title,
                "description": control.description,
            }
            for control in registry.controls
        ],
    }


@app.post("/chat")
def chat_with_documents(request: ChatRequest) -> ChatResponse:
    """Answer questions against cited assessment evidence without changing assessment logic."""

    selected = _select_relevant_citations(request.question, request.citations)
    provider = _first_configured_provider()
    if provider:
        try:
            answer = _call_document_chat_provider(
                provider=provider,
                question=request.question,
                citations=selected,
                vendor_name=request.vendor_name,
            )
            return ChatResponse(answer=answer, provider=provider[0], citations=selected)
        except Exception:
            # Keep the chat usable during demos even when a provider key is absent, expired, or rate limited.
            pass

    return ChatResponse(
        answer=_local_document_answer(request.question, selected, request.vendor_name),
        provider="local-evidence-fallback",
        citations=selected,
    )


@app.post("/assess")
async def assess_vendor(
    vendor_name: str = Form(...),
    soc2_report: UploadFile = File(...),
    questionnaire: UploadFile = File(...),
    breach_history: UploadFile | None = File(None),
) -> dict[str, object]:
    soc2_bytes = await soc2_report.read()
    questionnaire_bytes = await questionnaire.read()
    breach_text = None
    if breach_history:
        breach_text = (await breach_history.read()).decode("utf-8", errors="ignore")

    try:
        soc2 = parse_soc2_pdf(soc2_bytes, soc2_report.filename or "soc2.pdf")
        parsed_questionnaire = parse_questionnaire_file(
            questionnaire_bytes,
            questionnaire.filename or "questionnaire.json",
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to parse uploads: {exc}") from exc

    agent = VendorRiskAgent()
    brief = agent.assess(vendor_name, soc2, parsed_questionnaire, breach_text)
    return agent.to_dict(brief)


@app.post("/trace")
async def trace_vendor_assessment(
    vendor_name: str = Form(...),
    soc2_report: UploadFile = File(...),
    questionnaire: UploadFile = File(...),
    breach_history: UploadFile | None = File(None),
) -> StreamingResponse:
    soc2_bytes = await soc2_report.read()
    questionnaire_bytes = await questionnaire.read()
    breach_text = None
    if breach_history:
        breach_text = (await breach_history.read()).decode("utf-8", errors="ignore")

    return StreamingResponse(
        _stream_assessment_trace(
            vendor_name=vendor_name,
            soc2_bytes=soc2_bytes,
            soc2_filename=soc2_report.filename or "soc2.pdf",
            questionnaire_bytes=questionnaire_bytes,
            questionnaire_filename=questionnaire.filename or "questionnaire.json",
            breach_text=breach_text,
        ),
        media_type="text/event-stream",
    )


async def _stream_assessment_trace(
    vendor_name: str,
    soc2_bytes: bytes,
    soc2_filename: str,
    questionnaire_bytes: bytes,
    questionnaire_filename: str,
    breach_text: str | None,
) -> AsyncIterator[str]:
    agent = VendorRiskAgent()

    try:
        yield _trace_event("ingest", "Reading uploaded SOC2 report and questionnaire.")
        await asyncio.sleep(0.08)
        soc2 = parse_soc2_pdf(soc2_bytes, soc2_filename)
        parsed_questionnaire = parse_questionnaire_file(questionnaire_bytes, questionnaire_filename)
        yield _trace_event(
            "ingest",
            f"Parsed {len(soc2.chunks)} SOC2 evidence chunks and {len(parsed_questionnaire.answers)} questionnaire answers.",
        )

        await asyncio.sleep(0.08)
        yield _trace_event("plan", "Planning applicable frameworks and control categories.")
        plan = agent.planner.plan(soc2, parsed_questionnaire)
        yield _trace_event(
            "plan",
            f"Found {' + '.join(plan.frameworks)}; selected {len(plan.categories)} control categories.",
            {"frameworks": plan.frameworks, "categories": plan.categories},
        )

        await asyncio.sleep(0.08)
        yield _trace_event("retrieve", "Retrieving SOC2 evidence, test results, and auditor opinion.")
        soc2_evidence = agent.retriever.retrieve_soc2_evidence(plan, soc2)
        soc2_citations = sum(len(evidence.soc2_citations) for evidence in soc2_evidence.values())
        yield _trace_event("retrieve", f"Matched {soc2_citations} SOC2 citations across selected categories.")

        await asyncio.sleep(0.08)
        yield _trace_event("cross_reference", "Cross-referencing questionnaire answers against SOC2 evidence.")
        combined_evidence = agent.retriever.cross_reference_questionnaire(
            plan,
            parsed_questionnaire,
            soc2_evidence,
        )
        questionnaire_hits = sum(
            len(evidence.questionnaire_citations) for evidence in combined_evidence.values()
        )
        yield _trace_event(
            "cross_reference",
            f"Matched {questionnaire_hits} questionnaire answers to framework controls.",
        )

        await asyncio.sleep(0.08)
        yield _trace_event("tool", "Querying mocked breach-history tool.")
        breach_history = query_breach_history(vendor_name, breach_text)
        yield _trace_event("tool", f"Found {len(breach_history)} breach-history record(s).")

        await asyncio.sleep(0.08)
        yield _trace_event("reason", "Computing deterministic risk and confidence scores.")
        findings, overall_score, risk_level, confidence = agent.scoring_engine.score(
            combined_evidence,
            breach_history,
        )
        for finding in findings:
            if finding.gaps:
                yield _trace_event(
                    "reason",
                    f"Flagging gap in {finding.category}: {finding.gaps[0]}",
                    {"category": finding.category, "score": finding.score},
                )

        await asyncio.sleep(0.08)
        brief = agent.assess(vendor_name, soc2, parsed_questionnaire, breach_text)
        yield _trace_event(
            "output",
            f"Generated {risk_level} risk brief with score {overall_score}/100 and {round(confidence * 100)}% confidence.",
        )
        yield _trace_event("complete", "Assessment complete.", {"brief": agent.to_dict(brief)})
    except Exception as exc:
        yield _trace_event("error", f"Unable to complete trace: {exc}")


def _trace_event(step: str, message: str, extra: dict[str, object] | None = None) -> str:
    payload = {"step": step, "message": message}
    if extra:
        payload.update(extra)
    return f"data: {json.dumps(payload)}\n\n"


def _first_configured_provider() -> tuple[str, str] | None:
    for provider, env_name in (
        ("gemini", "GEMINI_API"),
        ("groq", "GROQ_API"),
        ("cohere", "COHERE_API"),
        ("mistral", "MISTRAL_API"),
        ("openrouter", "OPENROUTER_API"),
    ):
        api_key = os.getenv(env_name)
        if api_key:
            return provider, api_key
    return None


def _select_relevant_citations(question: str, citations: list[ChatCitation], limit: int = 5) -> list[ChatCitation]:
    terms = {term.lower() for term in re.findall(r"[a-zA-Z0-9]{3,}", question)}
    scored: list[tuple[int, ChatCitation]] = []
    for citation in citations:
        haystack = f"{citation.source} {citation.location} {citation.quote}".lower()
        score = sum(1 for term in terms if term in haystack)
        scored.append((score, citation))
    scored.sort(key=lambda item: item[0], reverse=True)
    selected = [citation for score, citation in scored if score > 0][:limit]
    return selected or citations[:limit]


def _local_document_answer(
    question: str,
    citations: list[ChatCitation],
    vendor_name: str | None,
) -> str:
    if not citations:
        return (
            "I do not have cited evidence for that question yet. Run an assessment or select a finding "
            "with citations, then ask again."
        )

    evidence_summary = " ".join(citation.quote for citation in citations[:3])
    vendor_prefix = f"For {vendor_name}, " if vendor_name else ""
    return (
        f"{vendor_prefix}the available cited evidence most relevant to your question indicates: "
        f"{evidence_summary[:900]}. Review the citations below for the exact source pages or rows."
    )


def _call_document_chat_provider(
    provider: tuple[str, str],
    question: str,
    citations: list[ChatCitation],
    vendor_name: str | None,
) -> str:
    provider_name, api_key = provider
    evidence = "\n\n".join(
        f"[{idx + 1}] {citation.source} {citation.location}: {citation.quote}"
        for idx, citation in enumerate(citations)
    )
    prompt = (
        "Answer as a compliance document analyst. Use only the evidence below. "
        "If the evidence is insufficient, say what is missing. Include citation numbers.\n\n"
        f"Vendor: {vendor_name or 'Unknown'}\nQuestion: {question}\nEvidence:\n{evidence}"
    )

    if provider_name == "gemini":
        response = requests.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
            params={"key": api_key},
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=20,
        )
        response.raise_for_status()
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]

    if provider_name == "cohere":
        response = requests.post(
            "https://api.cohere.com/v2/chat",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "command-r-plus", "messages": [{"role": "user", "content": prompt}]},
            timeout=20,
        )
        response.raise_for_status()
        return response.json()["message"]["content"][0]["text"]

    if provider_name in {"groq", "mistral", "openrouter"}:
        endpoints: dict[str, tuple[str, str]] = {
            "groq": ("https://api.groq.com/openai/v1/chat/completions", "llama-3.1-8b-instant"),
            "mistral": ("https://api.mistral.ai/v1/chat/completions", "mistral-small-latest"),
            "openrouter": ("https://openrouter.ai/api/v1/chat/completions", "openai/gpt-4o-mini"),
        }
        url, model = endpoints[provider_name]
        response = requests.post(
            url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0},
            timeout=20,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

    raise ValueError(f"Unsupported provider: {provider_name}")
