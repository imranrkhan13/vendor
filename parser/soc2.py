from __future__ import annotations

import io
import re
from collections.abc import Iterable

from pypdf import PdfReader

from .models import DocumentChunk, ParsedSOC2Report


OPINION_PATTERNS = [
    re.compile(r"\b(in our opinion\b.{0,900})", re.IGNORECASE | re.DOTALL),
    re.compile(r"\b(qualified opinion\b.{0,900})", re.IGNORECASE | re.DOTALL),
    re.compile(r"\b(adverse opinion\b.{0,900})", re.IGNORECASE | re.DOTALL),
    re.compile(r"\b(disclaimer of opinion\b.{0,900})", re.IGNORECASE | re.DOTALL),
]


def parse_soc2_pdf(data: bytes, filename: str = "soc2.pdf") -> ParsedSOC2Report:
    """Extract page text from a SOC2 PDF with stable page citations."""

    reader = PdfReader(io.BytesIO(data))
    chunks: list[DocumentChunk] = []
    for index, page in enumerate(reader.pages, start=1):
        text = _normalize_text(page.extract_text() or "")
        if text:
            chunks.extend(_chunk_page(filename, index, text))

    full_text = "\n\n".join(chunk.text for chunk in chunks)
    return ParsedSOC2Report(
        filename=filename,
        chunks=chunks,
        full_text=full_text,
        auditor_opinion=_extract_auditor_opinion(full_text),
    )


def _chunk_page(filename: str, page_number: int, text: str, max_chars: int = 1800) -> Iterable[DocumentChunk]:
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    current = ""
    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            yield DocumentChunk(source=filename, page=page_number, text=current)
        current = paragraph

    if current:
        yield DocumentChunk(source=filename, page=page_number, text=current)


def _normalize_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_auditor_opinion(text: str) -> str | None:
    for pattern in OPINION_PATTERNS:
        match = pattern.search(text)
        if match:
            return re.sub(r"\s+", " ", match.group(1)).strip()
    return None
