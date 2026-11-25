"""Publish one mock event to MQTT.

    python -m transport.event_simulator.cli fire
    python -m transport.event_simulator.cli helmet_missing
    python -m transport.event_simulator.cli --bad
"""

from __future__ import annotations

import os
import sys

import paho.mqtt.client as mqtt

from contracts.events import ALERT_EVENTS, SafetyMessageAdapter
from contracts.generator import create_context, generate_alert
from contracts.transport import MQTT_QOS, is_retained, topic_for


def main(argv: list[str] | None = None) -> None:
    args = argv if argv is not None else sys.argv[1:]
    host = os.getenv("MQTT_HOST", "localhost")
    port = int(os.getenv("MQTT_PORT", "1883"))
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"mock-cli-{os.getpid()}", protocol=mqtt.MQTTv311)
    user, password = os.getenv("MQTT_USERNAME") or "", os.getenv("MQTT_PASSWORD") or ""
    if user:
        client.username_pw_set(user, password or None)
    client.connect(host, port, keepalive=30)
    try:
        if "--bad" in args:
            client.publish("ppe/alerts/HIGH", '{"type":"alert","event":"nonsense"}', qos=MQTT_QOS)
            print("published INVALID alert to ppe/alerts/HIGH (expect it in ppe:dead_letter)")
            return
        event = next((a for a in args if a in ALERT_EVENTS), None)
        msg = generate_alert(create_context(device_id="mock-cli"), event)
        topic = topic_for(msg)
        client.publish(topic, SafetyMessageAdapter.dumps(msg), qos=MQTT_QOS, retain=is_retained(msg.type))
        print(f"published {msg.event.value} ({msg.priority.value}) to {topic}  event_id={msg.event_id}")
    finally:
        client.disconnect()


if __name__ == "__main__":
    main()
