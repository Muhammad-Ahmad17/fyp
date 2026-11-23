# Infra — runbook

One command starts Mosquitto, Redis, PostgreSQL, bridge, API, simulator and the dashboard.

## Prerequisites

- Docker Engine + Docker Compose v2 (Ubuntu: `bash infra/scripts/install-docker.sh`, then re-login)
- Free ports: `8080` (dashboard), `3000` (API), `1883` (MQTT), `6379` (Redis), `5432` (Postgres)

## Start

From `Smart-Surveillance-System/`:

```bash
cp .env.example .env     # optional, defaults work
make up                  # = docker compose -f infra/docker-compose.yml up --build -d
make ps
make logs                # follow all services
```

Open <http://localhost:8080>. Within ~2 s the live feed fills with simulator events.

## Demo script (≈ 3 minutes)

1. Show `make ps`: 7 services healthy.
2. Open the dashboard: KPI cards, compliance gauge, trend chart updating, device `jetson-sim-01` online.
3. In **Send mock event** press the `Fire` button. Point out the
   round-trip latency shown under it, the red CRITICAL toast and the new row at the top of the feed.
4. Click the row: evidence frame, detections, **Acknowledge**. The KPI "unacknowledged" count drops.
5. Show the path with real data:
   ```bash
   make redis-alerts      # XRANGE ppe:alerts
   make psql              # select event_type, priority, camera_id from violations order by received_at desc limit 5;
   ```
6. Resilience: `docker compose -f infra/docker-compose.yml stop api`, send events with
   `make mock EVENT=fire` (publishes straight to MQTT), start `api` again and watch them arrive
   (Redis Streams consumer group replays what was missed).
7. Bad input: `make mock-bad` publishes an invalid payload; it lands in `ppe:dead_letter`.

## Useful commands

| Command | What |
|---------|------|
| `make down` / `make clean` | stop / stop and wipe volumes |
| `make redis-alerts` | last 5 entries of `ppe:alerts` |
| `make dead-letter` | entries in `ppe:dead_letter` |
| `make psql` | psql shell in the Postgres container |
| `make mock EVENT=fire` | publish one valid event over MQTT (default `helmet_missing`) |
| `make infra` | start only Mosquitto, Redis and Postgres for local dev |

Manual publish example:

```bash
docker compose -f infra/docker-compose.yml exec mosquitto \
  mosquitto_pub -h localhost -q 1 -t 'ppe/alerts/general/MEDIUM' -m '{...v1.0 alert...}'
```

## Services

| Service | Port | Role |
|---------|------|------|
| mosquitto | 1883 | MQTT broker (anonymous in dev) |
| redis | 6379 | Streams `ppe:alerts`, `ppe:metrics`, `ppe:heartbeat`, `ppe:dead_letter` |
| postgres | 5432 | `violations`, `compliance_metrics`, `devices`, `site_rules` |
| bridge | — | `ppe/#` → validate → Redis XADD |
| api | 3000 | consumer group `alert-svc`, REST `/api/*`, WebSocket `/ws`, `POST /api/simulate` |
| simulator | — | Mock Jetson (4 alerts + 1 metrics message per cycle, heartbeats). Set `SIMULATOR_ENABLED=false` when a real/edge-agent source is used, it publishes ~40k alerts a day |
| frontend | 8080 | nginx: dashboard + proxy of `/api` and `/ws` |

REST: `GET /api/health`, `/api/alerts`, `/api/alerts/:id`, `POST /api/alerts/:id/ack`,
`/api/metrics/summary`, `/api/metrics/trend`, `/api/devices`, `POST /api/simulate`,
`POST /api/evidence` (edge frame upload, `x-api-key` = `EVIDENCE_UPLOAD_TOKEN`), `/api/evidence/*`.

## Deploy to one cloud VM (HTTPS)

Same compose files plus `docker-compose.prod.yml`: Caddy terminates TLS and enforces basic auth on
the dashboard/API, Mosquitto requires a password, and only ports 80/443 (and 8883 if you later
connect a real device) are published.

### 1. Pick a VM

