"""MQTT publisher for the edge device (paho-mqtt).

- QoS 1; heartbeats are retained.
- Registers an `offline` heartbeat as the MQTT last will, so the dashboard marks the device offline
  if the Jetson drops off without saying goodbye.
- connect_async + background loop: reconnects by itself; messages published while disconnected are queued.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Mapping
from urllib.parse import urlparse

import paho.mqtt.client as mqtt

from . import contract

log = logging.getLogger("edge.publisher")
QOS = 1


def parse_mqtt_url(url: str) -> tuple[str, int, bool]:
    u = urlparse(url)
    if u.scheme not in ("mqtt", "mqtts") or not u.hostname:
        raise ValueError(f"MQTT_URL must look like mqtt://host:1883 (got {url!r})")
    tls = u.scheme == "mqtts"
    return u.hostname, u.port or (8883 if tls else 1883), tls


class EdgePublisher:
    def __init__(
        self,
        *,
        device_id: str,
        session_id: str,
        mqtt_url: str = "mqtt://localhost:1883",
        username: str | None = None,
        password: str | None = None,
        source: str = "edge",
        client: Any | None = None,
    ) -> None:
        self.device_id = device_id
        self.session_id = session_id
        self.source = source
        self.started = time.monotonic()
        self.host, self.port, tls = parse_mqtt_url(mqtt_url)

        self.client = client or mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2, client_id=f"{device_id}-{session_id[:8]}"
        )
        if username:
            self.client.username_pw_set(username, password or None)
        if tls and client is None:
            self.client.tls_set()
        will = contract.heartbeat_message(
            device_id=device_id, session_id=session_id, status="offline", source=source
        )
        self.client.will_set(contract.topic_for(will), json.dumps(will), qos=QOS, retain=True)
        self.client.max_queued_messages_set(1000)
        self.client.reconnect_delay_set(min_delay=1, max_delay=30)
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.connected = False

    # -- connection ---------------------------------------------------
    def _on_connect(self, _c: Any, _u: Any, _f: Any, reason_code: Any, *_a: Any) -> None:
        self.connected = not getattr(reason_code, "is_failure", False)
        log.info("mqtt connected to %s:%s (rc=%s)", self.host, self.port, reason_code)

    def _on_disconnect(self, *_a: Any) -> None:
        self.connected = False
        log.warning("mqtt disconnected, will retry")

    def start(self) -> None:
        self.client.connect_async(self.host, self.port, keepalive=30)
        self.client.loop_start()

    def wait_connected(self, timeout: float = 10.0) -> bool:
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            if self.connected:
                return True
            time.sleep(0.05)
        return self.connected

    # -- publishing ---------------------------------------------------
    def publish(self, message: Mapping[str, Any]) -> str:
        topic = contract.topic_for(message)
        self.client.publish(topic, json.dumps(message), qos=QOS, retain=contract.is_retained(message))
        return topic

    def publish_heartbeat(self, *, fps: float = 0.0, status: str = "online") -> str:
        return self.publish(
            contract.heartbeat_message(
                device_id=self.device_id,
                session_id=self.session_id,
                status=status,
                uptime_sec=int(time.monotonic() - self.started),
                fps=fps,
                source=self.source,
            )
        )

    def close(self) -> None:
        """Graceful stop: say offline explicitly, flush, disconnect."""
        try:
            info = None
            will = contract.heartbeat_message(
                device_id=self.device_id, session_id=self.session_id, status="offline", source=self.source
            )
            info = self.client.publish(contract.topic_for(will), json.dumps(will), qos=QOS, retain=True)
            if info is not None and hasattr(info, "wait_for_publish"):
                info.wait_for_publish(timeout=3)
        except Exception as err:  # noqa: BLE001 - best effort on shutdown
            log.warning("offline heartbeat failed: %s", err)
        self.client.loop_stop()
        self.client.disconnect()
