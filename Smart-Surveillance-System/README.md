# IntelliSafe — Smart Surveillance System

Real-time working site safety monitoring using edge computer vision.

| Member | Role |
|--------|------|
| Muhammad Ahmad (FA23-BCE-113) | Platform, MQTT, Jetson deploy |
| Muhammad Uzair (FA23-BCE-098) | Edge / CV |

**Planning docs / proposals:** [`../documentations/`](../documentations/)

## Month 1 (this repo)

- Frozen event contract: [`contracts/`](contracts/)
- MQTT → Redis path + simulator: [`infra/`](infra/), [`transport/`](transport/)
- CV handoff + IoU helper + dataset layout: [`edge/`](edge/)

**Do not start yet:** full YOLO training, Postgres/Alert services, React dashboard, Jetson flash (Month 2+).

## Quick start

```bash
cd Smart-Surveillance-System
# If Docker Desktop socket is stale:
# export DOCKER_HOST=unix:///var/run/docker.sock
docker compose -f infra/docker-compose.yml up --build -d
docker compose -f infra/docker-compose.yml exec redis redis-cli XRANGE ppe:alerts - + COUNT 5
```

Local tests:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest contracts/test_events.py edge/compliance_engine/test_iou.py -q
```

## Layout

```
contracts/     Frozen MQTT/event schema (both)
edge/          CV only (Member B)
transport/     MQTT-Redis bridge + simulator (Member A)
services/      Backend stubs (Month 2+)
frontend/      Dashboard (Month 3+)
infra/         Docker Compose
docs/          Sprint logs, Jira ticket list, M0 notes
scripts/       Sample generators
```

## Docs in this repo

- [Month 1 runbook](infra/README.md)
- [Contract + topics](contracts/README.md)
- [CV handoff](edge/README.md)
- [Detection class scope](DETECTION_CLASS_SCOPE.md)
- [M0 freeze & Month 2 carry-over](docs/M0_FREEZE.md)
- [M0 proof log](docs/M0_PROOF.md)
