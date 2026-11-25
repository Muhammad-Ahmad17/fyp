# Event Contract v1.0 (MQTT mock events)

**Status:** v1.0 — proposed, awaiting joint sign-off (Ahmad + Uzair).
**Source of truth:** [`events.py`](events.py) (Python / Pydantic).
**Dashboard types:** [`frontend/src/lib/contract.ts`](../frontend/src/lib/contract.ts) (same field names).
**JSON Schema for the edge:** [`event.schema.json`](event.schema.json). Validate with `jsonschema`
(see `edge/test_contract_schema.py`).

Three message types share one envelope. The bridge rejects anything that does not validate
(unknown fields included) and parks it in the Redis dead-letter stream `ppe:dead_letter`.

## Envelope (every message)

| Field | Type | Notes |
|-------|------|-------|
| `schema_version` | string | `"1.0"`. Any `1.x` is accepted, other majors are rejected |
| `type` | `alert` \| `metrics` \| `heartbeat` | discriminator |
| `event_id` | UUID | unique per message; the database dedupes on it, so QoS 1 redelivery is safe |
| `timestamp` | ISO-8601 UTC | e.g. `2026-10-28T12:00:00.000Z` |
| `source` | `simulator` \| `edge` | who produced it |
| `device_id` | string (1–64) | e.g. `jetson-01` |
| `session_id` | UUID | one per process run |

## `alert`

Adds: `event`, `priority`, `camera_id`, `worker_id`, `confidence`, `compliance_score`,
`frame {width,height}`, `detections[]`, `image_path`.

| Field | Type | Rule |
|-------|------|------|
| `event` | `helmet_missing` \| `vest_missing` \| `fire` \| `smoke` | `compliant` is **not** an alert (see metrics) |
| `priority` | `CRITICAL` \| `HIGH` \| `MEDIUM` \| `LOW` | must equal the derived value below |
| `camera_id` | string | which camera saw it (there is no zone: one room, `camera_id` says where) |
| `worker_id` | int ≥ 1 \| null | required for PPE events, **null** for fire/smoke |
| `confidence` | 0–1 | |
| `compliance_score` | 0–100 | |
| `detections[]` | `{class, bbox:[x,y,w,h], confidence}` | `class` ∈ worker, helmet, vest, fire, smoke; bbox in frame pixels, top-left origin |
| `image_path` | string \| null | evidence frame, served at `/api/evidence/<path>` |

### Priority rules

| Event | Priority |
|-------|----------|
| `fire`, `smoke` | CRITICAL |
| `helmet_missing`, `vest_missing` | HIGH |

## `metrics`

Adds: `compliance_score`, `worker_count`, `violation_count`. This is where "everything is
compliant" is reported.

## `heartbeat`

Adds: `status` (`online` \| `degraded` \| `offline`), `uptime_sec`, `fps`. Published retained; the
device also registers an `offline` heartbeat as its MQTT last will.

## Topics, QoS, streams

| MQTT topic | Redis stream | Notes |
|------------|--------------|-------|
| `ppe/alerts/{priority}` | `ppe:alerts` | QoS 1 |
| `ppe/metrics/{device_id}` | `ppe:metrics` | QoS 1 |
| `ppe/heartbeat/{device_id}` | `ppe:heartbeat` | QoS 1, retained |
| `ppe/alarm` | *(not a Redis stream)* | QoS 1, retained. `{cmd, reason, camera_id}`. Bridge ignores it. |
| anything invalid | `ppe:dead_letter` | `reason`, `topic`, `payload` fields |

The topic must agree with the payload (priority/device_id); a mismatch is dead-lettered.

## Example alert

```json
{
  "schema_version": "1.0",
  "type": "alert",
  "event_id": "6f1c0e52-7d5b-4c1e-9a43-0b6f1f8d2a10",
  "timestamp": "2026-10-28T12:00:00.000Z",
  "source": "simulator",
  "device_id": "jetson-01",
  "session_id": "0c9a7d3e-51b2-4f60-8a0e-3d9f6b2c1e44",
  "event": "helmet_missing",
  "priority": "HIGH",
  "camera_id": "cam-01",
  "worker_id": 7,
  "confidence": 0.92,
  "compliance_score": 78.0,
  "frame": { "width": 1280, "height": 720 },
  "detections": [
    { "class": "worker", "bbox": [100, 120, 80, 200], "confidence": 0.95 },
    { "class": "vest", "bbox": [110, 160, 60, 80], "confidence": 0.88 }
  ],
  "image_path": "evidence/0c9a7d3e-51b2-4f60-8a0e-3d9f6b2c1e44/frame_001.jpg"
}
```

Metrics and heartbeat examples: `EXAMPLE_*` in `events.py`.

## Changes from the Month 1 draft

- `event_id`, `schema_version`, `source`, `device_id`, `camera_id`, `frame` added.
- `compliant` removed from alerts (metrics only).
- Metrics topic keyed by `device_id` instead of `session_id`.
- `priority` is validated against the rules above instead of being free.
- Unknown fields are rejected.
- Scope decision (single room, 5 model classes): `zone` and `spill` were removed. Topics are `ppe/alerts/{priority}`, and `helmet_missing` / `vest_missing` are always HIGH.

## Sign-off

| Role | Name | Date | Initials |
|------|------|------|----------|
| Member A (platform) | Muhammad Ahmad | ________ | ____ |
| Member B (CV) | Muhammad Uzair | ________ | ____ |

Uzair: `edge/README.md` lists the handoff fields you return. Please confirm the new `camera_id`
and `frame` fields (and optional `worker_count` / `violation_count`) before we freeze.

## Changing the contract

1. Edit `contracts/events.py` and `contracts/test_events.py`.
2. Update `frontend/src/lib/contract.ts` if the dashboard fields changed.
3. Bump `SCHEMA_VERSION` minor for additive changes, major for breaking ones.
