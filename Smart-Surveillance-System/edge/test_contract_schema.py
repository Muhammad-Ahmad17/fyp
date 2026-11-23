"""Checks the edge handoff against the platform contract (contracts/event.schema.json).

The schema is generated from the TypeScript source of truth (packages/contracts):
    npm run export-schema
Member B can run this test without Node installed.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

SCHEMA_PATH = Path(__file__).resolve().parents[1] / "contracts" / "event.schema.json"
DOC = json.loads(SCHEMA_PATH.read_text())


def validator(name: str) -> Draft202012Validator:
    return Draft202012Validator({"$ref": f"#/$defs/{name}", "$defs": DOC["$defs"]})


HANDOFF = {
    "event": "helmet_missing",
    "camera_id": "cam-01",
    "worker_id": 7,
    "compliance_score": 78.0,
    "confidence": 0.92,
    "frame": {"width": 1280, "height": 720},
    "detections": [
        {"class": "worker", "bbox": [100.0, 120.0, 80.0, 200.0], "confidence": 0.95},
        {"class": "vest", "bbox": [110.0, 160.0, 60.0, 80.0], "confidence": 0.88},
    ],
    "image_path": "evidence/session/frame_001.jpg",
}

ALERT = {
    "schema_version": "1.0",
    "type": "alert",
    "event_id": "6f1c0e52-7d5b-4c1e-9a43-0b6f1f8d2a10",
    "timestamp": "2026-10-28T12:00:00.000Z",
    "source": "edge",
    "device_id": "jetson-01",
    "session_id": "0c9a7d3e-51b2-4f60-8a0e-3d9f6b2c1e44",
    "event": "helmet_missing",
    "priority": "HIGH",
    "camera_id": "cam-01",
    "worker_id": 7,
    "confidence": 0.92,
    "compliance_score": 78.0,
    "frame": {"width": 1280, "height": 720},
    "detections": HANDOFF["detections"],
    "image_path": "evidence/session/frame_001.jpg",
}


def test_handoff_example_is_valid() -> None:
    validator("CVHandoff").validate(HANDOFF)


def test_handoff_rejects_unknown_field() -> None:
    bad = {**HANDOFF, "priority": "HIGH"}  # the platform adds priority, the edge must not emit it
    assert not validator("CVHandoff").is_valid(bad)


@pytest.mark.parametrize("missing", ["event", "camera_id", "compliance_score", "confidence", "frame"])
def test_handoff_requires_core_fields(missing: str) -> None:
    bad = copy.deepcopy(HANDOFF)
    del bad[missing]
    assert not validator("CVHandoff").is_valid(bad)


def test_handoff_rejects_unknown_event() -> None:
    assert not validator("CVHandoff").is_valid({**HANDOFF, "event": "no_boots"})


def test_full_alert_message_is_valid() -> None:
    validator("SafetyMessage").validate(ALERT)


def test_alert_rejects_unknown_field() -> None:
    assert not validator("SafetyMessage").is_valid({**ALERT, "extra": 1})
