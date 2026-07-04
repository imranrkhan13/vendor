from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class FrameworkControl:
    framework: str
    id: str
    category: str
    title: str
    description: str
    keywords: tuple[str, ...]


class FrameworkRegistry:
    def __init__(self, controls: list[FrameworkControl]):
        self.controls = controls

    @classmethod
    def from_file(cls, path: Path | None = None) -> "FrameworkRegistry":
        registry_path = path or Path(__file__).with_name("controls.json")
        payload = json.loads(registry_path.read_text(encoding="utf-8"))
        controls: list[FrameworkControl] = []
        for framework, items in payload.items():
            for item in items:
                controls.append(
                    FrameworkControl(
                        framework=framework,
                        id=item["id"],
                        category=item["category"],
                        title=item["title"],
                        description=item["description"],
                        keywords=tuple(item.get("keywords", [])),
                    )
                )
        return cls(controls)

    def list_frameworks(self) -> list[str]:
        return sorted({control.framework for control in self.controls})

    def by_framework(self, frameworks: list[str]) -> list[FrameworkControl]:
        selected = {framework.upper().replace(" ", "") for framework in frameworks}
        return [
            control
            for control in self.controls
            if control.framework.upper().replace(" ", "") in selected
        ]

    def by_category(self, category: str) -> list[FrameworkControl]:
        return [control for control in self.controls if control.category == category]

    def categories(self, frameworks: list[str] | None = None) -> list[str]:
        controls = self.by_framework(frameworks) if frameworks else self.controls
        return sorted({control.category for control in controls})
