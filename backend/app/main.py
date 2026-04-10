import asyncio
import json
import os
import time
import uuid
import aiofiles
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.models import (
    init_db,
    create_incident,
    get_incident,
    list_incidents,
    update_incident,
)
from app.pipeline.orchestrator import run_pipeline

settings = get_settings()

app = FastAPI(title="AEGIS", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.upload_dir, exist_ok=True)


@app.on_event("startup")
async def startup():
    await init_db()
    from app.config import log_config
    log_config()


app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "aegis-backend"}


@app.post("/api/incidents")
async def create_incident_endpoint(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    description: str = Form(...),
    reporter_email: str = Form(...),
    image: Optional[UploadFile] = File(None),
):
    incident_id = str(uuid.uuid4())
    image_path = None

    if image and image.filename:
        ext = os.path.splitext(image.filename)[1].lower()
        if ext not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
            raise HTTPException(status_code=400, detail="Unsupported image format")
        filename = f"{incident_id}{ext}"
        dest = os.path.join(settings.upload_dir, filename)
        content = await image.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image exceeds 10MB limit")
        async with aiofiles.open(dest, "wb") as f:
            await f.write(content)
        image_path = f"/uploads/{filename}"

    now = datetime.now(timezone.utc).isoformat()
    incident_data = {
        "id": incident_id,
        "title": title,
        "description": description,
        "image_path": image_path,
        "reporter_email": reporter_email,
        "created_at": now,
        "updated_at": now,
        "pipeline_log": "[]",
    }

    await create_incident(incident_data)

    # Run pipeline as background task — client polls for progress
    background_tasks.add_task(run_pipeline, incident_id)

    return {"id": incident_id, "status": "processing"}


@app.get("/api/incidents")
async def list_incidents_endpoint():
    return await list_incidents()


