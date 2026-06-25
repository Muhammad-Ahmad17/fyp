# Member A — Prerequisites Checklist

**Role:** Platform, MQTT & Edge Deployment Lead  
**Project:** Industrial Safety Intelligence Platform  
**Must complete before Sprint 1 starts**

---

> Complete every section below and check all boxes before writing project code.  
> Reference: `finalization/COLLABORATION_AGREEMENT.md` (v1.2)

---

## 1. Your Responsibilities (Know This First)

You own **everything except CV model development**:

| You own | You do NOT own |
|---------|----------------|
| Full MQTT pipeline (publisher → broker → bridge → consumers) | YOLO training / TensorRT model creation |
| Jetson flash, deploy, demo-day hardware | Compliance algorithm design (Member B) |
| 5 FastAPI microservices + PostgreSQL + MinIO | MQTT code written by Member B |
| LangGraph agent, synthetic data, React dashboard | |
| Docker Compose, CI/CD, Prometheus, Grafana | |

**Handoff rule:** Member B gives you a Python dict/callback from CV code. You wrap it in your MQTT publisher and run the rest of the stack.

---

## 2. Hardware Prerequisites

### Required before Sprint 1

- [ ] Development machine with **16 GB+ RAM**, SSD, Linux (Ubuntu 22.04+ recommended)
- [ ] Stable internet for Docker pulls, GitHub, and LLM API access
- [ ] **NVIDIA Jetson Nano 2GB** in your custody (flash, deploy, demo)
- [ ] **32 GB+ microSD** (Class 10 / UHS-1) for Jetson
- [ ] **5V 4A power supply** for Jetson (barrel jack preferred)
- [ ] **USB or CSI camera** (720p minimum) attached to Jetson
- [ ] USB keyboard + HDMI display *(for initial Jetson setup only)*
- [ ] Ethernet cable *(recommended for Jetson setup and demo stability)*

### Recommended

- [ ] Heatsink or fan for Jetson sustained inference
- [ ] Second monitor for dashboard + Grafana during development

---

## 3. Software & Tools — Must Install Before Sprint 1

### Core development

- [ ] **Python 3.11+** installed and verified (`python3 --version`)
- [ ] **Node.js 20+** and npm (`node --version`, `npm --version`)
- [ ] **Docker Engine** + **Docker Compose v2** (`docker compose version`)
- [ ] **Git** configured with your **real name** and **university email**
- [ ] **VS Code** (or equivalent) with extensions: Python, Docker, ESLint, Prettier

### Databases & messaging (you will run these in Docker — know the concepts)

- [ ] **PostgreSQL** basics: `SELECT`, `INSERT`, joins, indexes
- [ ] **TimescaleDB** concept: hypertables for time-series data
- [ ] **Redis** basics: keys, TTL, pub/sub
- [ ] **Redis Streams**: `XADD`, `XREADGROUP`, `XACK`, consumer groups
- [ ] **MQTT** concepts: broker, topics, QoS, publish/subscribe
- [ ] **Mosquitto** — able to test with `mosquitto_pub` / `mosquitto_sub`
- [ ] **MinIO** — S3-compatible object storage concept (buckets, presigned URLs)

### Backend stack

- [ ] **FastAPI** — routes, Pydantic models, dependency injection
- [ ] **asyncio / async-await** in Python
- [ ] **Uvicorn** ASGI server
- [ ] **WebSockets** in FastAPI (live dashboard broadcast)
- [ ] **SQLAlchemy** or **asyncpg** for DB access
- [ ] **Alembic** or SQL migration workflow
- [ ] **paho-mqtt** Python client (publisher + subscriber patterns)
- [ ] **ReportLab** basics (PDF generation)

### Frontend stack

