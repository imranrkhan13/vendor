from __future__ import annotations

import os
from typing import Any

import requests


class VultrInferenceClient:
    """Small adapter for Vultr Serverless Inference document-understanding calls."""

    def __init__(
        self,
        api_key: str | None = None,
        endpoint: str | None = None,
        model: str = "VultronRetriever",
        timeout_seconds: int = 30,
    ) -> None:
        self.api_key = api_key or os.getenv("VULTR_API_KEY")
        self.endpoint = endpoint or os.getenv("VULTR_INFERENCE_ENDPOINT")
        self.model = model
        self.timeout_seconds = timeout_seconds

    @property
    def enabled(self) -> bool:
        return bool(self.api_key and self.endpoint)

    def complete_json(self, prompt: str, schema_hint: dict[str, Any]) -> dict[str, Any]:
        if not self.enabled:
            return {"enabled": False, "reason": "Vultr inference credentials not configured."}

        response = requests.post(
            self.endpoint,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": "Return compact JSON only. Do not assign risk scores.",
                    },
                    {
                        "role": "user",
                        "content": f"{prompt}\n\nSchema hint: {schema_hint}",
                    },
                ],
                "temperature": 0,
            },
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        if isinstance(payload, dict) and isinstance(payload.get("choices"), list):
            content = payload["choices"][0].get("message", {}).get("content", "{}")
            return {"enabled": True, "raw": content}
        return {"enabled": True, "raw": payload}
