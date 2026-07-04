from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any

from frameworks.registry import FrameworkRegistry
from parser.models import ParsedQuestionnaire, ParsedSOC2Report
from scoring.engine import ScoringEngine

from .models import BreachRecord, ConfidenceBreakdown, ControlEvidence, RiskBrief
from .planner import AssessmentPlanner
from .retrieval import EvidenceRetriever
from .tools import query_breach_history
from .vultr_client import VultrInferenceClient


class VendorRiskAgent:
    def __init__(
        self,
        registry: FrameworkRegistry | None = None,
        scoring_engine: ScoringEngine | None = None,
        llm: VultrInferenceClient | None = None,
    ) -> None:
        self.registry = registry or FrameworkRegistry.from_file()
        self.llm = llm or VultrInferenceClient()
        self.planner = AssessmentPlanner(self.registry, self.llm)
        self.retriever = EvidenceRetriever(self.registry)
        self.scoring_engine = scoring_engine or ScoringEngine()

    def assess(
        self,
        vendor_name: str,
        soc2: ParsedSOC2Report,
        questionnaire: ParsedQuestionnaire,
        breach_document_text: str | None = None,
    ) -> RiskBrief:
        workflow_trace = [
            "ingest: parsed SOC2 PDF and questionnaire",
            "plan: selected applicable frameworks and control categories",
        ]
        plan = self.planner.plan(soc2, questionnaire)

        soc2_evidence = self.retriever.retrieve_soc2_evidence(plan, soc2)
        workflow_trace.append("retrieve:first_pass: extracted SOC2 control descriptions, test results, and opinions")

        combined_evidence = self.retriever.cross_reference_questionnaire(plan, questionnaire, soc2_evidence)
        workflow_trace.append("retrieve:second_pass: matched questionnaire answers to SOC2 control evidence")

        breach_history = query_breach_history(vendor_name, breach_document_text)
        workflow_trace.append("tool: queried mocked breach history source")

        findings, overall_score, risk_level, confidence = self.scoring_engine.score(
            combined_evidence,
            breach_history,
        )
        workflow_trace.append("reason: applied deterministic scoring and discrepancy rules")

        return RiskBrief(
            vendor_name=vendor_name,
            plan=plan,
            overall_risk_score=overall_score,
            overall_risk_level=risk_level,
            confidence_score=confidence,
            confidence_breakdown=_build_confidence_breakdown(combined_evidence, confidence),
            categories=findings,
            flagged_gaps=_build_flagged_gaps(findings, breach_history),
            follow_up_questions=_build_follow_up_questions(findings),
            breach_history=breach_history,
            auditor_opinion=soc2.auditor_opinion,
            workflow_trace=workflow_trace + ["output: generated structured risk brief"],
        )

    @staticmethod
    def to_dict(brief: RiskBrief) -> dict[str, Any]:
        return _serialize(brief)


def _build_flagged_gaps(findings, breach_history: list[BreachRecord]) -> list[dict[str, Any]]:
    gaps = []
    for finding in findings:
        for gap in finding.gaps:
            gaps.append(
                {
                    "category": finding.category,
                    "gap": gap,
                    "score": finding.score,
                    "citations": [_serialize(citation) for citation in finding.citations],
                }
            )
    for breach in breach_history:
        gaps.append(
            {
                "category": ", ".join(breach.categories),
                "gap": f"Breach history: {breach.summary}",
                "score": None,
                "citations": [{"source": breach.source, "location": str(breach.year), "quote": breach.summary}],
            }
        )
    return gaps


def _build_confidence_breakdown(
    evidence_by_category: dict[str, ControlEvidence],
    confidence_score: float,
) -> ConfidenceBreakdown:
    direct = 0
    partial = 0
    missing = 0
    notes: list[str] = []

    for category, evidence in evidence_by_category.items():
        has_soc2 = bool(evidence.soc2_citations)
        has_questionnaire = bool(evidence.questionnaire_citations)
        if has_soc2 and has_questionnaire:
            direct += 1
        elif has_soc2 or has_questionnaire:
            partial += 1
            notes.append(f"{category}: partial evidence from one source.")
        else:
            missing += 1
            notes.append(f"{category}: no direct evidence found.")

    total = max(1, len(evidence_by_category))
    percentage = round(confidence_score * 100)
    formula = (
        f"{percentage}% = {direct}/{total} control categories verified with direct evidence, "
        f"{partial} with partial evidence, {missing} with no evidence."
    )
    if not notes:
        notes.append("All selected control categories have both SOC2 and questionnaire evidence.")

    return ConfidenceBreakdown(
        score=confidence_score,
        direct_evidence_controls=direct,
        partial_evidence_controls=partial,
        no_evidence_controls=missing,
        total_controls=total,
        formula=formula,
        notes=notes,
    )


def _build_follow_up_questions(findings) -> list[str]:
    questions = []
    for finding in findings:
        if finding.status == "gap":
            questions.append(
                f"Provide current remediation evidence and control owner attestation for {finding.category}."
            )
        elif finding.gaps:
            questions.append(f"Clarify the discrepancy or missing evidence for {finding.category}.")
    if not questions:
        questions.append("Confirm whether any material control changes occurred after the SOC2 audit period.")
    return questions


def _serialize(value: Any) -> Any:
    if is_dataclass(value):
        return {key: _serialize(item) for key, item in asdict(value).items()}
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    if isinstance(value, tuple):
        return [_serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}
    return value
