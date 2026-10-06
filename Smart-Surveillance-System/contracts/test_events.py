"""Contract unit tests."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from contracts.events import (  # noqa: E402
    EXAMPLE_ALERT,
    CVHandoff,
    EventName,
    Priority,
    SafetyEvent,
    Zone,
    handoff_to_safety_event,
    priority_for_event,
)


def test_example_alert_parses() -> None:
    evt = SafetyEvent.model_validate(EXAMPLE_ALERT)
    assert evt.event == EventName.HELMET_MISSING
    assert evt.zone == Zone.WELDING_BAY
    assert len(evt.detections) == 2


def test_handoff_wrap() -> None:
    handoff = CVHandoff(
        event=EventName.FIRE,
        zone=Zone.GENERAL,
        compliance_score=50.0,
        confidence=0.9,
        detections=[{"class": "fire", "bbox": [1, 2, 3, 4], "confidence": 0.9}],
    )
    evt = handoff_to_safety_event(handoff)
    assert evt.priority == Priority.CRITICAL
    assert evt.type.value == "alert"


def test_priority_map() -> None:
    assert priority_for_event(EventName.SMOKE) == Priority.CRITICAL
    assert priority_for_event(EventName.COMPLIANT) == Priority.LOW
