# IntelliSafe — Smart Surveillance System

Real-time working site safety monitoring using edge computer vision.

| Member | Role |
|--------|------|
| Muhammad Ahmad (FA23-BCE-113) | Platform, MQTT, backend, dashboard |
| Muhammad Uzair (FA23-BCE-098) | Edge / CV (Python) |

**Planning docs / proposals:** [`../documentations/`](../documentations/)

## What works today (software-only demo)

A mock event travels the whole pipeline and shows up on the dashboard — no Jetson, no ESP:

```
simulator / "Send mock event" button
        │  MQTT (QoS 1)            ppe/alerts/{priority}
        ▼
   Mosquitto ──► bridge (validate v1.0 contract, dead-letter bad input)
                    │  Redis Streams  ppe:alerts | ppe:metrics | ppe:heartbeat
                    ▼
                  api (consumer group, idempotent)
                    ├─► PostgreSQL (violations, compliance_metrics, devices, site_rules)
                    └─► WebSocket /ws ─► React dashboard (live feed, KPIs, gauge, trend, ack)
```

## Stack

| Part | Tech |
|------|------|
| Contract, simulator, bridge, API | Node 22, TypeScript, Express 5, Zod, Drizzle ORM |
| Messaging | Mosquitto (MQTT), Redis Streams |
| Database | PostgreSQL 16 |
| Dashboard | React 19, Vite, Tailwind 4, Zustand, Recharts |
| Edge / CV (Uzair) | Python (YOLO, compliance engine) — the only Python in the repo |
| Deploy | Docker Compose on one VM, Caddy for HTTPS |

## Quick start

```bash
cd Smart-Surveillance-System
docker compose -f infra/docker-compose.yml up --build
# dashboard: http://localhost:8080
```

or `make up`. See [`infra/README.md`](infra/README.md) for the runbook, the demo script and the
cloud-VM deployment.

### Develop without Docker for the app code

```bash
nvm use                 # Node 22
npm ci
npm run typecheck && npm run lint && npm test   # all workspaces
```

Only Mosquitto, Redis and Postgres need to run for the full stack (`make infra`), then
`npm run dev -w @intellisafe/api` / `bridge` / `simulator` / `frontend`.

Edge side (Python). The edge agent turns the CV model's output into contract messages and publishes them;
run it against the local stack with the stub model while the real model is not ready:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q                 # edge agent + contract tests
make edge-agent           # stub model -> MQTT -> dashboard (needs `make up`)
```

Plugging in the real model: [`edge/README.md`](edge/README.md).

## Layout

```
packages/contracts/  Event contract v1.0 (Zod), topics, DTOs, JSON Schema export
services/simulator/  Mock Jetson: publishes events over MQTT
services/bridge/     MQTT -> Redis Streams, validation, dead-letter
services/api/        Consumer -> Postgres, REST, WebSocket, mock-event trigger
frontend/            React dashboard
contracts/           Human-readable spec + generated event.schema.json (for Python)
edge/                CV model (Member B) + edge agent that publishes its output (Python)
infra/               Docker Compose, Dockerfiles, Caddy, Mosquitto config, runbook
docs/                Sprint logs, Jira ticket list, M0 notes
scripts/             Sample generators (Python)
```

## Docs

- [Runbook, demo script, VM deploy](infra/README.md)
- [Event contract v1.0 + sign-off](contracts/README.md)
- [CV handoff](edge/README.md)
- [Detection class scope](DETECTION_CLASS_SCOPE.md)
- [M0 freeze & carry-over](docs/M0_FREEZE.md) (historical)
