"""Event simulator — publishes contract-valid MQTT events (Jetson stand-in until Month 4)."""

from __future__ import annotations

import json
import logging
import os
import random
import signal
import sys
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import paho.mqtt.client as mqtt

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] simulator: %(message)s",
)
log = logging.getLogger("simulator")

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "event-simulator")
INTERVAL = float(os.getenv("SIMULATOR_INTERVAL_SEC", "2.0"))

# All six event names from the frozen contract
EVENTS = [
    ("helmet_missing", "MEDIUM", "alert"),
    ("vest_missing", "MEDIUM", "alert"),
    ("fire", "CRITICAL", "alert"),
    ("smoke", "CRITICAL", "alert"),
    ("spill", "MEDIUM", "alert"),
    ("compliant", "LOW", "metrics"),
]
ZONES = ["welding_bay", "general", "chemical_storage"]

_running = True
_session = str(uuid4())


def _make_payload(event: str, priority: str, etype: str) -> dict[str, Any]:
    worker_id = None if event in ("fire", "smoke", "spill") else random.randint(1, 15)
    score = 95.0 if event == "compliant" else random.uniform(40.0, 85.0)
    detections = []
    if event == "compliant":
        detections = [
            {"class": "worker", "bbox": [100.0, 120.0, 80.0, 200.0], "confidence": 0.94},
            {"class": "helmet", "bbox": [110.0, 100.0, 40.0, 40.0], "confidence": 0.91},
            {"class": "vest", "bbox": [110.0, 160.0, 60.0, 80.0], "confidence": 0.89},
        ]
    elif event == "helmet_missing":
        detections = [
            {"class": "worker", "bbox": [100.0, 120.0, 80.0, 200.0], "confidence": 0.93},
            {"class": "vest", "bbox": [110.0, 160.0, 60.0, 80.0], "confidence": 0.88},
        ]
    elif event == "vest_missing":
        detections = [
            {"class": "worker", "bbox": [100.0, 120.0, 80.0, 200.0], "confidence": 0.93},
            {"class": "helmet", "bbox": [110.0, 100.0, 40.0, 40.0], "confidence": 0.90},
        ]
    elif event in ("fire", "smoke", "spill"):
        detections = [
            {"class": event, "bbox": [200.0, 150.0, 120.0, 120.0], "confidence": 0.85},
        ]

    return {
        "type": etype,
        "event": event,
        "priority": priority,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": _session,
        "worker_id": worker_id,
        "zone": random.choice(ZONES),
        "confidence": round(random.uniform(0.75, 0.98), 2),
        "compliance_score": round(score, 1),
        "detections": detections,
        "image_path": f"evidence/{_session}/frame_{int(time.time())}.jpg",
    }


def _topic_for(payload: dict[str, Any]) -> str:
    if payload["type"] == "heartbeat":
        return "ppe/heartbeat/simulator"
    if payload["type"] == "metrics":
        return f"ppe/metrics/{payload['session_id']}"
    return f"ppe/alerts/{payload['zone']}/{payload['priority']}"


def _handle_signal(signum: int, frame: Any) -> None:  # noqa: ANN401
    global _running
    log.info("Signal %s — shutting down", signum)
    _running = False


def main() -> None:
    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id=MQTT_CLIENT_ID,
        protocol=mqtt.MQTTv311,
    )
    client.reconnect_delay_set(min_delay=1, max_delay=30)

    backoff = 1.0
    while _running:
        try:
            client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
            client.loop_start()
            log.info("Simulator connected; publishing every %.1fs", INTERVAL)
            backoff = 1.0
            heartbeat_every = 5
            n = 0
            while _running:
                event, priority, etype = EVENTS[n % len(EVENTS)]
                payload = _make_payload(event, priority, etype)
                topic = _topic_for(payload)
                client.publish(topic, json.dumps(payload), qos=1)
                log.info("Published %s → %s", payload["event"], topic)

                if n % heartbeat_every == 0:
                    hb = {
                        "type": "heartbeat",
                        "event": "compliant",
                        "priority": "LOW",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "session_id": _session,
                        "worker_id": None,
                        "zone": "general",
                        "confidence": 1.0,
                        "compliance_score": 100.0,
                        "detections": [],
                        "image_path": None,
                        "device_id": "simulator",
                    }
                    client.publish("ppe/heartbeat/simulator", json.dumps(hb), qos=1)

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
