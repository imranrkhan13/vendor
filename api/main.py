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
    provider_errors: list[str] = []
    for provider in _configured_providers():
        try:
            answer = _call_document_chat_provider(
                provider=provider,
                question=request.question,
                citations=selected,
                vendor_name=request.vendor_name,
            )
            return ChatResponse(answer=answer, provider=provider[0], citations=selected)
        except Exception as exc:
            # Keep trying other configured providers before using the local evidence fallback.
            provider_errors.append(f"{provider[0]}: {exc}")

    return ChatResponse(
        answer=_local_document_answer(request.question, selected, request.vendor_name, provider_errors),
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


def _configured_providers() -> list[tuple[str, str]]:
    providers: list[tuple[str, str]] = []
    for provider, env_name in (
        ("gemini", "GEMINI_API"),
        ("groq", "GROQ_API"),
        ("cohere", "COHERE_API"),
        ("mistral", "MISTRAL_API"),
        ("openrouter", "OPENROUTER_API"),
    ):
        api_key = os.getenv(env_name)
        if api_key:
            providers.append((provider, api_key))
    return providers


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
    provider_errors: list[str] | None = None,
) -> str:
    if not citations:
        return (
            "Short answer: I do not have enough cited evidence to answer that yet.\n\n"
            "What to do next: run an assessment or select a finding with citations, then ask again. "
            "I need source excerpts before I can give a trustworthy answer."
        )

    question_lower = question.lower()
    vendor_label = vendor_name or "this vendor"
    snippets = [_short_quote(citation.quote) for citation in citations[:4]]
    source_summary = "\n".join(
        f"- [{idx + 1}] {citation.source}, {citation.location}: {snippets[idx]}"
        for idx, citation in enumerate(citations[:4])
    )

    if any(term in question_lower for term in ("safe", "trust", "approve", "work with")):
        short_answer = (
            f"Short answer: I would not give {vendor_label} a blanket approval from these excerpts alone. "
            "The evidence shows some security controls, but the right decision is conditional approval "
            "pending follow-up on any missing or weak areas."
        )
        why = (
            "Why: vendor approval is not about whether a document sounds good. It is about whether "
            "the cited audit evidence proves the claims that matter for your use case."
        )
        next_step = (
            "Recommended next step: ask the vendor for evidence that directly maps to your highest-risk "
            "requirements, especially identity access, incident response, encryption, backups, and any "
            "gap already flagged in the assessment."
        )
    elif any(term in question_lower for term in ("match", "contradict", "questionnaire")):
        short_answer = (
            "Short answer: partially, but I would not treat the questionnaire as fully verified yet. "
            "The cited evidence supports some claims, but the reviewer should confirm that each important "
            "questionnaire answer has matching audit evidence."
        )
        why = (
            "Why: a questionnaire is self-reported. A SOC 2 report is independent audit evidence. "
            "The safest workflow is to compare the claim against the audit and flag anything that is "
            "unsupported or inconsistent."
        )
        next_step = (
            "Recommended next step: ask for a control-by-control mapping between the questionnaire answers "
            "and SOC 2 sections, then review any answers that only have policy language but no test result."
        )
    elif any(term in question_lower for term in ("mfa", "multi-factor", "sso", "single sign")):
        found = any(re.search(r"\b(mfa|multi[- ]?factor|sso|single sign)\b", citation.quote, re.I) for citation in citations)
        short_answer = (
            "Short answer: I found relevant identity/access evidence in the selected citations."
            if found
            else "Short answer: I do not see a clear MFA or SSO statement in the selected citations."
        )
        why = (
            "Why: MFA and SSO matter because weak identity controls are one of the fastest ways a vendor "
            "can become a security risk."
        )
        next_step = (
            "Recommended next step: ask the vendor for current MFA enforcement evidence for admins, SSO "
            "support details, and the most recent access review."
        )
    elif any(term in question_lower for term in ("summarize", "summary", "explain")):
        short_answer = (
            f"Short answer: {vendor_label} has cited evidence describing parts of its security program, "
            "including operational controls and supporting infrastructure. This is useful, but it should "
            "still be reviewed against the specific risks your company cares about."
        )
        why = (
            "Why: a summary is only valuable if it tells you what decision to make. These excerpts suggest "
            "there is security process evidence, but they do not automatically prove every control is strong."
        )
        next_step = (
            "Recommended next step: review the risk brief categories, then ask targeted follow-up questions "
            "for any missing evidence."
        )
    else:
        short_answer = (
            f"Short answer: based on the cited excerpts, {vendor_label} has some relevant security evidence, "
            "but I would treat this as a review item rather than an automatic approval."
        )
        why = (
            "Why: the answer should be based on evidence, not vendor claims. The cited excerpts show what "
            "was found, but any missing control evidence should be followed up."
        )
        next_step = (
            "Recommended next step: use the citations below to verify the source text, then ask the vendor "
            "for proof covering any unresolved control area."
        )

    provider_note = ""
    if provider_errors:
        provider_note = (
            "\n\nNote: I used the local evidence reviewer because configured AI providers were unavailable "
            "or rejected the request. The answer is still grounded only in the citations below."
        )

    return (
        f"{short_answer}\n\n"
        f"{why}\n\n"
        f"Evidence I used:\n{source_summary}\n\n"
        f"{next_step}"
        f"{provider_note}"
    )


def _short_quote(text: str, max_chars: int = 220) -> str:
    normalized = re.sub(r"\s+", " ", text).strip()
    if len(normalized) <= max_chars:
        return normalized
    clipped = normalized[:max_chars].rsplit(" ", 1)[0]
    return f"{clipped}..."


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
        "You are a senior vendor security reviewer advising a procurement, legal, and security team. "
        "Answer like a helpful human advisor, not like a search engine. Use ONLY the evidence below. "
        "Do not paste long raw excerpts. Do not overstate certainty. If evidence is missing, say so.\n\n"
        "Format exactly like this:\n"
        "Short answer: <direct answer in 1-2 sentences>\n\n"
        "Why it matters: <business/security meaning in plain English>\n\n"
        "Evidence used: <2-4 concise bullets with citation numbers>\n\n"
        "What is still unclear: <missing evidence or uncertainty>\n\n"
        "Recommended next step: <actionable vendor/security/procurement step>\n\n"
        "Tone: clear, concise, professional, practical. Include citation numbers like [1], [2].\n\n"
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
