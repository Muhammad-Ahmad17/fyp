# Infra — Month 1 stack

One command starts Mosquitto, Redis, the MQTT→Redis bridge, and the event simulator.

## Prerequisites

- Docker Engine + Docker Compose v2
- Ports free: `1883` (MQTT), `6379` (Redis)

## Start

From `Smart-Surveillance-System/`:

```bash
# If `docker compose` fails talking to Docker Desktop, use the system socket:
# export DOCKER_HOST=unix:///var/run/docker.sock

cp .env.example .env   # optional
docker compose -f infra/docker-compose.yml up --build -d
docker compose -f infra/docker-compose.yml ps
docker compose -f infra/docker-compose.yml logs -f event_simulator mqtt_redis_bridge
```

## Prove M0 (events in Redis)

```bash
# After ~10 seconds of simulator traffic:
docker compose -f infra/docker-compose.yml exec redis \
  redis-cli XRANGE ppe:alerts - + COUNT 5

docker compose -f infra/docker-compose.yml exec redis \
  redis-cli XRANGE ppe:metrics - + COUNT 3

docker compose -f infra/docker-compose.yml exec redis \
  redis-cli XRANGE ppe:heartbeat - + COUNT 3
```

You should see JSON payloads with `event` values such as `helmet_missing`, `fire`, `compliant`.

## Manual MQTT publish (debug)

```bash
docker compose -f infra/docker-compose.yml exec mosquitto \
  mosquitto_pub -h localhost -t 'ppe/alerts/general/MEDIUM' \
  -m '{"type":"alert","event":"helmet_missing","priority":"MEDIUM","timestamp":"2026-09-26T12:00:00+00:00","session_id":"debug","worker_id":1,"zone":"general","confidence":0.9,"compliance_score":70,"detections":[],"image_path":null}'
```

## Optional health stub (Month 2 warm-start)

```bash
docker compose -f infra/docker-compose.yml --profile optional up -d health_stub
curl http://localhost:8000/api/health
```

## Stop

```bash
docker compose -f infra/docker-compose.yml down
# wipe Redis volume:
docker compose -f infra/docker-compose.yml down -v
```

## Services

| Service | Port | Role |
|---------|------|------|
| mosquitto | 1883 | MQTT broker |
| redis | 6379 | Streams: `ppe:alerts`, `ppe:metrics`, `ppe:heartbeat`, `ppe:dead_letter` |
| mqtt_redis_bridge | — | `ppe/#` → Redis XADD |
| event_simulator | — | Publishes all 6 contract event types on a timer |

## Hardware checklist (Member A — confirm in Month 1, flash in Month 4)

- [ ] Jetson Nano 2GB in custody
- [ ] 32GB+ microSD
- [ ] 5V 4A power supply
- [ ] USB/CSI camera
