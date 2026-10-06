"""Frozen event contract between edge (Member B handoff) and platform (Member A).

After M0 (Week 4), do not change casually — both members + note required.
Member B emits CV fields; Member A adds type, priority, timestamp, session_id
when publishing over MQTT.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class EventType(str, Enum):
    ALERT = "alert"
    METRICS = "metrics"
    HEARTBEAT = "heartbeat"


class EventName(str, Enum):
    HELMET_MISSING = "helmet_missing"
    VEST_MISSING = "vest_missing"
    FIRE = "fire"
    SMOKE = "smoke"
    SPILL = "spill"
    COMPLIANT = "compliant"


class Priority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class Zone(str, Enum):
    WELDING_BAY = "welding_bay"
    GENERAL = "general"
    CHEMICAL_STORAGE = "chemical_storage"


# Detection class names (YOLO / handoff detections[].class)
DETECTION_CLASSES = ("worker", "helmet", "vest", "fire", "smoke", "spill")


class Detection(BaseModel):
    """Single detection box from the CV pipeline."""

    class_name: str = Field(..., alias="class", description="YOLO class name")
    bbox: List[float] = Field(
        ...,
        min_length=4,
        max_length=4,
        description="[x, y, w, h] in image pixels (top-left origin)",
    )
    confidence: float = Field(..., ge=0.0, le=1.0)

    model_config = {"populate_by_name": True}


class SafetyEvent(BaseModel):
    """Full MQTT payload — frozen schema."""

    type: EventType
    event: EventName
    priority: Priority
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    session_id: str = Field(default_factory=lambda: str(uuid4()))
    worker_id: Optional[int] = None
    zone: Zone = Zone.GENERAL
    confidence: float = Field(..., ge=0.0, le=1.0)
    compliance_score: float = Field(..., ge=0.0, le=100.0)
    detections: List[Detection] = Field(default_factory=list)
    image_path: Optional[str] = None

    model_config = {"populate_by_name": True}


class CVHandoff(BaseModel):
    """Fields Member B's get_compliance_event(frame) must return.

    Member A wraps this into SafetyEvent (adds type, priority, timestamp, session_id).
    """

    event: EventName
    zone: Zone = Zone.GENERAL
    worker_id: Optional[int] = None
    compliance_score: float = Field(..., ge=0.0, le=100.0)
    confidence: float = Field(..., ge=0.0, le=1.0)
    detections: List[Detection] = Field(default_factory=list)
    image_path: Optional[str] = None


def priority_for_event(event: EventName) -> Priority:
    """Default priority mapping used by publisher / simulator."""
    if event in (EventName.FIRE, EventName.SMOKE):
        return Priority.CRITICAL
    if event == EventName.SPILL:
        return Priority.MEDIUM
    if event in (EventName.HELMET_MISSING, EventName.VEST_MISSING):
        return Priority.MEDIUM
    return Priority.LOW


def handoff_to_safety_event(
    handoff: CVHandoff,
    *,
    event_type: EventType = EventType.ALERT,
    session_id: Optional[str] = None,
) -> SafetyEvent:
    """Member A: wrap CV handoff into the frozen MQTT contract."""
    return SafetyEvent(
        type=event_type if handoff.event != EventName.COMPLIANT else EventType.METRICS,
        event=handoff.event,
        priority=priority_for_event(handoff.event),
        session_id=session_id or str(uuid4()),
        worker_id=handoff.worker_id,
        zone=handoff.zone,
        confidence=handoff.confidence,
        compliance_score=handoff.compliance_score,
        detections=handoff.detections,
        image_path=handoff.image_path,
    )


# Example JSON (MQTT body) — also used in docs and tests
EXAMPLE_ALERT = {
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
        {"class": "worker", "bbox": [100.0, 120.0, 80.0, 200.0], "confidence": 0.95},
        {"class": "vest", "bbox": [110.0, 160.0, 60.0, 80.0], "confidence": 0.88},
    ],
    "image_path": "evidence/00000000-0000-0000-0000-000000000001/frame_001.jpg",
}
