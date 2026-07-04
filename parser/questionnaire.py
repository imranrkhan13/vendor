from __future__ import annotations

import csv
import io
import json
from typing import Any

from .models import Citation, ParsedQuestionnaire, QuestionnaireAnswer


CONTROL_KEYS = ("control_id", "control", "control id", "category", "domain")
QUESTION_KEYS = ("question", "prompt", "requirement")
ANSWER_KEYS = ("answer", "response", "status")
EVIDENCE_KEYS = ("evidence", "comment", "notes", "details")


def parse_questionnaire_file(data: bytes, filename: str) -> ParsedQuestionnaire:
    """Parse JSON or CSV questionnaire answers into normalized records."""

    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    text = data.decode("utf-8-sig")
    if suffix == "json":
        records = _load_json_records(text)
    elif suffix == "csv":
        records = _load_csv_records(text)
    else:
        try:
            records = _load_json_records(text)
        except json.JSONDecodeError:
            records = _load_csv_records(text)

    answers = [_record_to_answer(record, filename, index) for index, record in enumerate(records, start=1)]
    return ParsedQuestionnaire(filename=filename, answers=answers, raw_records=records)


def _load_json_records(text: str) -> list[dict[str, Any]]:
    payload = json.loads(text)
    if isinstance(payload, dict):
        if isinstance(payload.get("answers"), list):
            payload = payload["answers"]
        elif isinstance(payload.get("questionnaire"), list):
            payload = payload["questionnaire"]
        else:
            payload = [payload]
    if not isinstance(payload, list):
        raise ValueError("Questionnaire JSON must be an object or list of objects.")
    return [dict(item) for item in payload if isinstance(item, dict)]


def _load_csv_records(text: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text))
    return [dict(row) for row in reader]


def _record_to_answer(record: dict[str, Any], filename: str, row_number: int) -> QuestionnaireAnswer:
    normalized = {_normalize_key(key): value for key, value in record.items()}
    control_id = _first_present(normalized, CONTROL_KEYS) or "unmapped"
    question = _first_present(normalized, QUESTION_KEYS) or str(record)
    answer = _first_present(normalized, ANSWER_KEYS) or ""
    evidence = _first_present(normalized, EVIDENCE_KEYS)

    quote = f"{question} -> {answer}"
    if evidence:
        quote = f"{quote} Evidence: {evidence}"

    return QuestionnaireAnswer(
        control_id=str(control_id).strip() or "unmapped",
        question=str(question).strip(),
        answer=str(answer).strip(),
        evidence=str(evidence).strip() if evidence is not None else None,
        citation=Citation(source=filename, location=f"row {row_number}", quote=quote[:500]),
        metadata=record,
    )


def _normalize_key(value: str) -> str:
    return value.strip().lower().replace("_", " ")


def _first_present(record: dict[str, Any], keys: tuple[str, ...]) -> Any | None:
    for key in keys:
        if key in record and record[key] not in (None, ""):
            return record[key]
    return None