- [ ] **React 18+** with **TypeScript**
- [ ] **Vite** project scaffold
- [ ] **Zustand** (or equivalent) state management
- [ ] **React Router** for multi-page dashboard
- [ ] **Chart.js** (or Recharts) for analytics charts
- [ ] **Tailwind CSS** (or agreed CSS framework)
- [ ] Browser **WebSocket API** — connect, receive JSON, reconnect

### Agent & AI

- [ ] **LangGraph** / **LangChain** basics — nodes, tools, function calling
- [ ] **OpenAI API** — chat completions with tool use (GPT-4o)
- [ ] **Ollama** installed as offline fallback (Llama 3.1 8B or similar)
- [ ] **pgvector** concept — embeddings stored in PostgreSQL for RAG
- [ ] Sentence embedding model basics (e.g. `sentence-transformers`)

### DevOps & observability

- [ ] **docker-compose.yml** — multi-service orchestration, networks, volumes
- [ ] **GitHub Actions** — lint → test → build workflow YAML
- [ ] **Prometheus** — scrape `/metrics`, understand counters and histograms
- [ ] **Grafana** — import dashboard JSON, connect to Prometheus
- [ ] **pytest** — unit tests and integration tests with Docker

### Edge deployment (Jetson — your job)

- [ ] Flash **JetPack 4.6+** (or current supported version) to microSD
- [ ] SSH into Jetson, verify CUDA / TensorRT available
- [ ] Run a camera test (`v4l2` or OpenCV `VideoCapture`) on Jetson
- [ ] Deploy a Python script as a **systemd service** or startup script on Jetson
- [ ] Copy Member B's model files onto Jetson and run inference *(after B delivers)*

---

## 4. GitHub — Mandatory Collaboration Skills

You must demonstrate all of the following **before Sprint 1 ends**:

- [ ] Clone the shared repo and create a branch
- [ ] Make commits with clear messages using your university email
- [ ] Open a Pull Request with description: *what, why, how to test*
- [ ] Review Member B's PR on `edge/inference/` or `edge/compliance_engine/`
- [ ] Resolve a merge conflict locally
- [ ] Create a GitHub Issue with assignee, sprint label, and priority
- [ ] Read a failed **GitHub Actions** log and identify the error
- [ ] Never commit secrets — use `.env` + `.gitignore`

**Week 1 proof task:** Open your first PR that adds a file under `transport/` or `infra/` (e.g. empty docker-compose skeleton).

---

## 5. Documentation & Productivity Tools

Both members must use these consistently:

| Tool | Your use |
|------|----------|
| **LaTeX** (`.tex` → PDF) | Sprint plan, implementation guide, technical reports |
| **DOCX** | Formal supervisor submissions, letters |
| **PPT / Google Slides / Beamer** | Mid-term, final, exhibition presentations |
| **Markdown** (`.md`) | Sprint logs, meeting notes, README files |

### Before Sprint 1

- [ ] Can compile a LaTeX document to PDF (`pdflatex` or Overleaf)
- [ ] Can export/edit DOCX and save as PDF when required
- [ ] Can create a presentation slide deck
- [ ] Will maintain weekly sprint log at:  
      `docs/sprint-logs/<your-name>_sprint-<N>_log.md`
- [ ] Understand AI-use policy: AI assists drafting; **you verify, test, and rewrite in your own words**

---

## 6. Knowledge — Concepts You Must Understand

Read the architecture plan before coding:

- [ ] `finalization/dinosaur_fyp_architecture_92471e72.plan.md`
- [ ] `finalization/COLLABORATION_AGREEMENT.md`
- [ ] `shit/texes/sprint_plan.pdf` (or `.tex`)

### Architecture concepts

- [ ] **Event-driven architecture** — producers, brokers, consumers, backpressure
- [ ] **Microservices** — independent deployable services, shared contract only
- [ ] **Frozen event contract** — `contracts/events.py` must not change after Sprint 1 without joint approval
- [ ] **Consumer groups** — alert-svc and agent-svc read same stream independently
- [ ] **Why Redis Streams over raw MQTT subscribers** — persistence, replay, XACK
- [ ] Full pipeline you own:

