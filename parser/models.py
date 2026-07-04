from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Citation:
    """Traceable pointer back to source material."""

    source: str
    location: str
    quote: str


@dataclass(frozen=True)
class DocumentChunk:
    source: str
    page: int
    text: str

    @property
    def citation(self) -> Citation:
        return Citation(
            source=self.source,
            location=f"page {self.page}",
            quote=self.text[:500].strip(),
        )


@dataclass(frozen=True)
class ParsedSOC2Report:
    filename: str
    chunks: list[DocumentChunk]
    full_text: str
    auditor_opinion: str | None = None


@dataclass(frozen=True)
class QuestionnaireAnswer:
    control_id: str
    question: str
    answer: str
    evidence: str | None
    citation: Citation
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ParsedQuestionnaire:
    filename: str
    answers: list[QuestionnaireAnswer]
    raw_records: list[dict[str, Any]]
