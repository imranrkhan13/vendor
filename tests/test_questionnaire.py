from parser.questionnaire import parse_questionnaire_file


def test_parse_json_questionnaire_answers() -> None:
    payload = b"""
    {
      "answers": [
        {
          "control_id": "CC6",
          "question": "Is MFA enforced for administrators?",
          "answer": "MFA is planned",
          "evidence": "Roadmap item"
        }
      ]
    }
    """

    parsed = parse_questionnaire_file(payload, "questionnaire.json")

    assert len(parsed.answers) == 1
    answer = parsed.answers[0]
    assert answer.control_id == "CC6"
    assert answer.citation.source == "questionnaire.json"
    assert answer.citation.location == "row 1"
    assert "MFA is planned" in answer.citation.quote


def test_parse_csv_questionnaire_answers() -> None:
    payload = b"control_id,question,answer,evidence\nCC7,Do you log events?,Yes,SIEM screenshot\n"

    parsed = parse_questionnaire_file(payload, "questionnaire.csv")

    assert parsed.answers[0].control_id == "CC7"
    assert parsed.answers[0].answer == "Yes"
