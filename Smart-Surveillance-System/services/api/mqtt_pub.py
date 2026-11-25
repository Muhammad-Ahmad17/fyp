from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any

import paho.mqtt.client as mqtt

from contracts.events import SafetyMessageAdapter
from contracts.transport import MQTT_QOS, is_retained, topic_for

log = logging.getLogger("api.mqtt")


class EventPublisher:
    def __init__(self, host: str, port: int, username: str = "", password: str = "", client_id: str = "intellisafe-api"):
        self.host = host
        self.port = port
        self._connected = threading.Event()
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id, protocol=mqtt.MQTTv311)
        if username:
            self.client.username_pw_set(username, password or None)
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.reconnect_delay_set(min_delay=1, max_delay=30)

    def _on_connect(self, client: mqtt.Client, userdata: Any, flags: Any, reason_code: Any, properties: Any = None) -> None:
        code = getattr(reason_code, "value", reason_code)
        if code == 0:
            self._connected.set()
            log.info("MQTT connected")
        else:
            self._connected.clear()
            log.error("MQTT connect failed: %s", reason_code)

    def _on_disconnect(self, client: mqtt.Client, userdata: Any, flags: Any, reason_code: Any, properties: Any = None) -> None:
        self._connected.clear()
        log.warning("MQTT disconnected: %s", reason_code)

    def start(self) -> None:
        self.client.connect_async(self.host, self.port, keepalive=60)
        self.client.loop_start()

    def wait_connected(self, timeout: float = 10) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self._connected.is_set():
                return True
            time.sleep(0.1)
        return self._connected.is_set()

    def is_connected(self) -> bool:
        return self._connected.is_set()

    def publish(self, msg: Any) -> dict[str, str]:
        topic = topic_for(msg)
        self.client.publish(topic, SafetyMessageAdapter.dumps(msg), qos=MQTT_QOS, retain=is_retained(msg.type))
        dumped = SafetyMessageAdapter.dump(msg)
        return {"topic": topic, "event_id": dumped["event_id"], "type": dumped["type"]}

    def publish_json(self, topic: str, payload: dict[str, Any], retain: bool = False) -> None:
        self.client.publish(topic, json.dumps(payload), qos=MQTT_QOS, retain=retain)

    def stop(self) -> None:
        self.client.loop_stop()
        self.client.disconnect()
