# Frozen Event Contract & MQTT Topic Map

**Status:** M0 — freeze after Week 4 joint sign-off.  
**Owners:** Both (changes need both members).

## MQTT topics → Redis streams

| MQTT topic | Redis stream | Payload |
|------------|--------------|---------|
| `ppe/alerts/{zone}/{priority}` | `ppe:alerts` | `SafetyEvent` with `type=alert` |
| `ppe/metrics/{session_id}` | `ppe:metrics` | compliance / metrics events |
| `ppe/heartbeat/{device_id}` | `ppe:heartbeat` | device liveness |

Wildcard subscription on the bridge: `ppe/#`.

## Schema

Python source of truth: [`events.py`](events.py)

- **`CVHandoff`** — what Member B returns from `get_compliance_event(frame)`
- **`SafetyEvent`** — full MQTT JSON (Member A adds `type`, `priority`, `timestamp`, `session_id`)

### Example alert JSON

```json
{
  "type": "alert",
  "event": "helmet_missing",
  "priority": "MEDIUM",
  "timestamp": "2026-09-26T12:00:00+00:00",
  "session_id": "00000000-0000-0000-0000-000000000001",
  "worker_id": 7,
  "zone": "welding_bay",
  "confidence": 0.92,
  "compliance_score": 78.0,
  "detections": [
    {"class": "worker", "bbox": [100, 120, 80, 200], "confidence": 0.95}
  ],
  "image_path": "evidence/.../frame_001.jpg"
}
```

### Event names

`helmet_missing` | `vest_missing` | `fire` | `smoke` | `spill` | `compliant`

### Zones

`welding_bay` | `general` | `chemical_storage`

## Prove the pipeline (M0)

```bash
cd Smart-Surveillance-System
docker compose -f infra/docker-compose.yml up --build -d
# wait a few seconds for the simulator
docker compose -f infra/docker-compose.yml exec redis redis-cli XRANGE ppe:alerts - + COUNT 5
```

## Sign-off (Week 4)

| Role | Name | Date | Initials |
|------|------|------|----------|
| Member A (platform) | Muhammad Ahmad | ________ | ____ |
| Member B (CV) | Muhammad Uzair | ________ | ____ |

After signing, treat this contract as frozen.
