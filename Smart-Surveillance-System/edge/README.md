# Edge — CV Handoff Interface

**Owner:** Member B (Uzair)  
**Consumer:** Member A (Ahmad) — MQTT publisher wraps this dict; you never publish MQTT.

## Function

```python
def get_compliance_event(frame) -> dict:
    """
    Run detection + compliance on one frame.
    Returns a CVHandoff-compatible dict (see contracts/events.py).
    """
```

## Fields you emit

| Field | Type | Notes |
|-------|------|-------|
| `event` | str | `helmet_missing` \| `vest_missing` \| `fire` \| `smoke` \| `spill` \| `compliant` |
| `zone` | str | From configured zone (e.g. `welding_bay`) |
| `worker_id` | int \| null | Stable id across frames when possible |
| `compliance_score` | float 0–100 | Rolling score for the zone/window |
| `confidence` | float 0–1 | Primary detection confidence |
| `detections` | list | `[{class, bbox, confidence}, ...]` |
| `image_path` | str \| null | Path if evidence frame was saved |

## Fields Member A adds (do not emit)

- `type` — `alert` \| `metrics` \| `heartbeat`
- `priority` — derived from event (`fire`/`smoke` → CRITICAL, etc.)
- `timestamp` — ISO-8601 UTC
- `session_id` — UUID for the run

## Example handoff JSON

```json
{
  "event": "helmet_missing",
  "zone": "welding_bay",
  "worker_id": 7,
  "compliance_score": 78.0,
  "confidence": 0.92,
  "detections": [
    {"class": "worker", "bbox": [100.0, 120.0, 80.0, 200.0], "confidence": 0.95},
    {"class": "vest", "bbox": [110.0, 160.0, 60.0, 80.0], "confidence": 0.88}
  ],
  "image_path": "evidence/session/frame_001.jpg"
}
```

## Compliance rules (Month 2+)

- Associate helmet/vest to worker via IoU > 0.3 (helper in `compliance_engine/iou.py`)
- Debounce: violation must persist N frames before one event
- Hazards (fire/smoke/spill) are zone-level, not worker-associated

## Month 1 deliverables

- This handoff spec (merged)
- Dataset workflow + labels (see `dataset/`)
- Pretrained demo samples in `inference/samples/`
- IoU unit test — not full training yet
