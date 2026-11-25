"""Event contract v1.0.

Python source of truth for the platform (bridge, simulator, API, edge agent).
The React dashboard copies the same field names in frontend/src/lib/contract.ts.
No zone, no spill, 5 detection classes.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator

SCHEMA_VERSION = "1.0"
_SCHEMA_VERSION_RE = re.compile(r"^1\.\d+$")


class MessageType(str, Enum):
    ALERT = "alert"
    METRICS = "metrics"
    HEARTBEAT = "heartbeat"


class AlertEvent(str, Enum):
    HELMET_MISSING = "helmet_missing"
    VEST_MISSING = "vest_missing"
    FIRE = "fire"
    SMOKE = "smoke"


class HandoffEvent(str, Enum):
    HELMET_MISSING = "helmet_missing"
    VEST_MISSING = "vest_missing"
    FIRE = "fire"
    SMOKE = "smoke"
    COMPLIANT = "compliant"


class Priority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class Source(str, Enum):
    SIMULATOR = "simulator"
    EDGE = "edge"


class DetectionClass(str, Enum):
    WORKER = "worker"
    HELMET = "helmet"
    VEST = "vest"
    FIRE = "fire"
    SMOKE = "smoke"


class DeviceStatus(str, Enum):
    ONLINE = "online"
    DEGRADED = "degraded"
    OFFLINE = "offline"


ALERT_EVENTS = tuple(e.value for e in AlertEvent)
HANDOFF_EVENTS = tuple(e.value for e in HandoffEvent)
PPE_EVENTS = ("helmet_missing", "vest_missing")
HAZARD_EVENTS = ("fire", "smoke")
PRIORITIES = tuple(p.value for p in Priority)
SOURCES = tuple(s.value for s in Source)
DETECTION_CLASSES = tuple(c.value for c in DetectionClass)
DEVICE_STATUSES = tuple(s.value for s in DeviceStatus)


def priority_for(event: str) -> str:
    if event in ("fire", "smoke"):
        return "CRITICAL"
    if event in ("helmet_missing", "vest_missing"):
        return "HIGH"
    if event == "compliant":
        return "LOW"
    raise ValueError(f"unknown event {event!r}")


def _utc_iso(value: datetime) -> str:
    value = value.astimezone(timezone.utc)
    return value.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, ser_json_by_alias=True)


class Detection(StrictModel):
    class_name: DetectionClass = Field(alias="class")
    bbox: tuple[float, float, float, float]
    confidence: float = Field(ge=0, le=1)

    @field_validator("bbox")
    @classmethod
    def bbox_non_negative(cls, value: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
        if any(n < 0 for n in value):
            raise ValueError("bbox values must be >= 0")
        return value


class Frame(StrictModel):
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class Envelope(StrictModel):
    schema_version: str
    event_id: uuid.UUID
    timestamp: datetime
    source: Source
    device_id: str = Field(min_length=1, max_length=64)
    session_id: uuid.UUID

    @field_validator("schema_version")
    @classmethod
    def major_one(cls, value: str) -> str:
        if not _SCHEMA_VERSION_RE.match(value):
            raise ValueError(f'schema_version must be "{SCHEMA_VERSION}" (major 1)')
        return value

    @field_serializer("timestamp", when_used="json")
    def _ser_timestamp(self, value: datetime) -> str:
        return _utc_iso(value)

    @field_serializer("event_id", "session_id", when_used="json")
    def _ser_uuid(self, value: uuid.UUID) -> str:
        return str(value)


class AlertMessage(Envelope):
    type: Literal["alert"] = "alert"
    event: AlertEvent
    priority: Priority
    camera_id: str = Field(min_length=1, max_length=64)
    worker_id: Optional[int] = Field(default=None, ge=1)
    confidence: float = Field(ge=0, le=1)
    compliance_score: float = Field(ge=0, le=100)
    frame: Frame
    detections: list[Detection]
    image_path: Optional[str] = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def cross_field_rules(self) -> AlertMessage:
        event = self.event.value
        if event in HAZARD_EVENTS and self.worker_id is not None:
            raise ValueError(f'worker_id must be null for hazard event "{event}"')
        if event not in HAZARD_EVENTS and self.worker_id is None:
            raise ValueError(f'worker_id is required for PPE event "{event}"')
        expected = priority_for(event)
        if self.priority.value != expected:
            raise ValueError(f"priority must be {expected} for {event}")
        return self


class MetricsMessage(Envelope):
    type: Literal["metrics"] = "metrics"
    compliance_score: float = Field(ge=0, le=100)
    worker_count: int = Field(ge=0)
    violation_count: int = Field(ge=0)


class HeartbeatMessage(Envelope):
    type: Literal["heartbeat"] = "heartbeat"
    status: DeviceStatus
    uptime_sec: int = Field(ge=0)
    fps: float = Field(ge=0)


SafetyMessage = Annotated[
    Union[AlertMessage, MetricsMessage, HeartbeatMessage],
    Field(discriminator="type"),
]


class SafetyMessageAdapter:
    """Parse / dump the discriminated union without a wrapping model."""

    @staticmethod
    def validate(data: Any) -> AlertMessage | MetricsMessage | HeartbeatMessage:
        if not isinstance(data, dict):
            raise ValueError("payload must be a JSON object")
        kind = data.get("type")
        if kind == "alert":
            return AlertMessage.model_validate(data)
        if kind == "metrics":
            return MetricsMessage.model_validate(data)
        if kind == "heartbeat":
            return HeartbeatMessage.model_validate(data)
        raise ValueError(f"unknown type {kind!r}")

    @staticmethod
    def dump(msg: AlertMessage | MetricsMessage | HeartbeatMessage) -> dict[str, Any]:
        return msg.model_dump(mode="json", by_alias=True)

    @staticmethod
    def dumps(msg: AlertMessage | MetricsMessage | HeartbeatMessage) -> str:
        return json.dumps(SafetyMessageAdapter.dump(msg), separators=(",", ":"))


class CVHandoff(StrictModel):
    event: HandoffEvent
    camera_id: str = Field(min_length=1, max_length=64)
    worker_id: Optional[int] = Field(default=None, ge=1)
    compliance_score: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    frame: Frame
    detections: list[Detection] = Field(default_factory=list)
    image_path: Optional[str] = Field(default=None, min_length=1)
    worker_count: Optional[int] = Field(default=None, ge=0)
    violation_count: Optional[int] = Field(default=None, ge=0)


def handoff_to_message(
    handoff: CVHandoff | dict[str, Any],
    *,
    device_id: str,
    session_id: str,
    source: str = "edge",
    event_id: str | None = None,
    now: datetime | None = None,
) -> AlertMessage | MetricsMessage:
    h = handoff if isinstance(handoff, CVHandoff) else CVHandoff.model_validate(handoff)
    envelope = {
        "schema_version": SCHEMA_VERSION,
        "event_id": event_id or str(uuid.uuid4()),
        "timestamp": now or datetime.now(timezone.utc),
        "source": source,
        "device_id": device_id,
        "session_id": session_id,
    }
    if h.event == HandoffEvent.COMPLIANT:
        workers = sum(1 for d in h.detections if d.class_name == DetectionClass.WORKER)
        return MetricsMessage.model_validate(
            {
                **envelope,
                "type": "metrics",
                "compliance_score": h.compliance_score,
                "worker_count": h.worker_count if h.worker_count is not None else workers,
                "violation_count": h.violation_count if h.violation_count is not None else 0,
            }
        )
    is_hazard = h.event.value in HAZARD_EVENTS
    return AlertMessage.model_validate(
        {
            **envelope,
            "type": "alert",
            "event": h.event.value,
            "priority": priority_for(h.event.value),
            "camera_id": h.camera_id,
            "worker_id": None if is_hazard else h.worker_id,
            "confidence": h.confidence,
            "compliance_score": h.compliance_score,
            "frame": h.frame.model_dump(),
            "detections": [d.model_dump(by_alias=True) for d in h.detections],
            "image_path": h.image_path,
        }
    )


EXAMPLE_ALERT: dict[str, Any] = {
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
    "frame": {"width": 1280, "height": 720},
    "detections": [
        {"class": "worker", "bbox": [100, 120, 80, 200], "confidence": 0.95},
        {"class": "vest", "bbox": [110, 160, 60, 80], "confidence": 0.88},
    ],
    "image_path": "evidence/0c9a7d3e-51b2-4f60-8a0e-3d9f6b2c1e44/frame_001.jpg",
}

EXAMPLE_METRICS: dict[str, Any] = {
    "schema_version": "1.0",
    "type": "metrics",
    "event_id": "b2d4f7a1-3c58-4e0b-8f6a-91e7c0d5a3b2",
    "timestamp": "2026-10-28T12:00:05.000Z",
    "source": "simulator",
    "device_id": "jetson-01",
    "session_id": "0c9a7d3e-51b2-4f60-8a0e-3d9f6b2c1e44",
    "compliance_score": 91.5,
    "worker_count": 6,
    "violation_count": 1,
}

EXAMPLE_HEARTBEAT: dict[str, Any] = {
    "schema_version": "1.0",
    "type": "heartbeat",
    "event_id": "e9a1c3d5-7b2f-4a68-b0c4-5d8e2f1a6c73",
    "timestamp": "2026-10-28T12:00:10.000Z",
    "source": "simulator",
    "device_id": "jetson-01",
    "session_id": "0c9a7d3e-51b2-4f60-8a0e-3d9f6b2c1e44",
    "status": "online",
    "uptime_sec": 3600,
    "fps": 14.2,
}
