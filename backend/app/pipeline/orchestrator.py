import uuid
import time
import logging
from datetime import datetime, timezone

from app.config import get_settings, get_langfuse
from app.models import get_incident, update_incident

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _make_step(step_name: str, status: str, result=None, duration_ms: int = 0) -> dict:
    return {
        "step": step_name,
        "status": status,
        "result": result,
        "timestamp": _now_iso(),
        "duration_ms": duration_ms,
    }


def _lf_end_span(span, output, status: str, error_msg: str = ""):
    """Safely end a Langfuse span/generation."""
    if span is None:
        return
    try:
        if status == "error":
            span.update(level="ERROR", status_message=error_msg)
        span.end(output=output, end_time=_now())
    except Exception as exc:
        logger.debug(f"Langfuse span end failed: {exc}")


async def run_pipeline(incident_id: str):
    incident = await get_incident(incident_id)
    if not incident:
        return

    settings = get_settings()
    langfuse = get_langfuse()

    # ── Langfuse: open trace ────────────────────────────────────────────────
    trace = None
    trace_url = None
    run_trace_id = str(uuid.uuid4())

    if langfuse:
        try:
            trace = langfuse.trace(
                name="incident-pipeline",
                id=run_trace_id,
                input={
                    "title": incident["title"],
                    "description": incident["description"][:300],
                    "reporter_email": incident["reporter_email"],
                    "has_image": bool(incident.get("image_path")),
                },
                metadata={"incident_id": incident_id},
                tags=["aegis", "pipeline"],
            )
            trace_url = f"{settings.langfuse_host}/trace/{run_trace_id}"
        except Exception as exc:
            logger.warning(f"Langfuse trace creation failed: {exc}")
            trace = None

    # ── Pipeline log bootstrap ──────────────────────────────────────────────
    pipeline_log = []

    if trace_url:
        pipeline_log.append(
            _make_step(
                "trace_info",
                "info",
                {"trace_id": run_trace_id, "trace_url": trace_url},
            )
        )

    async def _save(log):
        await update_incident(incident_id, {"pipeline_log": log})

    await update_incident(incident_id, {"status": "processing"})
    await _save(pipeline_log)

    # ── Step 1: Intake validation ───────────────────────────────────────────
    from app.pipeline.intake import validate_input

    lf_span = None
    if trace:
        try:
            lf_span = trace.span(
                name="input-validation",
                input={
                    "title": incident["title"],
                    "description_len": len(incident["description"]),
                    "email": incident["reporter_email"],
                    "has_image": bool(incident.get("image_path")),
                },
                start_time=_now(),
            )
        except Exception:
            pass

    t0 = time.monotonic()
    try:
        intake_result = validate_input(
            title=incident["title"],
            description=incident["description"],
            reporter_email=incident["reporter_email"],
            image_path=incident.get("image_path"),
        )
        duration = int((time.monotonic() - t0) * 1000)
        step = _make_step("intake", "success", intake_result, duration)
        _lf_end_span(lf_span, intake_result, "success")
    except Exception as exc:
        duration = int((time.monotonic() - t0) * 1000)
        step = _make_step("intake", "error", {"error": str(exc)}, duration)
        _lf_end_span(lf_span, None, "error", str(exc))
        pipeline_log.append(step)
        await _save(pipeline_log)
        await update_incident(incident_id, {"status": "error"})
        if trace:
            try:
                trace.update(output={"error": str(exc)})
                langfuse.flush()
            except Exception:
                pass
        return

    pipeline_log.append(step)
    await _save(pipeline_log)

    # ── Step 2: Guardrails ──────────────────────────────────────────────────
    from app.guardrails.sanitizer import check_prompt_injection

    combined_text = f"{incident['title']}\n{incident['description']}"

    lf_span = None
    if trace:
        try:
            lf_span = trace.span(
                name="security-check",
                input={"text_length": len(combined_text)},
                start_time=_now(),
            )
        except Exception:
            pass

    t0 = time.monotonic()
    try:
        guard_result = check_prompt_injection(combined_text)
        duration = int((time.monotonic() - t0) * 1000)
        step_status = "success" if guard_result["is_safe"] and not guard_result["threats_detected"] \
                      else "warning" if guard_result["is_safe"] else "warning"
        step = _make_step("guardrails", step_status, guard_result, duration)
        _lf_end_span(
            lf_span,
            {"is_safe": guard_result["is_safe"], "risk_score": guard_result.get("risk_score", 0),
             "threats": guard_result["threats_detected"]},
            "success",
        )
    except Exception as exc:
        duration = int((time.monotonic() - t0) * 1000)
        step = _make_step("guardrails", "error", {"error": str(exc)}, duration)
        guard_result = {"is_safe": False, "risk_score": 1.0, "threats_detected": [str(exc)],
                        "sanitized_text": combined_text}
        _lf_end_span(lf_span, None, "error", str(exc))

    pipeline_log.append(step)
    await _save(pipeline_log)

    safe_text = guard_result.get("sanitized_text", combined_text)
    has_threats = not guard_result.get("is_safe", True)

    # ── Step 2.5: Deduplication check ──────────────────────────────────────
    from app.pipeline.deduplicator import check_similar_incidents

    lf_span = None
    if trace:
        try:
            lf_span = trace.span(
                name="deduplication-check",
                input={"title": incident["title"]},
                start_time=_now(),
            )
        except Exception:
            pass

    t0 = time.monotonic()
    try:
        similar_incidents = await check_similar_incidents(
            incident["title"], incident["description"], exclude_id=incident_id
        )
        duration = int((time.monotonic() - t0) * 1000)
        dedup_result = {
            "similar_count": len(similar_incidents),
            "similar_incidents": similar_incidents,
        }
        step = _make_step("deduplication", "success", dedup_result, duration)
        _lf_end_span(lf_span, dedup_result, "success")
    except Exception as exc:
        duration = int((time.monotonic() - t0) * 1000)
        step = _make_step("deduplication", "error", {"error": str(exc)}, duration)
        similar_incidents = []
        dedup_result = {"similar_count": 0, "similar_incidents": []}
        _lf_end_span(lf_span, None, "error", str(exc))

    pipeline_log.append(step)
    await _save(pipeline_log)

    # ── Step 3: Triage (LLM — Langfuse generation) ─────────────────────────
    from app.pipeline.triage import analyze_incident, build_prompt

    # Inject similar incident context into prompt when duplicates found
    enriched_text = safe_text
    if similar_incidents:
        sim_lines = "\n".join(
            f"  - [{s['severity'].upper() if s.get('severity') else 'UNKNOWN'}] {s['title']} "
            f"(similarity: {s['similarity_score']}, status: {s.get('status', '?')})"
            for s in similar_incidents[:3]
        )
        enriched_text = (
            f"{safe_text}\n\n"
            f"[CONTEXT: {len(similar_incidents)} similar incident(s) found in history:\n{sim_lines}\n"
            f"Consider whether this may be a recurrence of an existing issue.]"
        )

    user_prompt = build_prompt(incident["title"], enriched_text)

    lf_generation = None
    if trace:
        try:
            # Determine model name for Langfuse based on provider config
            _s = settings  # already in scope
            if _s.llm_provider.lower() == "openrouter":
                _model_name = _s.openrouter_model
            else:
                _model_name = "gemini-2.0-flash"
            lf_generation = trace.generation(
                name="triage-analysis",
                model=_model_name,
                input=user_prompt,
                metadata={"has_image": bool(incident.get("image_path")),
                          "has_threats": has_threats,
                          "provider": _s.llm_provider},
                start_time=_now(),
            )
        except Exception:
            pass

    t0 = time.monotonic()
    try:
        triage_result = await analyze_incident(
            title=incident["title"],
            description=enriched_text,
            image_path=incident.get("image_path"),
            has_threats=has_threats,
        )
        duration = int((time.monotonic() - t0) * 1000)
        # Extract LLM metadata before saving to DB
        llm_meta = triage_result.pop("_meta", {})
        step = _make_step("triage", "success", triage_result, duration)

        if lf_generation:
            try:
                lf_generation.end(
                    output=llm_meta.get("raw_response", str(triage_result)),
                    usage=llm_meta.get("usage"),
                    metadata={"provider": llm_meta.get("provider")},
                    end_time=_now(),
                )
            except Exception as exc:
                logger.debug(f"Langfuse generation end failed: {exc}")
    except Exception as exc:
        duration = int((time.monotonic() - t0) * 1000)
        step = _make_step("triage", "error", {"error": str(exc)}, duration)
        triage_result = {}
        _lf_end_span(lf_generation, None, "error", str(exc))

    pipeline_log.append(step)
    await _save(pipeline_log)

    # Persist triage fields
    triage_fields = {}
    if triage_result.get("severity"):
        triage_fields["severity"] = triage_result["severity"]
    if triage_result.get("category"):
        triage_fields["category"] = triage_result["category"]
    if triage_result.get("technical_summary"):
        triage_fields["summary"] = triage_result["technical_summary"]
    if triage_fields:
        await update_incident(incident_id, triage_fields)

    # ── Step 4: Ticket creation ─────────────────────────────────────────────
    from app.pipeline.ticket import create_ticket

    lf_span = None
    if trace:
        try:
            lf_span = trace.span(
                name="ticket-creation",
                input={"severity": triage_result.get("severity"), "category": triage_result.get("category")},
                start_time=_now(),
            )
        except Exception:
            pass

    t0 = time.monotonic()
    try:
        ticket_result = create_ticket(
            title=incident["title"],
            description=incident["description"],
            severity=triage_result.get("severity", "medium"),
            category=triage_result.get("category", "other"),
        )
        duration = int((time.monotonic() - t0) * 1000)
        step = _make_step("ticket", "success", ticket_result, duration)
        _lf_end_span(lf_span, ticket_result, "success")
    except Exception as exc:
        duration = int((time.monotonic() - t0) * 1000)
        step = _make_step("ticket", "error", {"error": str(exc)}, duration)
        ticket_result = {}
        _lf_end_span(lf_span, None, "error", str(exc))

    pipeline_log.append(step)
    await _save(pipeline_log)

    if ticket_result.get("ticket_id"):
        await update_incident(incident_id, {"ticket_id": ticket_result["ticket_id"]})

    # ── Step 5: Notifications ───────────────────────────────────────────────
    from app.pipeline.notifier import notify_team

    lf_span = None
    if trace:
        try:
            lf_span = trace.span(
                name="team-notification",
                input={
                    "ticket_id": ticket_result.get("ticket_id"),
                    "severity": triage_result.get("severity"),
                    "reporter_email": incident.get("reporter_email"),
                },
                start_time=_now(),
            )
        except Exception:
            pass

    t0 = time.monotonic()
    try:
        notify_result = notify_team(
            incident_id=incident_id,
            title=incident["title"],
            severity=triage_result.get("severity", "medium"),
            summary=triage_result.get("technical_summary", ""),
            ticket_id=ticket_result.get("ticket_id", ""),
            reporter_email=incident.get("reporter_email", ""),
        )
        duration = int((time.monotonic() - t0) * 1000)
        step = _make_step("notifier", "success", notify_result, duration)
        _lf_end_span(lf_span, notify_result, "success")
    except Exception as exc:
        duration = int((time.monotonic() - t0) * 1000)
        step = _make_step("notifier", "error", {"error": str(exc)}, duration)
        notify_result = {}
        _lf_end_span(lf_span, None, "error", str(exc))

    pipeline_log.append(step)
    await _save(pipeline_log)

    final_status = "triaged" if triage_result.get("severity") else "error"
    await update_incident(incident_id, {"status": final_status})

    # ── Langfuse: close trace ────────────────────────────────────────────────
    if trace:
        try:
            trace.update(
                output={
                    "status": final_status,
                    "severity": triage_result.get("severity"),
                    "category": triage_result.get("category"),
                    "ticket_id": ticket_result.get("ticket_id"),
                },
            )
            langfuse.flush()
        except Exception as exc:
            logger.debug(f"Langfuse trace close failed: {exc}")
