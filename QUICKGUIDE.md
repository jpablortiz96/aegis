# AEGIS — Quick Setup Guide

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- A Google Gemini API key — [Get one free at Google AI Studio](https://aistudio.google.com/apikey)
- *(Optional)* A [Langfuse](https://cloud.langfuse.com) account for pipeline observability

---

## Setup (3 minutes)

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/aegis.git
cd aegis
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
# Required — AI-powered triage will not work without this
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-1.5-flash        # or gemini-2.5-flash-preview-04-17

# Optional — enables end-to-end pipeline tracing in Langfuse
LANGFUSE_PUBLIC_KEY=your-langfuse-public-key
LANGFUSE_SECRET_KEY=your-langfuse-secret-key
LANGFUSE_HOST=https://cloud.langfuse.com
```

> **Tip:** If you skip the Langfuse keys, the pipeline still works fully — tracing is just disabled.

### 3. Build and run

```bash
docker compose up --build
```

The first build takes ~2–3 minutes (downloads base images, installs dependencies). Subsequent starts are fast.

### 4. Verify everything is running

```bash
# Check container health
docker compose ps

# Confirm backend is up
curl http://localhost:8000/api/health
# Expected: {"status":"ok","service":"aegis-backend"}

# Confirm API keys are loaded
curl http://localhost:8000/api/debug/config
# Expected: {"gemini_key_set":true,"gemini_model":"gemini-1.5-flash","langfuse_configured":false}
```

### 5. Access the application

| Service | URL |
|---------|-----|
| Frontend UI | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Health | http://localhost:8000/api/health |
| Config Check | http://localhost:8000/api/debug/config |

---

## Testing the Full Pipeline

### Submit Your First Incident

1. Open **http://localhost:3000**
2. Click **"New Incident"** in the navigation bar
3. Fill in the form:
   - **Title:** `Checkout page returns 500 error for all users`
   - **Description:** `Customers are unable to complete purchases. The checkout page shows a server error after clicking 'Place Order'. This started approximately 30 minutes ago and affects all payment methods. Error logs show: TypeError: Cannot read property 'items' of undefined at CartController.js:142.`
   - **Reporter Email:** `sre@yourcompany.com`
   - **Screenshot:** *(optional)* Upload a screenshot — Gemini will analyze it
4. Click **"Submit & Analyze"**
5. Watch the pipeline execute step-by-step through the animated stepper

### What to Expect

The pipeline runs in ~3–6 seconds:

| Step | What Happens |
|------|-------------|
| 🔍 Input Validation | Title, email, image format verified |
| 🛡️ Security Check | Input scanned for injection attempts |
| 🔄 Deduplication | Similar past incidents identified |
| 🧠 AI Triage | Gemini classifies severity + root cause |
| 🎫 Ticket Creation | Structured ticket generated |
| 📢 Notification | Slack + email alerts sent (mocked) |

After completion, you'll see:
- **Severity:** `HIGH` (based on checkout impact)
- **Category:** `checkout`
- **Technical summary** and **probable root cause** from Gemini
- A **ticket ID** (e.g., `JIRA-1042`)

---

## Testing Each Feature

### Security Guardrails

1. Click **"Security"** in the navigation bar
2. Click the **"Prompt Injection"** example button
3. Click **"Test Guardrails"**
4. Observe the red **BLOCKED** result with risk score ≥ 0.7
5. Try the **"Normal report"** example to see a clean ✅ result

### Incident Deduplication

Submit two similar incidents back-to-back:
- Incident 1: *"500 error on checkout page"*
- Incident 2: *"Checkout returning 500, users can't complete orders"*

The second incident's timeline will show a yellow **⚠️ Similar incidents detected** banner linking to the first.

### Analytics Dashboard

Click **"Dashboard"** to see:
- Total incidents, average triage time, pipeline success rate
- Severity distribution chart
- Category breakdown chart
- Recent incidents list

### Export Incident Report

1. Open any completed incident
2. Click **"📄 Export Report"** in the top bar
3. A `AEGIS-RPT-{id}.json` file downloads with the full structured report

### Resolve an Incident

1. Open any incident in **triaged** status
2. Click **"Mark as Resolved"**
3. The reporter receives an email notification (mocked — visible in the pipeline log)

---

## Watching Logs (Debugging)

```bash
# Stream backend logs
docker logs aegis-backend-1 -f

# Key log lines to look for:
# [AEGIS CONFIG] GEMINI_API_KEY : set (AIzaSyAB...)
# [TRIAGE] Calling Gemini REST API, model=gemini-1.5-flash
# [TRIAGE] Response status: 200
# [TRIAGE] SUCCESS: severity=high, category=checkout
```

If triage shows **"rule-based fallback"**, check `docker logs` for the `[TRIAGE]` lines to see the exact error.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Triage shows rule-based fallback | `GEMINI_API_KEY` not loaded | Check `docker logs` for `[AEGIS CONFIG]` line; verify `.env` has the key |
| `gemini_key_set: false` at `/api/debug/config` | Key not passed to container | Run `docker compose down && docker compose up --build` |
| Frontend blank / can't reach backend | Containers not running | Run `docker compose ps` and restart if needed |
| Port 3000 or 8000 already in use | Port conflict | Change `ports:` in `docker-compose.yml` |
| Build fails on first run | Docker cache issue | Run `docker compose down -v && docker compose up --build` |
| Image upload not working | Volume mount missing | Ensure `./data/uploads` directory exists (created automatically on first run) |

---

## Stopping and Restarting

```bash
# Stop containers (preserves data)
docker compose down

# Stop and wipe all data
docker compose down -v

# Rebuild after code changes
docker compose up --build
```

Data (incidents, uploads) persists in `./data/` between restarts.
