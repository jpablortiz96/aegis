<div align="center">

# 🛡️ AEGIS

### Autonomous Engine for Guided Incident Support

**Production-grade SRE agent that automates incident intake, multimodal triage, and end-to-end lifecycle management for e-commerce platforms.**

[![MIT License](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](docker-compose.yml)
[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](backend/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](frontend/)
[![Gemini](https://img.shields.io/badge/Gemini_2.5-Flash-orange.svg)](backend/app/pipeline/triage.py)

[Demo Video](#demo) · [Quick Start](#quick-start) · [Architecture](#architecture) · [Documentation](#documentation)

</div>

---

## The Problem

In e-commerce operations, incident response is fragmented: reports arrive via email, Slack, tickets — in different formats, with varying levels of detail. SRE teams waste critical minutes on manual triage, context gathering, and routing. During peak traffic (Black Friday, flash sales), this delay directly translates to lost revenue.

## The Solution

**AEGIS** is an autonomous SRE agent that handles the complete incident lifecycle:

1. **Multimodal Intake** — Accepts incident reports with text descriptions and screenshots
2. **Security Screening** — Detects prompt injection, XSS, and SQL injection attempts before processing
3. **AI-Powered Triage** — Uses Gemini 2.5 Flash to classify severity, identify root causes, and recommend actions
4. **Smart Deduplication** — Identifies similar past incidents to avoid duplicate tickets
5. **Automated Ticketing** — Creates structured tickets with full context and code references
6. **Team Notification** — Alerts engineering via Slack and email with severity-aware formatting
7. **Resolution Tracking** — Closes the loop by notifying the original reporter when issues are resolved

## Key Features

🧠 **AI Triage with Code Context** — Gemini analyzes incidents against e-commerce codebase patterns, providing probable root cause and recommended actions

🛡️ **Security-First Design** — 16+ pattern guardrails detect prompt injection, XSS, SQL injection, and data exfiltration attempts with risk scoring (0–1 scale)

📊 **Full Observability** — Every pipeline step is traced with Langfuse, with structured JSON logging and correlation IDs across the incident lifecycle

🔄 **Incident Deduplication** — Jaccard similarity matching against historical incidents prevents duplicate tickets

📱 **Real-Time Pipeline Tracking** — Live UI stepper shows each processing stage as it executes

📈 **Analytics Dashboard** — Aggregated metrics: incidents by severity, category, triage time, and resolution rates

## Demo

🎬 **[Watch the 3-minute demo on YouTube](YOUR_YOUTUBE_LINK_HERE)** #AgentXHackathon

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AEGIS Frontend                           │
│              React 18 + Tailwind CSS + Vite                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────┐  │
│  │ Incident │  │   Pipeline   │  │ Analytics │  │ Security  │  │
│  │   Form   │  │   Timeline   │  │ Dashboard │  │   Test    │  │
│  └────┬─────┘  └──────────────┘  └───────────┘  └───────────┘  │
└───────┼─────────────────────────────────────────────────────────┘
        │ REST API + Polling
┌───────▼─────────────────────────────────────────────────────────┐
│                      AEGIS Backend                              │
│                   FastAPI + Python 3.11                         │
│                                                                 │
│  ┌─────────────────── Pipeline Orchestrator ──────────────────┐ │
│  │                                                             │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │ │
│  │  │  Input   │→ │ Security │→ │  Dedup   │→ │ AI Triage │  │ │
│  │  │Validator │  │  Guard   │  │  Check   │  │  (Gemini) │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────┬─────┘  │ │
│  │                                                    │        │ │
│  │  ┌──────────────────────────────────────────┐     │        │ │
│  │  │           Mock Integrations              │◄────┘        │ │
│  │  │  ┌──────┐  ┌───────┐  ┌───────┐         │              │ │
│  │  │  │ Jira │  │ Slack │  │ Email │         │              │ │
│  │  │  └──────┘  └───────┘  └───────┘         │              │ │
│  │  └──────────────────────────────────────────┘              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────┐  ┌───────────────┐  ┌────────────────────┐       │
│  │  SQLite  │  │   Langfuse    │  │ E-Commerce Context │       │
│  │   State  │  │   Tracing     │  │  (Code Snippets)   │       │
│  └──────────┘  └───────────────┘  └────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, Tailwind CSS, Vite | Incident management UI |
| **Backend** | Python 3.11, FastAPI | API and pipeline orchestration |
| **AI/LLM** | Google Gemini 2.5 Flash | Multimodal incident triage |
| **Observability** | Langfuse | End-to-end pipeline tracing |
| **Database** | SQLite + aiosqlite | Incident state persistence |
| **Security** | Custom guardrails engine | Prompt injection & input validation |
| **Containerization** | Docker + Docker Compose | Reproducible deployment |
| **E-Commerce Context** | Reaction Commerce (Node.js) | Reference codebase for analysis |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/aegis.git
cd aegis

# Configure environment
cp .env.example .env
# Edit .env with your API keys (see .env.example for details)

# Launch
docker compose up --build

# Access
# Frontend:     http://localhost:3000
# Backend API:  http://localhost:8000
# Health Check: http://localhost:8000/api/health
```

See [QUICKGUIDE.md](QUICKGUIDE.md) for detailed setup instructions.

## Pipeline Flow

```
Incident Submitted
│
▼
🔍 Input Validation  ──→ Validates text, email, image format
│
▼
🛡️ Security Check   ──→ 16+ patterns: injection, XSS, SQLi (risk score 0-1)
│
▼
🔄 Deduplication    ──→ Jaccard similarity against last 50 incidents
│
▼
🧠 AI Triage        ──→ Gemini 2.5 Flash: severity, category, root cause
│
▼
🎫 Ticket Creation  ──→ Structured ticket with full context
│
▼
📢 Team Notification ──→ Slack + Email with severity-aware formatting
│
▼
✅ Resolution        ──→ Reporter notified when ticket is resolved
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/incidents` | Submit new incident (multipart form) |
| `GET` | `/api/incidents` | List all incidents |
| `GET` | `/api/incidents/{id}` | Get incident details + pipeline log |
| `POST` | `/api/incidents/{id}/resolve` | Mark incident as resolved |
| `GET` | `/api/incidents/{id}/report` | Export structured incident report (JSON) |
| `GET` | `/api/analytics` | Aggregated incident metrics |
| `POST` | `/api/test-guardrails` | Test security guardrails |
| `GET` | `/api/debug/config` | Verify API key configuration |
| `GET` | `/api/health` | Health check |

## Documentation

| Document | Description |
|----------|-------------|
| [AGENTS_USE.md](AGENTS_USE.md) | Agent architecture, capabilities, observability evidence, and security guardrails |
| [SCALING.md](SCALING.md) | Scaling strategy, bottleneck analysis, and capacity planning |
| [QUICKGUIDE.md](QUICKGUIDE.md) | Step-by-step setup and testing guide |

## Project Structure

```
aegis/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application & endpoints
│   │   ├── config.py            # Environment configuration
│   │   ├── models.py            # Data models & database setup
│   │   ├── pipeline/
│   │   │   ├── orchestrator.py  # Sequential pipeline execution
│   │   │   ├── intake.py        # Input validation
│   │   │   ├── triage.py        # Gemini AI triage (REST API)
│   │   │   ├── ticket.py        # Mock ticket creation
│   │   │   ├── notifier.py      # Mock Slack & email notifications
│   │   │   └── deduplicator.py  # Incident similarity detection
│   │   ├── guardrails/
│   │   │   └── sanitizer.py     # Prompt injection & input security
│   │   ├── mocks/               # Realistic mock integrations
│   │   └── ecommerce_context/   # Reaction Commerce code snippets
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main application with routing
│   │   └── components/          # UI components
│   ├── Dockerfile               # Multi-stage build (Node → Nginx)
│   └── nginx.conf               # Reverse proxy configuration
├── docker-compose.yml
├── .env.example
├── README.md
├── AGENTS_USE.md
├── SCALING.md
├── QUICKGUIDE.md
└── LICENSE
```

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built for the [AgentX Hackathon 2026](https://lablab.ai) · #AgentXHackathon**

</div>