@app.get("/api/incidents/{incident_id}")
async def get_incident_endpoint(incident_id: str):
    incident = await get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@app.post("/api/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str):
    incident = await get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    from app.pipeline.notifier import notify_reporter
    from app.config import get_langfuse, get_settings

    t0 = time.monotonic()
    notify_result = notify_reporter(
        incident_id=incident_id,
        title=incident["title"],
        ticket_id=incident.get("ticket_id", ""),
        reporter_email=incident.get("reporter_email", ""),
        summary=incident.get("summary", ""),
    )
    duration = int((time.monotonic() - t0) * 1000)

    now_iso = datetime.now(timezone.utc).isoformat()
    resolution_step = {
        "step": "resolution-notification",
        "status": "success",
        "result": {
            "notified": incident.get("reporter_email"),
            "ticket_id": incident.get("ticket_id"),
            "email": notify_result.get("email"),
            "slack": notify_result.get("slack"),
        },
        "timestamp": now_iso,
        "duration_ms": duration,
    }

    # Append resolution step to existing pipeline_log
    existing_log = incident.get("pipeline_log") or []
    existing_log.append(resolution_step)

    await update_incident(incident_id, {"status": "resolved", "pipeline_log": existing_log})

    # Langfuse: optional trace for resolution event
    langfuse = get_langfuse()
    if langfuse:
        try:
            _s = get_settings()
            trace_id = str(uuid.uuid4())
            trace = langfuse.trace(
                name="incident-resolution",
                id=trace_id,
                input={"incident_id": incident_id, "reporter_email": incident.get("reporter_email")},
                metadata={"incident_id": incident_id},
                tags=["aegis", "resolution"],
            )
            span = trace.span(
                name="resolution-notification",
                input={"reporter_email": incident.get("reporter_email"), "ticket_id": incident.get("ticket_id")},
                start_time=datetime.now(timezone.utc),
            )
            span.end(output=notify_result, end_time=datetime.now(timezone.utc))
            trace.update(output={"status": "resolved"})
            langfuse.flush()
        except Exception:
            pass

    return {
        "status": "resolved",
        "resolution_step": resolution_step,
        "email_notification": notify_result.get("email"),
        "slack_notification": notify_result.get("slack"),
    }


@app.post("/api/test-guardrails")
async def test_guardrails_endpoint(body: dict):
    """Demo endpoint: run the guardrails sanitizer on arbitrary text."""
    from app.guardrails.sanitizer import check_prompt_injection
    text = str(body.get("text", ""))
    return check_prompt_injection(text)


@app.get("/api/debug/config")
async def debug_config():
    """Returns Gemini/integration config state (no secrets — only presence flags)."""
    s = get_settings()
    return {
        "gemini_key_set": bool(s.gemini_api_key),
        "gemini_model": s.gemini_model,
        "langfuse_configured": bool(s.langfuse_public_key and s.langfuse_secret_key),
    }


@app.get("/api/analytics")
async def get_analytics():
    """Aggregate incident statistics for the dashboard."""
    incidents = await list_incidents()
    total = len(incidents)

    by_severity: dict = {}
    by_status: dict = {}
    by_category: dict = {}
    triage_times: list = []
    resolution_hours: list = []

    for inc in incidents:
        sev = inc.get("severity") or "unknown"
        by_severity[sev] = by_severity.get(sev, 0) + 1

        st = inc.get("status") or "unknown"
        by_status[st] = by_status.get(st, 0) + 1

        cat = inc.get("category") or "unknown"
        by_category[cat] = by_category.get(cat, 0) + 1

        for step in (inc.get("pipeline_log") or []):
            if step.get("step") == "triage" and step.get("duration_ms"):
                triage_times.append(step["duration_ms"])

        # Resolution time: created_at → updated_at for resolved incidents
        if inc.get("status") == "resolved":
            try:
                from datetime import datetime
                created = datetime.fromisoformat(inc["created_at"].replace("Z", "+00:00"))
                updated = datetime.fromisoformat(inc["updated_at"].replace("Z", "+00:00"))
                diff_h = (updated - created).total_seconds() / 3600
                if diff_h >= 0:
                    resolution_hours.append(diff_h)
            except Exception:
                pass

    pipeline_complete = sum(1 for inc in incidents if inc.get("status") in ("triaged", "resolved"))
    open_incidents = sum(1 for inc in incidents if inc.get("status") not in ("resolved",))

    recent = sorted(incidents, key=lambda x: x.get("created_at", ""), reverse=True)[:5]
    # Strip pipeline_log from recent to keep payload small
    for r in recent:
        r.pop("pipeline_log", None)

    return {
        "total_incidents": total,
        "by_severity": by_severity,
        "by_status": by_status,
        "by_category": by_category,
        "avg_triage_time_ms": round(sum(triage_times) / len(triage_times), 1) if triage_times else 0,
        "avg_resolution_time_hours": round(sum(resolution_hours) / len(resolution_hours), 2) if resolution_hours else 0,
        "pipeline_success_rate": round(pipeline_complete / total, 3) if total > 0 else 0,
        "open_incidents": open_incidents,
        "recent": recent,
    }


@app.get("/api/incidents/{incident_id}/report")
async def get_incident_report(incident_id: str):
    """Generate a structured incident report for export."""
    from datetime import datetime, timezone
    incident = await get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    pipeline_log = incident.get("pipeline_log") or []

    def _find_step(name):
        return next((s for s in pipeline_log if s.get("step") == name), None)

    triage_step     = _find_step("triage")
    ticket_step     = _find_step("ticket")
    notifier_step   = _find_step("notifier")
    resolution_step = _find_step("resolution-notification")

    return {
        "report_id": f"AEGIS-RPT-{incident_id[:8].upper()}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "incident": {
            "id": incident["id"],
            "title": incident["title"],
            "description": incident["description"],
            "reporter_email": incident.get("reporter_email"),
            "status": incident.get("status"),
            "severity": incident.get("severity"),
            "category": incident.get("category"),
            "created_at": incident.get("created_at"),
            "updated_at": incident.get("updated_at"),
            "image_path": incident.get("image_path"),
        },
        "pipeline_execution": [
            {
                "step": s.get("step"),
                "status": s.get("status"),
                "duration_ms": s.get("duration_ms"),
                "timestamp": s.get("timestamp"),
            }
            for s in pipeline_log if s.get("step") not in ("trace_info",)
        ],
        "triage_result": triage_step.get("result") if triage_step else None,
        "ticket": ticket_step.get("result") if ticket_step else None,
        "notifications_sent": [notifier_step.get("result")] if notifier_step else [],
        "resolution": resolution_step.get("result") if resolution_step else None,
    }


@app.post("/api/incidents/{incident_id}/reprocess")
async def reprocess_incident(incident_id: str, background_tasks: BackgroundTasks):
    incident = await get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    await update_incident(incident_id, {"status": "submitted", "pipeline_log": []})
    background_tasks.add_task(run_pipeline, incident_id)
    return {"id": incident_id, "status": "processing"}
