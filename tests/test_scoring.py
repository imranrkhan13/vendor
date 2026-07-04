from agent.models import ControlEvidence
from parser.models import Citation
from scoring.engine import ScoringEngine


def test_scoring_flags_questionnaire_gap_against_effective_soc2() -> None:
    evidence = ControlEvidence(
        category="access_control",
        framework_controls=[],
        soc2_summary="Access controls operated effectively with no exceptions.",
        soc2_test_result="effective",
        soc2_citations=[Citation(source="soc2.pdf", location="page 12", quote="No exceptions noted.")],
        questionnaire_answer="Is MFA enforced? MFA is planned for next quarter.",
        questionnaire_citations=[
            Citation(source="questionnaire.json", location="row 1", quote="MFA is planned")
        ],
    )

    findings, overall_score, risk_level, confidence = ScoringEngine().score(
        {"access_control": evidence},
        breach_records=[],
    )

    assert overall_score > 35
    assert risk_level in {"medium", "high"}
    assert confidence > 0.5
    assert findings[0].gaps
    assert any("disagree" in gap for gap in findings[0].gaps)
