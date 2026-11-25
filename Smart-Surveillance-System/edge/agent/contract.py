"""Python side of event contract v1.0.

Source of truth is packages/contracts (TypeScript). This module mirrors the three things the edge
needs: priority rules, the handoff -> message wrapper and topic names. `test_agent.py` runs the shared
golden cases in contracts/fixtures/handoff_cases.json against it, and every message is validated
against contracts/event.schema.json before it is published.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

from jsonschema import Draft202012Validator

SCHEMA_VERSION = "1.0"
SCHEMA_PATH = Path(__file__).resolve().parents[2] / "contracts" / "event.schema.json"

HAZARD_EVENTS = ("fire", "smoke")


class ContractError(ValueError):
    """The handoff or message does not satisfy the contract."""


def priority_for(event: str) -> str:
    if event in ("fire", "smoke"):
        return "CRITICAL"
    if event in ("helmet_missing", "vest_missing"):
        return "HIGH"
    if event == "compliant":
        return "LOW"
    raise ContractError(f"unknown event {event!r}")


@lru_cache(maxsize=1)
def _defs() -> dict[str, Any]:
    return json.loads(SCHEMA_PATH.read_text())["$defs"]


def _validator(name: str) -> Draft202012Validator:
    return Draft202012Validator({"$ref": f"#/$defs/{name}", "$defs": _defs()})


def _first_error(name: str, doc: Mapping[str, Any]) -> str | None:
    err = next(iter(_validator(name).iter_errors(doc)), None)
    if err is None:
        return None
    path = ".".join(str(p) for p in err.absolute_path) or "<root>"
    return f"{path}: {err.message}"


def validate_handoff(handoff: Mapping[str, Any]) -> None:
    msg = _first_error("CVHandoff", handoff)
    if msg:
        raise ContractError(f"invalid handoff: {msg}")


def validate_message(message: Mapping[str, Any]) -> None:
    msg = _first_error("SafetyMessage", message)
    if msg:
        raise ContractError(f"invalid message: {msg}")


def iso_now(now: datetime | None = None) -> str:
    t = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    return t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{t.microsecond // 1000:03d}Z"


def _envelope(device_id: str, session_id: str, source: str, event_id: str | None, now: datetime | None) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "event_id": event_id or str(uuid.uuid4()),
        "timestamp": iso_now(now),
        "source": source,
        "device_id": device_id,
        "session_id": session_id,
    }


def _worker_count(handoff: Mapping[str, Any]) -> int:
    if handoff.get("worker_count") is not None:
        return int(handoff["worker_count"])
    return sum(1 for d in handoff.get("detections", []) if d.get("class") == "worker")


def alert_from_handoff(
    handoff: Mapping[str, Any],
    *,
    device_id: str,
    session_id: str,
    source: str = "edge",
    event_id: str | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """`compliant` is not an alert. Everything else becomes an alert with the platform-assigned priority."""
    validate_handoff(handoff)
    event = handoff["event"]
    if event == "compliant":
        raise ContractError("compliant is not an alert; use metrics_from_handoff")
    is_hazard = event in HAZARD_EVENTS
    worker_id = None if is_hazard else handoff.get("worker_id")
    if not is_hazard and worker_id is None:
        raise ContractError(f"worker_id is required for PPE event {event!r}")
    msg = {
        **_envelope(device_id, session_id, source, event_id, now),
        "type": "alert",
        "event": event,
        "priority": priority_for(event),
        "camera_id": handoff["camera_id"],
        "worker_id": worker_id,
        "confidence": handoff["confidence"],
        "compliance_score": handoff["compliance_score"],
        "frame": handoff["frame"],
        "detections": list(handoff.get("detections", [])),
        "image_path": handoff.get("image_path"),
    }
    validate_message(msg)
    return msg


def metrics_from_handoff(
    handoff: Mapping[str, Any],
    *,
    device_id: str,
    session_id: str,
    source: str = "edge",
    event_id: str | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Metrics can be derived from any handoff, so the gauge keeps moving during violations too."""
    validate_handoff(handoff)
    default_violations = 0 if handoff["event"] == "compliant" else 1
    violations = handoff.get("violation_count")
    msg = {
        **_envelope(device_id, session_id, source, event_id, now),
        "type": "metrics",
        "compliance_score": handoff["compliance_score"],
        "worker_count": _worker_count(handoff),
        "violation_count": int(violations) if violations is not None else default_violations,
    }
    validate_message(msg)
    return msg


def heartbeat_message(
    *,
    device_id: str,
    session_id: str,
    status: str = "online",
    uptime_sec: int = 0,
    fps: float = 0.0,
    source: str = "edge",
    event_id: str | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    msg = {
        **_envelope(device_id, session_id, source, event_id, now),
        "type": "heartbeat",
        "status": status,
        "uptime_sec": max(0, int(uptime_sec)),
        "fps": max(0.0, float(fps)),
    }
    validate_message(msg)
    return msg


def topic_for(message: Mapping[str, Any]) -> str:
    kind = message["type"]
    if kind == "alert":
        return f"ppe/alerts/{message['priority']}"
    if kind == "metrics":
        return f"ppe/metrics/{message['device_id']}"
    if kind == "heartbeat":
        return f"ppe/heartbeat/{message['device_id']}"
    raise ContractError(f"unknown message type {kind!r}")


def is_retained(message: Mapping[str, Any]) -> bool:
    return message["type"] == "heartbeat"