| Provider | Notes |
|----------|-------|
| DigitalOcean | $200 credit with the GitHub Student Pack; 2 GB droplet is enough |
| Hetzner | cheapest (~€4/month), EU |
| Oracle Cloud Always Free | free ARM VM, capacity is hit-or-miss |
| AWS / Azure | works, more setup; use a `t3.small` / `B1ms` |

Ubuntu 24.04, ≥ 2 GB RAM, 20 GB disk. Point a DNS record (`intellisafe.example.com`) at its IP —
Caddy needs it to get a certificate.

### 2. Prepare the VM

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git ufw apache2-utils
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
git clone <repo> && cd fyp/Smart-Surveillance-System
```

### 3. Configure secrets

```bash
cp infra/.env.prod.example .env
# edit: DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, MQTT_PASSWORD, BASIC_AUTH_USER
infra/scripts/gen-secrets.sh        # writes mosquitto password file + Caddy basic-auth hash into .env
```

### 4. Run

```bash
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up --build -d
curl -u "$BASIC_AUTH_USER:..." https://$DOMAIN/api/health
```

Update later: `git pull && docker compose ... up --build -d`. Back up Postgres with
`docker compose ... exec postgres pg_dump -U intellisafe intellisafe > backup.sql`.

Set `ENABLE_SIMULATE=false` and `SIMULATOR_ENABLED=false` in `.env` once a real device is connected.

## CI/CD

```
pull request  ->  CI: lint, typecheck, unit tests, build, JSON-schema freshness,
                      real Mosquitto/Redis/Postgres integration test, edge pytest, docker build + compose smoke test
push to main  ->  same checks, then publish 4 images to ghcr.io/<owner>/intellisafe-{api,bridge,simulator,frontend}
                  tagged with the commit SHA and `latest`, then deploy to the VM (if enabled)
```

Deploy = rsync `infra/` to `/opt/intellisafe`, pull the images for that SHA, `up -d --no-build`, then wait
for `/api/health` to report ok (the job fails and prints the API logs if it does not).
Database migrations run automatically when the API container starts.

**Roll back / redeploy:** Actions -> *Deploy* -> *Run workflow* -> `image_tag` = an earlier commit SHA.

### One-time setup

1. Push the repo to GitHub (CI starts working immediately; nothing deploys yet).
2. Make a deploy key and prepare the VM (see "Deploy to one cloud VM" for provider choice):
   ```bash
   ssh-keygen -t ed25519 -f deploy_key -N "" -C github-deploy
   scp infra/scripts/bootstrap-vm.sh root@<vm>:   # then on the VM:
   sudo bash bootstrap-vm.sh "$(cat deploy_key.pub)"
   ```
   On the VM, as `deploy`: create `/opt/intellisafe/.env` from `infra/.env.prod.example`, copy `infra/` there once
   (`rsync -a infra/ deploy@<vm>:/opt/intellisafe/infra/`) and run `bash infra/scripts/gen-secrets.sh`.
3. In GitHub -> Settings -> *Secrets and variables* -> Actions:

   | Name | Kind | Value |
   |------|------|-------|
   | `DEPLOY_HOST` | secret | VM IP or hostname |
   | `DEPLOY_USER` | secret | `deploy` |
   | `DEPLOY_SSH_KEY` | secret | contents of `deploy_key` (private) |
   | `DEPLOY_KNOWN_HOSTS` | secret, optional | output of `ssh-keyscan <vm>` (pins the host key; recommended) |
   | `DEPLOY_ENABLED` | variable | `true` |

4. Optional: Settings -> *Environments* -> `production` -> required reviewers for a manual approval gate;
   Settings -> *Branches* -> protect `main` and require the CI jobs.
5. Make the GHCR packages visible to the VM: they are private by default and the pipeline logs the VM in with the
   job's short-lived token, so no extra credentials are needed.

## Hardware checklist (Member A — confirm in Month 1, flash in Month 4)

- [ ] Jetson Nano 2GB in custody
- [ ] 32GB+ microSD
- [ ] 5V 4A power supply
- [ ] USB/CSI camera
