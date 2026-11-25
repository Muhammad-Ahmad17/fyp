# Infra

Docker Compose runs the full pipeline: Mosquitto, Redis, Postgres, Python bridge, FastAPI, simulator, React dashboard.

```bash
export DOCKER_HOST=unix:///var/run/docker.sock   # if needed
make up
# open http://localhost:8080
```

| Service | Port | Role |
|---------|------|------|
| frontend | 8080 | Dashboard + proxy of `/api` and `/ws` |
| api | 3000 | FastAPI: REST, WebSocket, evidence, PDF reports, software alarm |
| mosquitto | 1883 | MQTT |
| redis | 6379 | Streams `ppe:alerts`, `ppe:metrics`, `ppe:heartbeat`, `ppe:dead_letter` |
| postgres | 5432 | `violations`, `compliance_metrics`, `devices`, `site_rules` |
| bridge | — | `ppe/#` → validate → Redis |
| simulator | — | Mock camera (4 alerts + 1 metrics per cycle). Set `SIMULATOR_ENABLED=false` for long-lived stacks |

```bash
make mock EVENT=fire
make mock-bad          # should land in ppe:dead_letter
make down
```
