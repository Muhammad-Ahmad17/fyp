"""MQTT → Redis Streams bridge.

Subscribes to ppe/#, validates JSON against the frozen contract when possible,
XADDs to the matching stream. Bad payloads go to a dead-letter stream.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone
from typing import Any, Optional

import paho.mqtt.client as mqtt
import redis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] bridge: %(message)s",
)
log = logging.getLogger("bridge")

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "mqtt-redis-bridge")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
STREAM_ALERTS = os.getenv("REDIS_STREAM_ALERTS", "ppe:alerts")
STREAM_METRICS = os.getenv("REDIS_STREAM_METRICS", "ppe:metrics")
STREAM_HEARTBEAT = os.getenv("REDIS_STREAM_HEARTBEAT", "ppe:heartbeat")
DEAD_LETTER = os.getenv("REDIS_DEAD_LETTER", "ppe:dead_letter")

_running = True


def _stream_for_topic(topic: str) -> Optional[str]:
    if topic.startswith("ppe/alerts/"):
        return STREAM_ALERTS
    if topic.startswith("ppe/metrics/"):
        return STREAM_METRICS
    if topic.startswith("ppe/heartbeat/"):
        return STREAM_HEARTBEAT
    return None


def _connect_redis(retries: int = 30, delay: float = 1.0) -> redis.Redis:
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
            r.ping()
            log.info("Connected to Redis at %s:%s", REDIS_HOST, REDIS_PORT)
            return r
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            log.warning("Redis connect attempt %s/%s failed: %s", attempt, retries, exc)
            time.sleep(delay)
    raise RuntimeError(f"Could not connect to Redis: {last_err}")


def _dead_letter(r: redis.Redis, topic: str, payload: str, reason: str) -> None:
    r.xadd(
        DEAD_LETTER,
        {
            "topic": topic,
            "payload": payload[:4000],
            "reason": reason,
            "received_at": datetime.now(timezone.utc).isoformat(),
        },
    )


def _on_message(client: mqtt.Client, userdata: dict[str, Any], msg: mqtt.MQTTMessage) -> None:
    r: redis.Redis = userdata["redis"]
    topic = msg.topic
    raw = msg.payload.decode("utf-8", errors="replace")
    stream = _stream_for_topic(topic)
    if stream is None:
        _dead_letter(r, topic, raw, "unknown_topic")
        log.warning("Unknown topic (dead-lettered): %s", topic)
        return

    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("payload must be a JSON object")
    except (json.JSONDecodeError, ValueError) as exc:
        _dead_letter(r, topic, raw, f"parse_error:{exc}")
        log.warning("Bad JSON on %s: %s", topic, exc)
        return

    # Soft validation — keep pipeline moving even if optional fields missing
    fields = {
        "topic": topic,
        "payload": json.dumps(data),
        "received_at": datetime.now(timezone.utc).isoformat(),
        "event": str(data.get("event", "")),
        "priority": str(data.get("priority", "")),
        "zone": str(data.get("zone", "")),
        "session_id": str(data.get("session_id", "")),
    }
    msg_id = r.xadd(stream, fields)
    log.info("XADD %s id=%s event=%s", stream, msg_id, fields["event"])


def _on_connect(
    client: mqtt.Client,
    userdata: dict[str, Any],
    flags: Any,
    reason_code: Any,
    properties: Any = None,
) -> None:
    code = getattr(reason_code, "value", reason_code)
    if code == 0:
        client.subscribe("ppe/#")
        log.info("Subscribed to ppe/# on %s:%s", MQTT_HOST, MQTT_PORT)
    else:
        log.error("MQTT connect failed reason=%s", reason_code)


def _on_disconnect(
    client: mqtt.Client,
    userdata: dict[str, Any],
    flags: Any,
    reason_code: Any,
    properties: Any = None,
) -> None:
    log.warning("MQTT disconnected reason=%s — paho will retry", reason_code)


def _handle_signal(signum: int, frame: Any) -> None:  # noqa: ANN401
    global _running
    log.info("Signal %s — shutting down", signum)
    _running = False


def main() -> None:
    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    r = _connect_redis()
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id=MQTT_CLIENT_ID,
        protocol=mqtt.MQTTv311,
    )
    client.user_data_set({"redis": r})
    client.on_connect = _on_connect
    client.on_message = _on_message
    client.on_disconnect = _on_disconnect
    client.reconnect_delay_set(min_delay=1, max_delay=30)

    backoff = 1.0
    while _running:
        try:
            client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
            client.loop_start()
            backoff = 1.0
            while _running:
                time.sleep(0.5)
            client.loop_stop()
            client.disconnect()
            break
        except Exception as exc:  # noqa: BLE001
            log.error("MQTT connection error: %s — retry in %.1fs", exc, backoff)
            time.sleep(backoff)
            backoff = min(backoff * 2, 30.0)

    log.info("Bridge stopped")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        log.exception("Fatal bridge error")
        sys.exit(1)
