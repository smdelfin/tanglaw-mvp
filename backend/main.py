"""Tanglaw MVP API: forecast-to-action planning with Gemini and Firestore."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from enum import Enum
from typing import Literal

import firebase_admin
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import credentials, firestore
from google import genai
from google.genai import types
from pydantic import BaseModel, Field, model_validator


class RiskLevel(str, Enum):
    low = "low"
    moderate = "moderate"
    high = "high"
    severe = "severe"


class BarangayRisk(BaseModel):
    psgc_code: str = Field(min_length=1, description="Official or prototype PSGC identifier")
    name: str = Field(min_length=1)
    flood_probability: float = Field(ge=0, le=1)
    risk_level: RiskLevel
    population: int = Field(ge=0)
    vulnerable_people: int = Field(ge=0)
    evidence_ids: list[str] = Field(min_length=1)


class Asset(BaseModel):
    asset_id: str
    name: str
    barangay_psgc_code: str
    kind: Literal["parish_hall", "boat", "food_pack", "water", "volunteer"]
    quantity: int = Field(ge=0)


class ForecastPlanRequest(BaseModel):
    storm_name: str = Field(min_length=1, examples=["Kristine"])
    forecast_valid_at: datetime
    hours_to_landfall: int = Field(ge=0, le=120)
    scenario: str = Field(default="baseline", description="For example: baseline or landfall shifts 80 km south")
    barangays: list[BarangayRisk] = Field(min_length=1)
    assets: list[Asset] = Field(default_factory=list)

    @model_validator(mode="after")
    def evidence_must_be_unique_enough(self):
        if not any(b.evidence_ids for b in self.barangays):
            raise ValueError("At least one evidence ID is required")
        return self


class PlanAction(BaseModel):
    order: int = Field(ge=1)
    action_type: Literal["alert", "pre_position", "route_check"]
    barangay_psgc_code: str
    instruction: str
    assigned_asset_ids: list[str] = Field(default_factory=list)
    quantity: int = Field(ge=0)
    evidence_ids: list[str] = Field(min_length=1)


class ScenarioPlan(BaseModel):
    scenario_name: str
    changes_from_baseline: list[str]
    actions: list[PlanAction]


class ActionPlan(BaseModel):
    summary: str
    actions: list[PlanAction] = Field(min_length=1)
    plan_b: ScenarioPlan
    plan_c: ScenarioPlan
    alert_drafts: list[str] = Field(description="Short Taglish or Bisaya draft alerts")
    coordinator_notes: list[str]


class StoredPlan(ActionPlan):
    id: str
    storm_name: str
    scenario: str
    status: Literal["draft", "approved"]
    created_at: datetime
    approved_at: datetime | None = None


class ApprovalRequest(BaseModel):
    approved_by: str = Field(min_length=1)


def init_firebase():
    """Use ADC on Cloud Run; optionally accept a local service-account JSON path."""
    if not firebase_admin._apps:
        service_account = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if service_account and os.path.isfile(service_account):
            firebase_admin.initialize_app(credentials.Certificate(service_account))
        else:
            firebase_admin.initialize_app()
    return firestore.client()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


app = FastAPI(title="Tanglaw API", version="0.1.0")
allowed_origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

_db = None


def db():
    global _db
    if _db is None:
        _db = init_firebase()
    return _db


def gemini_client() -> genai.Client:
    project = os.getenv("GOOGLE_CLOUD_PROJECT")
    location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    if not project:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT is required")
    return genai.Client(vertexai=True, project=project, location=location)


def build_prompt(payload: ForecastPlanRequest) -> str:
    """Keep the model grounded only in supplied risk, asset, and evidence records."""
    return f"""
You are Tanglaw's planning agent for a diocesan disaster coordinator in the Philippines.
Draft only. A human coordinator must approve every dispatch.
Use only the supplied data. Never invent barangays, quantities, routes, assets, or evidence IDs.
Prioritize severe/high risk, vulnerable people, feasible asset quantities, then moderate risk.
Every action must cite one or more supplied evidence IDs.
If route geometry is absent, create a route_check action rather than claiming a route is safe.
Create baseline actions plus plan B and plan C for plausible track changes. Keep alert drafts concise.

INPUT JSON:
{payload.model_dump_json(indent=2)}
""".strip()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "tanglaw-api"}


@app.post("/api/plans", response_model=StoredPlan, status_code=201)
def create_plan(payload: ForecastPlanRequest):
    try:
        response = gemini_client().models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=build_prompt(payload),
            config=types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json",
                response_schema=ActionPlan,
            ),
        )
        plan = response.parsed if isinstance(response.parsed, ActionPlan) else ActionPlan.model_validate_json(response.text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Vertex AI plan generation failed: {exc}") from exc

    now = utcnow()
    document = {
        **plan.model_dump(mode="json"),
        "storm_name": payload.storm_name,
        "scenario": payload.scenario,
        "status": "draft",
        "created_at": now,
        "approved_at": None,
        "request_snapshot": payload.model_dump(mode="json"),
    }
    ref = db().collection("plans").document()
    ref.set(document)
    return StoredPlan(id=ref.id, **{k: v for k, v in document.items() if k != "request_snapshot"})


@app.get("/api/plans", response_model=list[StoredPlan])
def list_plans(limit: int = Query(default=20, ge=1, le=100)):
    docs = db().collection("plans").order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit).stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        data.pop("request_snapshot", None)
        results.append(StoredPlan(id=doc.id, **data))
    return results


@app.patch("/api/plans/{plan_id}/approve", response_model=StoredPlan)
def approve_plan(plan_id: str, payload: ApprovalRequest):
    ref = db().collection("plans").document(plan_id)
    snapshot = ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Plan not found")
    now = utcnow()
    ref.update({"status": "approved", "approved_at": now, "approved_by": payload.approved_by})
    data = ref.get().to_dict()
    data.pop("request_snapshot", None)
    data.pop("approved_by", None)
    return StoredPlan(id=plan_id, **data)
