# M0 proof — captured 2026-09-26

## Command

```bash
export DOCKER_HOST=unix:///var/run/docker.sock   # if Docker Desktop socket is stale
cd Smart-Surveillance-System
docker compose -f infra/docker-compose.yml up --build -d
docker compose -f infra/docker-compose.yml exec redis redis-cli XRANGE ppe:alerts - + COUNT 5
```

## Result (abbreviated)

Stream `ppe:alerts` contained contract-valid events including:

- `helmet_missing` (MEDIUM, welding_bay)
- `vest_missing` (MEDIUM)
- `fire` (CRITICAL)
- `smoke` (CRITICAL)
- `spill` (MEDIUM)

`ppe:metrics` received `compliant`; `ppe:heartbeat` received simulator heartbeats.

Bridge logs showed successful `XADD` for each publish. Unit tests: `7 passed` (`contracts` + IoU).

## Manual team actions still required for full M0 checklist

- Physical signatures on `docs/M0_FREEZE.md` and collaboration agreement
- Member B: annotate ≥ 200 real images (scaffold + 5 placeholder samples provided)
- Member A: confirm Jetson hardware in custody
- Create tickets on live Jira from `docs/jira/SPRINT1_TICKETS.md`
