from __future__ import annotations

from .models import BreachRecord


MOCK_BREACH_DATA = {
    "acme cloud": [
        BreachRecord(
            vendor_name="Acme Cloud",
            year=2024,
            summary="Public incident report described unauthorized access caused by missing MFA on an administrative console.",
            categories=["access_control", "security_monitoring"],
            severity="high",
            source="mock://breach-history/acme-cloud-2024",
        )
    ],
    "example vendor": [
        BreachRecord(
            vendor_name="Example Vendor",
            year=2023,
            summary="Security advisory disclosed delayed customer notification after a data exposure.",
            categories=["breach_notification", "data_protection"],
            severity="medium",
            source="mock://breach-history/example-vendor-2023",
        )
    ],
}


def query_breach_history(vendor_name: str, breach_document_text: str | None = None) -> list[BreachRecord]:
    """Tool-call boundary for breach lookup; mocked for a hackathon-safe demo."""

    normalized = vendor_name.strip().lower()
    records = list(MOCK_BREACH_DATA.get(normalized, []))
    if breach_document_text:
        lowered = breach_document_text.lower()
        severity = "high" if any(term in lowered for term in ("ransomware", "unauthorized", "exfiltration")) else "medium"
        categories = []
        if "mfa" in lowered or "access" in lowered:
            categories.append("access_control")
        if "breach" in lowered or "notification" in lowered:
            categories.append("breach_notification")
        if "personal data" in lowered or "encryption" in lowered:
            categories.append("data_protection")
        records.append(
            BreachRecord(
                vendor_name=vendor_name,
                year=2026,
                summary=breach_document_text[:500],
                categories=categories or ["security_monitoring"],
                severity=severity,
                source="uploaded breach history document",
            )
        )
    return records
