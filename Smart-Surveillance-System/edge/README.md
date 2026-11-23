# Edge — CV Handoff Interface

**Owner:** Member B (Uzair)  
**Consumer:** Member A (Ahmad) — MQTT publisher wraps this dict; you never publish MQTT.

## Function

```python
def get_compliance_event(frame) -> dict:
    """
    Run detection + compliance on one frame.
    Returns a CVHandoff-compatible dict (validated against `contracts/event.schema.json`, see `contracts/README.md`).
    """
```

## Fields you emit

| Field | Type | Notes |
|-------|------|-------|
| `event` | str | `helmet_missing` \| `vest_missing` \| `fire` \| `smoke` \| `compliant` |
| `camera_id` | str | **New in v1.0.** Camera that produced the frame, e.g. `cam-01` |
| `frame` | `{width, height}` | **New in v1.0.** Frame size in pixels; `bbox` values are `[x, y, w, h]` in this space |
| `worker_id` | int \| null | Stable id across frames when possible |
| `compliance_score` | float 0–100 | Rolling compliance score for the window |
| `confidence` | float 0–1 | Primary detection confidence |
| `detections` | list | `[{class, bbox, confidence}, ...]` |
| `image_path` | str \| null | Path if evidence frame was saved |
| `worker_count`, `violation_count` | int, optional | **New in v1.0.** Sent with `compliant` frames so the platform can report metrics |

## Fields Member A adds (do not emit)

- `schema_version`, `event_id`, `source`, `device_id`, `session_id`
- `type` — `alert` \| `metrics` \| `heartbeat`
- `priority` — derived from event (`fire`/`smoke` → CRITICAL, etc.)
- `timestamp` — ISO-8601 UTC
- `session_id` — UUID for the run

## Example handoff JSON

```json
{
  "event": "helmet_missing",
  "camera_id": "cam-01",
  "frame": {"width": 1280, "height": 720},
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

## Checking your output

`contracts/event.schema.json` is generated from the platform's TypeScript contract. Validate a
handoff with `jsonschema` (`Draft202012Validator({"$ref": "#/$defs/CVHandoff", "$defs": doc["$defs"]})`),
see `test_contract_schema.py`. Unknown fields are rejected, so do not emit `priority` or `type`.
`compliant` is not an alert: it becomes a metrics message.

## Compliance rules (Month 2+)

- Associate helmet/vest to worker via IoU > 0.3 (helper in `compliance_engine/iou.py`)
- Debounce: violation must persist N frames before one event
- Hazards (fire/smoke) are not associated with a worker

## Month 1 deliverables

- This handoff spec (merged)
- Dataset workflow + labels (see `dataset/`)
- Pretrained demo samples in `inference/samples/`
- IoU unit test — not full training yet

## Edge agent: plug the model in (Member A owns this, Member B only supplies `get_compliance_event`)

`edge/agent/` is the glue that runs next to the model, on a laptop today and on the Jetson later. It calls
`get_compliance_event(frame)`, wraps each result in a contract message (priority, ids, timestamps),
publishes it over MQTT and uploads the evidence frame. Nothing else is needed on the edge.

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -r edge/requirements.txt
make up                                   # platform on this machine (or point MQTT_URL at the cloud VM)
python -m edge.agent                      # stub model, synthetic frames: proves the pipeline end to end
python -m edge.agent --source webcam      # laptop camera (pip install opencv-python), stub model
python -m edge.agent --source webcam --model edge.inference.model     # <- Uzair's model
python -m edge.agent --source video:clip.mp4 --model edge.inference.model
```

### What Uzair provides

A module exposing one function (see `edge/agent/stub_model.py` for a working example):

```python
def get_compliance_event(frame) -> dict | list[dict] | None
```

Return `None` for "nothing to report". The dict is the handoff described above. `camera_id` and `frame`
may be left out: the agent fills them from `EDGE_CAMERA_ID` and the frame size. For a PPE event
`worker_id` is required (the agent rejects the handoff and logs why otherwise). `image_path` is a path to a
JPEG/PNG the model saved; the agent uploads it and replaces the path.

### What the agent does for you

- alerts: at most one per `EDGE_ALERT_COOLDOWN_SEC` for the same (event, worker), so a violation that lasts
  10 seconds is one alert, not hundreds
- metrics: one every `EDGE_METRICS_EVERY_SEC`, taken from any handoff, so the gauge moves during violations too
- heartbeat every `EDGE_HEARTBEAT_EVERY_SEC` with the measured fps; an `offline` heartbeat is registered as MQTT last
  will, so the dashboard shows the device offline if it loses power
- reconnects to MQTT by itself and queues messages while offline

### Configuration (environment variables)

| Variable | Default | Meaning |
|----------|---------|---------|
| `MQTT_URL` | `mqtt://localhost:1883` | broker (`mqtts://` for TLS) |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | empty | broker login (required in production) |
| `EDGE_DEVICE_ID` | `jetson-01` | shows up as the device on the dashboard |
| `EDGE_CAMERA_ID` | `cam-01` | the single camera |
| `EVIDENCE_UPLOAD_URL` | empty | e.g. `http://localhost:3000/api/evidence`; empty = no images |
| `EVIDENCE_UPLOAD_TOKEN` | empty | must match the platform's `EVIDENCE_UPLOAD_TOKEN` |
| `EDGE_FPS` | `5` | how often the model runs |

### Tests

`pytest` runs `edge/test_agent.py` (no broker needed) including the shared golden cases in
`contracts/fixtures/handoff_cases.json`; the TypeScript platform runs the same file, so the two implementations
cannot drift apart. If you change a rule in `packages/contracts`, change the fixture and `edge/agent/contract.py`.
