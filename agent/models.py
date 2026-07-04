from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from frameworks.registry import FrameworkControl
from parser.models import Citation


@dataclass(frozen=True)
class AssessmentPlan:
    frameworks: list[str]
    categories: list[str]
    rationale: str


@dataclass(frozen=True)
class ControlEvidence:
    category: str
    framework_controls: list[FrameworkControl]
    soc2_summary: str | None
    soc2_test_result: str | None
    soc2_citations: list[Citation]
    questionnaire_answer: str | None
    questionnaire_citations: list[Citation]


@dataclass(frozen=True)
class BreachRecord:
    vendor_name: str
    year: int
    summary: str
    categories: list[str]
    severity: str
    source: str


@dataclass(frozen=True)
class ControlFinding:
    category: str
    status: str
    score: int
    confidence: float
    rationale: str
    citations: list[Citation]
    gaps: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ConfidenceBreakdown:
    score: float
    direct_evidence_controls: int
    partial_evidence_controls: int
    no_evidence_controls: int
    total_controls: int
    formula: str
    notes: list[str]


@dataclass(frozen=True)
class RiskBrief:
    vendor_name: str
    plan: AssessmentPlan
    overall_risk_score: int
    overall_risk_level: str
    confidence_score: float
    confidence_breakdown: ConfidenceBreakdown
    categories: list[ControlFinding]
    flagged_gaps: list[dict[str, Any]]
    follow_up_questions: list[str]
    breach_history: list[BreachRecord]
    auditor_opinion: str | None
    workflow_trace: list[str]
