from __future__ import annotations

from agent.models import BreachRecord, ControlEvidence, ControlFinding


POSITIVE_TERMS = ("yes", "implemented", "enabled", "annual", "quarterly", "monitored", "encrypted")
NEGATIVE_TERMS = ("no", "not implemented", "planned", "partial", "none", "n/a", "gap", "disabled")


class ScoringEngine:
    """Auditable scoring rules; no LLM-generated numeric output is accepted."""

    def score(
        self,
        evidence_by_category: dict[str, ControlEvidence],
        breach_records: list[BreachRecord],
    ) -> tuple[list[ControlFinding], int, str, float]:
        findings = [
            self._score_category(category, evidence, breach_records)
            for category, evidence in evidence_by_category.items()
        ]
        if not findings:
            return [], 100, "unknown", 0.0

        overall_score = round(sum(finding.score for finding in findings) / len(findings))
        overall_confidence = round(sum(finding.confidence for finding in findings) / len(findings), 2)
        return findings, overall_score, self._risk_level(overall_score), overall_confidence

    def _score_category(
        self,
        category: str,
        evidence: ControlEvidence,
        breach_records: list[BreachRecord],
    ) -> ControlFinding:
        score = 50
        gaps: list[str] = []
        confidence_factors = 0

        if evidence.soc2_citations:
            score -= 18
            confidence_factors += 1
        else:
            gaps.append("No SOC2 evidence found for this category.")
            score += 18

        if evidence.soc2_test_result == "effective":
            score -= 22
            confidence_factors += 1
        elif evidence.soc2_test_result == "exception":
            score += 28
            gaps.append("SOC2 test result indicates an exception or deficiency.")
            confidence_factors += 1
        elif evidence.soc2_test_result == "described":
            score -= 5

        questionnaire_text = (evidence.questionnaire_answer or "").lower()
        if questionnaire_text:
            confidence_factors += 1
            if any(term in questionnaire_text for term in NEGATIVE_TERMS):
                score += 24
                gaps.append("Questionnaire answer is negative, partial, or inconsistent.")
            elif any(term in questionnaire_text for term in POSITIVE_TERMS):
                score -= 14
        else:
            score += 12
            gaps.append("No matching questionnaire answer found.")

        conflicting_breaches = [record for record in breach_records if category in record.categories]
        if conflicting_breaches:
            score += 18 if any(record.severity == "high" for record in conflicting_breaches) else 10
            gaps.append("Breach history conflicts with stated or audited control posture.")
            confidence_factors += 1

        if evidence.soc2_test_result == "effective" and any(term in questionnaire_text for term in NEGATIVE_TERMS):
            score += 16
            gaps.append("SOC2 evidence and questionnaire response disagree.")

        bounded_score = max(0, min(100, score))
        confidence = min(1.0, round(0.25 + (confidence_factors * 0.18), 2))
        status = "pass" if bounded_score <= 35 and not gaps else "review" if bounded_score <= 65 else "gap"
        rationale = self._rationale(evidence, conflicting_breaches, gaps)

        return ControlFinding(
            category=category,
            status=status,
            score=bounded_score,
            confidence=confidence,
            rationale=rationale,
            citations=evidence.soc2_citations + evidence.questionnaire_citations,
            gaps=gaps,
        )

    @staticmethod
    def _risk_level(score: int) -> str:
        if score <= 35:
            return "low"
        if score <= 65:
            return "medium"
        return "high"

    @staticmethod
    def _rationale(
        evidence: ControlEvidence,
        breaches: list[BreachRecord],
        gaps: list[str],
    ) -> str:
        parts = []
        if evidence.soc2_test_result:
            parts.append(f"SOC2 test result: {evidence.soc2_test_result}.")
        if evidence.questionnaire_answer:
            parts.append("Questionnaire answer was matched to the same category.")
        if breaches:
            parts.append(f"{len(breaches)} breach record(s) affect this category.")
        if gaps:
            parts.append("Gaps: " + " ".join(gaps))
        return " ".join(parts) or "Insufficient evidence to assess this category."
