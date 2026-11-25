from copy import deepcopy

import pytest
from pydantic import ValidationError

from contracts.events import (
    EXAMPLE_ALERT,
    EXAMPLE_HEARTBEAT,
    EXAMPLE_METRICS,
    AlertMessage,
    SafetyMessageAdapter,
    handoff_to_message,
    priority_for,
)
from contracts.generator import create_context, generate_alert, generate_from_request, generate_heartbeat, generate_metrics
from contracts.transport import parse_topic, stream_fields_for, topic_for, topic_mismatch


def test_examples_are_valid() -> None:
    SafetyMessageAdapter.validate(EXAMPLE_ALERT)
    SafetyMessageAdapter.validate(EXAMPLE_METRICS)
    SafetyMessageAdapter.validate(EXAMPLE_HEARTBEAT)


def test_rejects_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        SafetyMessageAdapter.validate({**EXAMPLE_ALERT, "surprise": 1})
    with pytest.raises(ValidationError):
        SafetyMessageAdapter.validate({**EXAMPLE_HEARTBEAT, "zone": "general"})


def test_rejects_removed_spill_and_zone() -> None:
    with pytest.raises(ValidationError):
        SafetyMessageAdapter.validate({**EXAMPLE_ALERT, "event": "spill"})
    with pytest.raises(ValidationError):
        SafetyMessageAdapter.validate({**EXAMPLE_ALERT, "zone": "general"})
    with pytest.raises(ValidationError):
        SafetyMessageAdapter.validate({**EXAMPLE_ALERT, "event": "compliant"})


def test_hazard_worker_id_and_priority() -> None:
    fire = {**deepcopy(EXAMPLE_ALERT), "event": "fire", "priority": "CRITICAL", "worker_id": 7}
    with pytest.raises(ValidationError):
        AlertMessage.model_validate(fire)
    AlertMessage.model_validate({**fire, "worker_id": None})
    with pytest.raises(ValidationError):
        AlertMessage.model_validate({**deepcopy(EXAMPLE_ALERT), "worker_id": None})
    with pytest.raises(ValidationError):
        AlertMessage.model_validate({**deepcopy(EXAMPLE_ALERT), "priority": "MEDIUM"})


@pytest.mark.parametrize(
    ("event", "expected"),
    [
        ("fire", "CRITICAL"),
        ("smoke", "CRITICAL"),
        ("helmet_missing", "HIGH"),
        ("vest_missing", "HIGH"),
        ("compliant", "LOW"),
    ],
)
def test_priority_for(event: str, expected: str) -> None:
    assert priority_for(event) == expected


def test_topics() -> None:
    alert = SafetyMessageAdapter.validate(EXAMPLE_ALERT)
    metrics = SafetyMessageAdapter.validate(EXAMPLE_METRICS)
    heartbeat = SafetyMessageAdapter.validate(EXAMPLE_HEARTBEAT)
    assert topic_for(alert) == "ppe/alerts/HIGH"
    assert topic_for(metrics) == "ppe/metrics/jetson-01"
    assert topic_for(heartbeat) == "ppe/heartbeat/jetson-01"
    assert parse_topic("ppe/alerts/MEDIUM") == {"type": "alert", "priority": "MEDIUM"}
    assert parse_topic("ppe/alerts/general/HIGH") is None
    assert topic_mismatch(topic_for(alert), alert) is None
    assert topic_mismatch("ppe/alerts/LOW", alert)
    fields = stream_fields_for("ppe/alerts/HIGH", alert, "2026-10-28T12:00:01.000Z")
    assert fields["event"] == "helmet_missing" and "zone" not in fields


def test_generator_messages_are_valid() -> None:
    ctx = create_context(device_id="jetson-test", now=lambda: __import__("datetime").datetime.fromisoformat("2026-10-28T12:00:10+00:00"))
    for event in ("helmet_missing", "vest_missing", "fire", "smoke"):
        SafetyMessageAdapter.validate(SafetyMessageAdapter.dump(generate_alert(ctx, event)))
    SafetyMessageAdapter.validate(SafetyMessageAdapter.dump(generate_metrics(ctx)))
    SafetyMessageAdapter.validate(SafetyMessageAdapter.dump(generate_heartbeat(ctx)))
    msgs = generate_from_request(ctx, {"type": "alert", "event": "smoke", "count": 3})
    assert len(msgs) == 3
    assert all(m.event.value == "smoke" for m in msgs)


def test_handoff_to_message() -> None:
    msg = handoff_to_message(
        {
            "event": "fire",
            "camera_id": "cam-01",
            "compliance_score": 50,
            "confidence": 0.9,
            "frame": {"width": 1280, "height": 720},
            "detections": [],
        },
        device_id="jetson-01",
        session_id="0c9a7d3e-51b2-4f60-8a0e-3d9f6b2c1e44",
    )
    assert msg.type == "alert" and msg.priority.value == "CRITICAL" and msg.worker_id is None
