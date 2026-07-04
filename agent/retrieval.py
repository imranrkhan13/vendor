from __future__ import annotations

import re

from frameworks.registry import FrameworkRegistry
from parser.models import ParsedQuestionnaire, ParsedSOC2Report, QuestionnaireAnswer

from .models import AssessmentPlan, ControlEvidence


SUCCESS_TERMS = ("no exceptions", "operating effectively", "suitably designed", "implemented")
FAILURE_TERMS = ("exception noted", "exceptions noted", "not operating effectively", "deficiency", "failed")


class EvidenceRetriever:
    def __init__(self, registry: FrameworkRegistry):
        self.registry = registry

    def retrieve_soc2_evidence(self, plan: AssessmentPlan, soc2: ParsedSOC2Report) -> dict[str, ControlEvidence]:
        evidence: dict[str, ControlEvidence] = {}
        for category in plan.categories:
            controls = self.registry.by_category(category)
            keywords = {word.lower() for control in controls for word in control.keywords}
            scored_chunks = []
            for chunk in soc2.chunks:
                score = sum(1 for keyword in keywords if keyword in chunk.text.lower())
                if score:
                    scored_chunks.append((score, chunk))
            scored_chunks.sort(key=lambda item: item[0], reverse=True)
            selected = [chunk for _, chunk in scored_chunks[:3]]
            joined = " ".join(chunk.text for chunk in selected)
            evidence[category] = ControlEvidence(
                category=category,
                framework_controls=controls,
                soc2_summary=_summarize(joined) if joined else None,
                soc2_test_result=_extract_test_result(joined),
                soc2_citations=[chunk.citation for chunk in selected],
                questionnaire_answer=None,
                questionnaire_citations=[],
            )
        return evidence

    def cross_reference_questionnaire(
        self,
        plan: AssessmentPlan,
        questionnaire: ParsedQuestionnaire,
        soc2_evidence: dict[str, ControlEvidence],
    ) -> dict[str, ControlEvidence]:
        answers_by_category = {
            category: _match_answers(category, controls, questionnaire.answers)
            for category, controls in (
                (category, self.registry.by_category(category)) for category in plan.categories
            )
        }

        combined: dict[str, ControlEvidence] = {}
        for category, evidence in soc2_evidence.items():
            answers = answers_by_category.get(category, [])
            combined[category] = ControlEvidence(
                category=category,
                framework_controls=evidence.framework_controls,
                soc2_summary=evidence.soc2_summary,
                soc2_test_result=evidence.soc2_test_result,
                soc2_citations=evidence.soc2_citations,
                questionnaire_answer=_combine_answers(answers),
                questionnaire_citations=[answer.citation for answer in answers[:3]],
            )
        return combined


def _match_answers(
    category: str,
    controls: list,
    answers: list[QuestionnaireAnswer],
) -> list[QuestionnaireAnswer]:
    keywords = {category.replace("_", " ")}
    for control in controls:
        keywords.add(control.id.lower())
        keywords.add(control.category.replace("_", " "))
        keywords.update(keyword.lower() for keyword in control.keywords)

    matched = []
    for answer in answers:
        haystack = f"{answer.control_id} {answer.question} {answer.answer} {answer.evidence or ''}".lower()
        if any(keyword in haystack for keyword in keywords):
            matched.append(answer)
    return matched


def _combine_answers(answers: list[QuestionnaireAnswer]) -> str | None:
    if not answers:
        return None
    return " | ".join(f"{answer.question}: {answer.answer}" for answer in answers[:5])


def _summarize(text: str, max_chars: int = 700) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_chars]


def _extract_test_result(text: str) -> str | None:
    lower = text.lower()
    if any(term in lower for term in FAILURE_TERMS):
        return "exception"
    if any(term in lower for term in SUCCESS_TERMS):
        return "effective"
    if text:
        return "described"
    return None
