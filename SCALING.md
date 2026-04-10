# AEGIS — Scaling Strategy

## Current Architecture Profile

AEGIS is designed as a containerized, stateless application that can be horizontally scaled with minimal configuration changes. The current single-instance deployment serves as the baseline for the scaling analysis below.

### Current Capacity (Single Instance)

| Metric | Value |
|--------|-------|
| Throughput | ~20 concurrent incidents/minute |
| Triage Latency | 2–5 seconds (LLM-bound) |
| Storage Limit | ~100K incidents before SQLite degrades |
| Memory Footprint | ~256 MB per backend instance |
| Image Upload Limit | 10 MB per incident |

---

## Scaling Dimensions

### 1. Horizontal Scaling — Backend Replicas

The FastAPI backend is stateless: all persistent state lives in SQLite (or a future database) and all configuration comes from environment variables. Scaling horizontally requires only a load balancer:

```yaml
# docker-compose.yml (scaled)
services:
  backend:
    deploy:
      replicas: 4
  
  loadbalancer:
    image: nginx:alpine
    # Round-robin across backend:8000 replicas
```

**Database Migration Path:**

| Stage | Database | Reason |
|-------|----------|--------|
| Current (hackathon) | SQLite + aiosqlite | Zero infrastructure overhead |
| Growth (1K+ incidents/day) | PostgreSQL + asyncpg | Remove single-writer bottleneck |
| Scale (10K+ incidents/day) | PostgreSQL + pgBouncer | Connection pooling under load |

The `models.py` data layer abstracts all DB calls — migrating from SQLite to PostgreSQL requires changing only the connection string and replacing `aiosqlite` with `asyncpg`. All query logic remains identical.

---

### 2. Asynchronous Pipeline Processing

The current architecture runs the pipeline synchronously as a FastAPI `BackgroundTask`. Clients poll for status every second. This already decouples the HTTP layer from pipeline execution.

At scale, the background task queue should move to a dedicated message broker:

```
[API Server]  →  [Redis Queue]  →  [Pipeline Workers]
                                   ├── Worker 1 (triage)
                                   ├── Worker 2 (triage)
                                   └── Worker N (triage)
```

**Implementation path:**
- Replace `BackgroundTasks` with [ARQ](https://arq-docs.helpmanual.io/) (async Redis queue, minimal overhead)
- Or [Celery](https://docs.celeryq.dev/) for more complex routing requirements
- The polling-based frontend already supports this — no UI changes required

---

### 3. LLM Provider Scaling

The Gemini API call is the primary latency bottleneck (2–5 seconds per incident). Mitigation strategies:

**Rate Limit Management:**

| Tier | RPM Limit | Mitigation |
|------|----------|------------|
| Free | ~15 RPM | Request queuing + exponential backoff |
| Paid | ~1,000 RPM | Sufficient for most production workloads |
| Enterprise | Custom | Dedicated quota per project |

**Additional strategies:**
- **Semantic caching:** Cache triage results for identical or near-identical incidents using the deduplication Jaccard score. If similarity > 0.9, reuse the previous triage without an LLM call.
- **Provider failover:** The architecture is designed for provider fallback — rule-based triage activates if the LLM is unavailable, ensuring zero pipeline failures.
- **Prompt optimization:** Current prompt is ~200 tokens. Keeping it concise reduces both latency and cost.

---

### 4. Storage Scaling

**File uploads (screenshots):**
- Current: Local Docker volume (`./data/uploads`)
- Scale target: Object storage (AWS S3, GCS, Cloudflare R2)
- Migration: Replace the `aiofiles` write path with an `aioboto3` upload — one function change in `main.py`

**Incident data:**
- Current: SQLite at `./data/db/aegis.db`
- Scale target: PostgreSQL (managed, e.g., Supabase, Neon, RDS)
- The `pipeline_log` JSON column maps directly to PostgreSQL `JSONB` for efficient querying

---

### 5. Observability at Scale

Langfuse handles high-throughput tracing natively with async, non-blocking trace submission:

- **Trace sampling:** At >500 RPM, configure 10–20% sampling to reduce Langfuse ingestion costs while preserving statistical visibility
- **Metrics aggregation:** The `/api/analytics` endpoint currently computes stats in-memory on every request; at scale, pre-compute and cache these aggregations (Redis or materialized views)
- **Structured logging:** Every `[TRIAGE]` log line includes the incident ID — at scale, ship to a log aggregator (Loki, CloudWatch, Datadog) for cross-incident correlation

---

## Bottleneck Analysis

| Component | Current Bottleneck | Impact | Mitigation |
|-----------|-------------------|--------|------------|
| **Gemini API** | Rate limits, 2–5s latency | High — blocks pipeline | Queue + backoff + semantic caching |
| **SQLite** | Single writer | High at >50 concurrent writes/s | Migrate to PostgreSQL |
| **Image Processing** | Memory per image (up to 10 MB) | Medium | Resize on upload, stream to object storage |
| **Deduplication** | Full-table scan of last 50 incidents | Low | Add `created_at` index; use vector similarity at scale |
| **In-memory analytics** | Recomputed on every `/api/analytics` request | Low | Cache with 60s TTL |
| **Langfuse Flush** | Synchronous flush at pipeline end | Low | Switch to async flush with timeout |

---

## Capacity Estimates

### Incident Volume vs. Infrastructure

| Scale | Incidents/Day | Backend Replicas | Database | Est. LLM Cost/Month |
|-------|--------------|-----------------|----------|---------------------|
| **Hackathon** | < 100 | 1 | SQLite | ~$1 |
| **Startup** | 500 | 1–2 | PostgreSQL (free tier) | ~$5 |
| **Growth** | 5,000 | 2–4 | PostgreSQL (managed) | ~$50 |
| **Enterprise** | 50,000 | 4–8 + autoscaling | PostgreSQL HA | ~$500 |

*LLM cost based on Gemini 1.5 Flash pricing (~$0.075 per 1M input tokens, ~150 tokens average per incident).*

---

## Assumptions

- Peak load: < 100 concurrent incidents for current single-instance deployment
- Average incident: 1 image attachment < 5 MB
- LLM provider SLA: > 99.5% uptime
- Incidents are independent — no cross-incident real-time dependencies
- Deduplication window: last 50 incidents (configurable via `threshold` parameter in `deduplicator.py`)

---

## What Would Change First

If this moved from hackathon to production, the priority order would be:

1. **PostgreSQL** — SQLite's write lock is the first real bottleneck under concurrent load
2. **Redis queue** — Decouples API from pipeline workers, enables horizontal scaling
3. **Object storage** — Local volume doesn't work across replicas
4. **Gemini rate-limit handling** — Exponential backoff + queue depth monitoring
5. **WebSocket updates** — Replace 1-second polling with push notifications for better UX at scale
