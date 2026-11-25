"""Publishes contract-valid MQTT events (stand-in for the Jetson)."""

from __future__ import annotations

import logging
import os
import signal
import sys
import time
from typing import Any

import paho.mqtt.client as mqtt

from contracts.events import SafetyMessageAdapter
from contracts.generator import CYCLE, create_context, generate_cycle_step, generate_heartbeat
from contracts.transport import MQTT_QOS, is_retained, topic_for

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] simulator: %(message)s")
log = logging.getLogger("simulator")

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME") or ""
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD") or ""
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "event-simulator")
INTERVAL = float(os.getenv("SIMULATOR_INTERVAL_SEC", "2.0"))
DEVICE_ID = os.getenv("SIMULATOR_DEVICE_ID", "jetson-sim-01")
ENABLED = os.getenv("SIMULATOR_ENABLED", "true").lower() not in ("0", "false", "no")

_running = True


def publish_message(client: mqtt.Client, msg: Any) -> str:
    topic = topic_for(msg)
    client.publish(topic, SafetyMessageAdapter.dumps(msg), qos=MQTT_QOS, retain=is_retained(msg.type))
    return topic


def _handle_signal(signum: int, frame: Any) -> None:  # noqa: ANN401
    global _running
    log.info("Signal %s — shutting down", signum)
    _running = False


def main() -> None:
    if not ENABLED:
        log.info("SIMULATOR_ENABLED=false — sleeping so the container stays up")
        signal.signal(signal.SIGINT, _handle_signal)
        signal.signal(signal.SIGTERM, _handle_signal)
        while _running:
            time.sleep(1)
        return

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)
    ctx = create_context(device_id=DEVICE_ID)

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=MQTT_CLIENT_ID, protocol=mqtt.MQTTv311)
    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD or None)
    client.reconnect_delay_set(min_delay=1, max_delay=30)

    offline = generate_heartbeat(ctx, status="offline")
    client.will_set(topic_for(offline), SafetyMessageAdapter.dumps(offline), qos=MQTT_QOS, retain=True)

    backoff = 1.0
    while _running:
        try:
            client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
            client.loop_start()
            log.info("Simulator connected; publishing every %.1fs", INTERVAL)
            backoff = 1.0
            n = 0
            last_hb = 0.0
            while _running:
                msg = generate_cycle_step(ctx, n)
                topic = publish_message(client, msg)
                log.info("Published %s → %s", getattr(msg, "event", msg.type), topic)
                now = time.monotonic()
                if now - last_hb >= 10:
                    publish_message(client, generate_heartbeat(ctx))
                    last_hb = now
                n += 1
                time.sleep(INTERVAL)
            client.loop_stop()
            client.disconnect()
            break
        except Exception as exc:  # noqa: BLE001
            log.error("Simulator error: %s — retry in %.1fs", exc, backoff)
            time.sleep(backoff)
            backoff = min(backoff * 2, 30.0)
    log.info("Simulator stopped")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        log.exception("Fatal simulator error")
        sys.exit(1)
