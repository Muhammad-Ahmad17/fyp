# IntelliSafe — Smart Surveillance System

Real-time working site safety monitoring. The **platform is Python**; the **dashboard is React**.

| Member | Role |
|--------|------|
| Muhammad Ahmad | Platform (MQTT, API, dashboard, deploy) |
| Muhammad Uzair | Edge / CV |

## What works today

A mock event travels the whole pipeline and shows up on the dashboard. Fire/smoke also
arm the software alarm (`ppe/alarm`); the dashboard can silence it and download a PDF report.

```
simulator / "Send mock event" button
        │  MQTT (QoS 1)            ppe/alerts/{priority}
        ▼
   Mosquitto ──► bridge (validate v1.0 contract, dead-letter bad input)
                    │  Redis Streams  ppe:alerts | ppe:metrics | ppe:heartbeat
                    ▼
                  api (FastAPI + Postgres + WebSocket /ws)
                    └─► React dashboard at http://localhost:8080
```

Five model classes: `worker`, `helmet`, `vest`, `fire`, `smoke`. No zones. No spill.

## Quick start

```bash
cd Smart-Surveillance-System
cp .env.example .env          # optional
make up                       # docker compose
# open http://localhost:8080
```

Local tests:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
make test
```

## Layout

```
contracts/     Pydantic event contract + mock generator
transport/     MQTT-Redis bridge + simulator
services/api/  FastAPI: Postgres, REST, WebSocket, evidence
frontend/      React dashboard (the only TypeScript in this repo)
edge/          CV handoff + Python edge agent
infra/         Docker Compose
```

Python is the whole platform. React/TypeScript is the dashboard only. A backup of the old Node stack is on git branch `typescript-pipeline`.