```
CV handoff → MQTT Publisher → Mosquitto → Bridge → Redis Streams → Services → DB / Dashboard
```

### MQTT topics (memorize)

```
ppe/alerts/{zone}/{priority}    →  ppe:alerts
ppe/metrics/{session_id}        →  ppe:metrics
ppe/heartbeat/{device_id}       →  ppe:heartbeat
```

### Service ports (memorize)

| Port | Service |
|------|---------|
| 1883 | Mosquitto |
| 6379 | Redis |
| 5432 | PostgreSQL |
| 9000 | MinIO |
| 8001 | Alert Service |
| 8002 | Metrics Service |
| 8003 | Reporting Service |
| 8004 | WebSocket Gateway |
| 8005 | Agent Service |
| 3000 | React Dashboard |
| 9090 | Prometheus |
| 3001 | Grafana |

---

## 7. Accounts & Access

- [ ] GitHub account with access to shared repository
- [ ] OpenAI API key (or approved alternative) for agent development
- [ ] Ollama running locally for offline agent testing
- [ ] Shared team chat channel agreed (WhatsApp / Discord / Slack)
- [ ] Supervisor contact saved and introduction meeting done

---

## 8. What You Must NOT Do

- [ ] I will **not** change Member B's YOLO models or compliance algorithms without approval
- [ ] I will **not** skip documenting work in weekly sprint logs
- [ ] I will **not** push directly to `main` without a PR
- [ ] I will **not** change `contracts/events.py` after Sprint 1 without Member B + supervisor approval
- [ ] I will **not** expect Member B to write any MQTT code

---

## 9. Week 0 Readiness Gate — Proof Tasks

Complete these **before Sprint 1 Week 1 planning meeting**:

| # | Task | Done |
|---|------|------|
| 1 | Install Python, Node, Docker, Git — versions verified | ☐ |
| 2 | Clone repo, create branch, open first PR | ☐ |
| 3 | Run `docker run hello-world` successfully | ☐ |
| 4 | Publish + subscribe a test MQTT message locally (Mosquitto in Docker) | ☐ |
| 5 | Run Redis in Docker; execute `XADD` and `XREAD` on a test stream | ☐ |
| 6 | Scaffold empty FastAPI app with `/api/health` endpoint | ☐ |
| 7 | Scaffold empty Vite + React + TypeScript app | ☐ |
| 8 | Flash Jetson OR confirm hardware ready and JetPack image downloaded | ☐ |
| 9 | Read architecture plan + collaboration agreement fully | ☐ |
| 10 | Attend kickoff meeting with Member B; agree on CV handoff interface draft | ☐ |

---

## 10. Recommended Learning (If Gaps Exist)

Pick resources for any unchecked skill above:

| Topic | Suggested starting point |
|-------|-------------------------|
| FastAPI | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) tutorial |
| Redis Streams | Redis official docs — Streams introduction |
| MQTT | Mosquitto man pages + paho-mqtt Python examples |
| Docker Compose | Docker docs — Compose file reference |
| LangGraph | LangChain LangGraph quickstart |
| Jetson setup | NVIDIA Jetson Nano Getting Started guide |
| GitHub flow | GitHub Docs — Pull Request workflow |

**Target:** Close all gaps within **Week 1 of Sprint 1** while scaffolding the repo. Do not start Sprint 2 transport work until MQTT + Redis proof tasks pass.

---

## 11. Sign-Off

I confirm I have reviewed this checklist, understand my role, and am ready to begin Sprint 1 work.

| Field | Value |
|-------|-------|
| **Name** | _________________________ |
| **Reg. No.** | _________________________ |
| **Date** | _________________________ |
| **Signature** | _________________________ |

**Reviewed by Member B:** _________________________ **Date:** _______________

---

*Document version: 1.0 — aligned with COLLABORATION_AGREEMENT v1.2*
