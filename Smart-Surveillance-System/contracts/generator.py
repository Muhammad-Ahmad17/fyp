"""Pure mock-event generator. Every message is validated against the contract."""

from __future__ import annotations

import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

from pydantic import BaseModel, ConfigDict, Field

from contracts.events import (
    ALERT_EVENTS,
    HAZARD_EVENTS,
    SCHEMA_VERSION,
    AlertMessage,
    HeartbeatMessage,
    MetricsMessage,
    SafetyMessageAdapter,
    priority_for,
)
from contracts.transport import topic_for

CAMERA_ID = "cam-01"
FRAME = {"width": 1280, "height": 720}

SAMPLE_IMAGE_BY_EVENT = {
    "helmet_missing": "samples/sample_helmet_missing.png",
    "vest_missing": "samples/sample_worker_ppe.png",
    "fire": "samples/sample_fire.png",
    "smoke": "samples/sample_smoke.png",
}


@dataclass
class MockContext:
    device_id: str = "jetson-sim-01"
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source: str = "simulator"
    started_at: float = field(default_factory=lambda: datetime.now(timezone.utc).timestamp() * 1000)
    rng: Callable[[], float] = field(default_factory=lambda: random.random)
    now: Callable[[], datetime] = field(default_factory=lambda: (lambda: datetime.now(timezone.utc)))
    uuid: Callable[[], str] = field(default_factory=lambda: (lambda: str(uuid.uuid4())))


def create_context(**opts: Any) -> MockContext:
    ctx = MockContext()
    for key, value in opts.items():
        setattr(ctx, key, value)
    return ctx


class SimulateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: str = "alert"
    event: str | None = None
    count: int = Field(default=1, ge=1, le=20)


def _round(n: float, digits: int) -> float:
    return round(n, digits)


def _between(ctx: MockContext, lo: float, hi: float) -> float:
    return lo + ctx.rng() * (hi - lo)


def _int_between(ctx: MockContext, lo: int, hi: int) -> int:
    return min(hi, lo + int(ctx.rng() * (hi - lo + 1)))


def _pick(ctx: MockContext, items: tuple[str, ...] | list[str]) -> str:
    return items[min(len(items) - 1, int(ctx.rng() * len(items)))]


def _envelope(ctx: MockContext) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "event_id": ctx.uuid(),
        "timestamp": ctx.now().isoformat().replace("+00:00", "Z"),
        "source": ctx.source,
        "device_id": ctx.device_id,
        "session_id": ctx.session_id,
    }


def _detections_for(event: str, ctx: MockContext) -> list[dict[str, Any]]:
    jitter = lambda: _int_between(ctx, -20, 20)
    conf = lambda: _round(_between(ctx, 0.78, 0.98), 2)
    x = 500 + jitter() * 4
    y = 180 + jitter()
    worker = {"class": "worker", "bbox": [x, y, 160, 400], "confidence": conf()}
    helmet = {"class": "helmet", "bbox": [x + 50, y - 10, 70, 70], "confidence": conf()}
    vest = {"class": "vest", "bbox": [x + 20, y + 120, 120, 160], "confidence": conf()}
    if event == "helmet_missing":
        return [worker, vest]
    if event == "vest_missing":
        return [worker, helmet]
    return [{"class": event, "bbox": [300 + jitter() * 4, 250 + jitter(), 240, 240], "confidence": conf()}]


def generate_alert(ctx: MockContext, event: str | None = None) -> AlertMessage:
    chosen = event or _pick(ctx, ALERT_EVENTS)
    detections = _detections_for(chosen, ctx)
    payload = {
        **_envelope(ctx),
        "type": "alert",
        "event": chosen,
        "priority": priority_for(chosen),
        "camera_id": CAMERA_ID,
        "worker_id": None if chosen in HAZARD_EVENTS else _int_between(ctx, 1, 15),
        "confidence": max(d["confidence"] for d in detections),
        "compliance_score": _round(_between(ctx, 40, 85), 1),
        "frame": dict(FRAME),
        "detections": detections,
        "image_path": SAMPLE_IMAGE_BY_EVENT[chosen],
    }
    return AlertMessage.model_validate(payload)


def generate_metrics(ctx: MockContext) -> MetricsMessage:
    workers = _int_between(ctx, 3, 12)
    violations = min(workers, _int_between(ctx, 0, 3))
    score = max(0, min(100, 100 - (violations / workers) * 60 - _between(ctx, 0, 6)))
    payload = {
        **_envelope(ctx),
        "type": "metrics",
        "compliance_score": _round(score, 1),
        "worker_count": workers,
        "violation_count": violations,
    }
    return MetricsMessage.model_validate(payload)


def generate_heartbeat(ctx: MockContext, status: str = "online") -> HeartbeatMessage:
    now_ms = ctx.now().timestamp() * 1000
    payload = {
        **_envelope(ctx),
        "type": "heartbeat",
        "status": status,
        "uptime_sec": max(0, int((now_ms - ctx.started_at) / 1000)),
        "fps": 0 if status == "offline" else _round(_between(ctx, 11, 15), 1),
    }
    return HeartbeatMessage.model_validate(payload)


def generate_from_request(ctx: MockContext, req: SimulateRequest | dict[str, Any]) -> list[Any]:
    body = req if isinstance(req, SimulateRequest) else SimulateRequest.model_validate(req)
    out: list[Any] = []
    for _ in range(body.count):
        if body.type == "alert":
            out.append(generate_alert(ctx, body.event))
        elif body.type == "metrics":
            out.append(generate_metrics(ctx))
        elif body.type == "heartbeat":
            out.append(generate_heartbeat(ctx))
        else:
            raise ValueError(f"unknown type {body.type!r}")
    return out


CYCLE: list[dict[str, str]] = [{"type": "alert", "event": e} for e in ALERT_EVENTS] + [{"type": "metrics"}]


def generate_cycle_step(ctx: MockContext, n: int) -> Any:
    step = CYCLE[n % len(CYCLE)]
    if step["type"] == "alert":
        return generate_alert(ctx, step["event"])
    return generate_metrics(ctx)


def publish_info(msg: Any) -> dict[str, str]:
    dumped = SafetyMessageAdapter.dump(msg)
    return {"event_id": dumped["event_id"], "type": dumped["type"], "topic": topic_for(msg)}
