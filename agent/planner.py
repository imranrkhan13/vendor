from __future__ import annotations

from frameworks.registry import FrameworkRegistry
from parser.models import ParsedQuestionnaire, ParsedSOC2Report

from .models import AssessmentPlan
from .vultr_client import VultrInferenceClient


class AssessmentPlanner:
    def __init__(self, registry: FrameworkRegistry, llm: VultrInferenceClient | None = None):
        self.registry = registry
        self.llm = llm or VultrInferenceClient()

    def plan(self, soc2: ParsedSOC2Report, questionnaire: ParsedQuestionnaire) -> AssessmentPlan:
        text = f"{soc2.full_text[:6000]}\n\n{questionnaire.raw_records[:10]}".lower()
        frameworks = ["SOC2"]
        if any(term in text for term in ("iso 27001", "iso27001", "isms", "annex a")):
            frameworks.append("ISO27001")
        if any(term in text for term in ("gdpr", "personal data", "processor", "controller")):
            frameworks.append("GDPR")

        candidate_controls = self.registry.by_framework(frameworks)
        categories = sorted(
            {
                control.category
                for control in candidate_controls
                if any(keyword.lower() in text for keyword in control.keywords)
            }
        )
        if not categories:
            categories = self.registry.categories(frameworks)

        if self.llm.enabled:
            try:
                self.llm.complete_json(
                    "Select applicable frameworks and control categories from the supplied SOC2 and questionnaire context.",
                    {"frameworks": frameworks, "categories": categories},
                )
            except Exception:
                # Inference is advisory only; deterministic planning must still succeed
                # even if the Vultr endpoint is unreachable or the API key is rejected.
                pass

        return AssessmentPlan(
            frameworks=frameworks,
            categories=categories,
            rationale=(
                "SOC2 is required by the uploaded report. ISO 27001 and GDPR are included when the "
                "source material references those obligations; categories are selected by registered "
                "control keywords found in the evidence."
            ),
        )
