from __future__ import annotations

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from agent.workflow import VendorRiskAgent
from frameworks.registry import FrameworkRegistry
from parser.questionnaire import parse_questionnaire_file
from parser.soc2 import parse_soc2_pdf


app = FastAPI(
    title="Vendor Risk Assessment Agent",
    description="Agentic SOC2/questionnaire vendor risk assessment API for the Vultr hackathon track.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/frameworks")
def frameworks() -> dict[str, object]:
    registry = FrameworkRegistry.from_file()
    return {
        "frameworks": registry.list_frameworks(),
        "categories": registry.categories(),
        "controls": [
            {
                "framework": control.framework,
                "id": control.id,
                "category": control.category,
                "title": control.title,
                "description": control.description,
            }
            for control in registry.controls
        ],
    }


@app.post("/assess")
async def assess_vendor(
    vendor_name: str = Form(...),
    soc2_report: UploadFile = File(...),
    questionnaire: UploadFile = File(...),
    breach_history: UploadFile | None = File(None),
) -> dict[str, object]:
    soc2_bytes = await soc2_report.read()
    questionnaire_bytes = await questionnaire.read()
    breach_text = None
    if breach_history:
        breach_text = (await breach_history.read()).decode("utf-8", errors="ignore")

    try:
        soc2 = parse_soc2_pdf(soc2_bytes, soc2_report.filename or "soc2.pdf")
        parsed_questionnaire = parse_questionnaire_file(
            questionnaire_bytes,
            questionnaire.filename or "questionnaire.json",
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to parse uploads: {exc}") from exc

    agent = VendorRiskAgent()
    brief = agent.assess(vendor_name, soc2, parsed_questionnaire, breach_text)
    return agent.to_dict(brief)
