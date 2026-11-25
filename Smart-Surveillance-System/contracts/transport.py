"""MQTT topics and Redis stream names for contract v1.0."""

from __future__ import annotations

from typing import Any

from contracts.alarm import ALARM_TOPIC
from contracts.events import AlertMessage, HeartbeatMessage, MetricsMessage, SafetyMessageAdapter

TOPIC_PREFIX = "ppe"
TOPIC_WILDCARD = f"{TOPIC_PREFIX}/#"

STREAMS = {
    "alert": "ppe:alerts",
    "metrics": "ppe:metrics",
    "heartbeat": "ppe:heartbeat",
    "dead_letter": "ppe:dead_letter",
}
LIVE_CHANNEL = "ppe:live"
MQTT_QOS = 1


def stream_for_type(msg_type: str) -> str:
    return STREAMS[msg_type]


def is_retained(msg_type: str) -> bool:
    return msg_type == "heartbeat"


def topic_for(msg: AlertMessage | MetricsMessage | HeartbeatMessage) -> str:
    if msg.type == "alert":
        return f"{TOPIC_PREFIX}/alerts/{msg.priority.value}"
    if msg.type == "metrics":
        return f"{TOPIC_PREFIX}/metrics/{msg.device_id}"
    return f"{TOPIC_PREFIX}/heartbeat/{msg.device_id}"


def is_alarm_topic(topic: str) -> bool:
    return topic == ALARM_TOPIC or topic.startswith(f"{TOPIC_PREFIX}/alarm")


def parse_topic(topic: str) -> dict[str, str] | None:
    parts = topic.split("/")
    if not parts or parts[0] != TOPIC_PREFIX:
        return None
    if is_alarm_topic(topic):
        return {"type": "alarm"}
    if len(parts) == 3 and parts[1] == "alerts" and parts[2]:
        return {"type": "alert", "priority": parts[2]}
    if len(parts) == 3 and parts[1] == "metrics" and parts[2]:
        return {"type": "metrics", "device_id": parts[2]}
    if len(parts) == 3 and parts[1] == "heartbeat" and parts[2]:
        return {"type": "heartbeat", "device_id": parts[2]}
    return None


def topic_mismatch(topic: str, msg: AlertMessage | MetricsMessage | HeartbeatMessage) -> str | None:
    parsed = parse_topic(topic)
    if parsed is None:
        return f"unknown topic: {topic}"
    if parsed["type"] != msg.type:
        return f'topic type "{parsed["type"]}" does not match payload type "{msg.type}"'
    if msg.type == "alert" and parsed.get("priority") != msg.priority.value:
        return f'topic priority "{parsed["priority"]}" does not match payload priority "{msg.priority.value}"'
    if msg.type != "alert" and parsed.get("device_id") != msg.device_id:
        return f'topic device_id "{parsed["device_id"]}" does not match payload device_id "{msg.device_id}"'
    return None


def stream_fields_for(
    topic: str,
    msg: AlertMessage | MetricsMessage | HeartbeatMessage,
    received_at: str,
) -> dict[str, Any]:
    dumped = SafetyMessageAdapter.dump(msg)
    return {
        "topic": topic,
        "payload": SafetyMessageAdapter.dumps(msg),
        "received_at": received_at,
        "event_id": dumped["event_id"],
        "type": msg.type,
        "event": dumped["event"] if msg.type == "alert" else "",
        "priority": dumped["priority"] if msg.type == "alert" else "",
        "device_id": msg.device_id,
    }
