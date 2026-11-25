"""MQTT → Redis Streams bridge.

Subscribes to ppe/#, validates each payload against the v1.0 contract,
checks that the topic matches the payload, then XADDs. Anything invalid
goes to ppe:dead_letter.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone
from typing import Any

import paho.mqtt.client as mqtt
import redis
from pydantic import ValidationError

from contracts.events import SafetyMessageAdapter
from contracts.transport import STREAMS, is_alarm_topic, stream_fields_for, stream_for_type, topic_mismatch

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] bridge: %(message)s")
log = logging.getLogger("bridge")

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME") or ""
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD") or ""
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "mqtt-redis-bridge")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_URL = os.getenv("REDIS_URL")
DEAD_LETTER = STREAMS["dead_letter"]

_running = True


def handle_message(r: redis.Redis, topic: str, raw: str, received_at: str | None = None) -> str:
    """Validate one MQTT payload and XADD it. Returns 'ok', 'ignored', or 'dead_letter'."""
    if is_alarm_topic(topic):
        return "ignored"
    received_at = received_at or datetime.now(timezone.utc).isoformat()
    try:
        data = json.loads(raw)
        msg = SafetyMessageAdapter.validate(data)
    except (json.JSONDecodeError, ValidationError, ValueError) as exc:
        _dead_letter(r, topic, raw, f"validation_error:{exc}")
        return "dead_letter"
    mismatch = topic_mismatch(topic, msg)
    if mismatch:
        _dead_letter(r, topic, raw, mismatch)
        return "dead_letter"
    fields = stream_fields_for(topic, msg, received_at)
    r.xadd(stream_for_type(msg.type), fields)
    log.info("XADD %s event_id=%s type=%s", stream_for_type(msg.type), fields["event_id"], msg.type)
    return "ok"


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
    log.warning("dead-letter %s: %s", topic, reason)


def _connect_redis(retries: int = 30, delay: float = 1.0) -> redis.Redis:
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            client = redis.Redis.from_url(REDIS_URL, decode_responses=True) if REDIS_URL else redis.Redis(
                host=REDIS_HOST, port=REDIS_PORT, decode_responses=True
            )
            client.ping()
            log.info("Connected to Redis")
            return client
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            log.warning("Redis connect attempt %s/%s failed: %s", attempt, retries, exc)
            time.sleep(delay)
    raise RuntimeError(f"Could not connect to Redis: {last_err}")


def _on_message(client: mqtt.Client, userdata: dict[str, Any], msg: mqtt.MQTTMessage) -> None:
    raw = msg.payload.decode("utf-8", errors="replace")
    handle_message(userdata["redis"], msg.topic, raw)


def _on_connect(client: mqtt.Client, userdata: dict[str, Any], flags: Any, reason_code: Any, properties: Any = None) -> None:
    code = getattr(reason_code, "value", reason_code)
    if code == 0:
        client.subscribe("ppe/#")
        log.info("Subscribed to ppe/# on %s:%s", MQTT_HOST, MQTT_PORT)
    else:
        log.error("MQTT connect failed reason=%s", reason_code)


def _on_disconnect(client: mqtt.Client, userdata: dict[str, Any], flags: Any, reason_code: Any, properties: Any = None) -> None:
    log.warning("MQTT disconnected reason=%s — paho will retry", reason_code)


def _handle_signal(signum: int, frame: Any) -> None:  # noqa: ANN401
    global _running
    log.info("Signal %s — shutting down", signum)
    _running = False


def main() -> None:
    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    r = _connect_redis()
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=MQTT_CLIENT_ID, protocol=mqtt.MQTTv311)
    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD or None)
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
