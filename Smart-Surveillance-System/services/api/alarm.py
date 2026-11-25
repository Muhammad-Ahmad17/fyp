"""Software emergency alarm.

Publishes retained commands on `ppe/alarm` so a later ESP32 can subscribe.
Until that hardware exists, this process is the alarm unit: fire/smoke sound it,
the dashboard silences it.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Literal

from contracts.alarm import ALARM_TOPIC, AlarmCommand
from contracts.transport import LIVE_CHANNEL

log = logging.getLogger("api.alarm")

State = Literal["idle", "sounding", "silenced"]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


class AlarmService:
    def __init__(self, publisher: Any, redis_client: Any | None = None) -> None:
        self.publisher = publisher
        self.redis = redis_client
        self.state: State = "idle"
        self.reason: str | None = None
        self.camera_id: str | None = None
        self.event_id: str | None = None
        self.updated_at: datetime = _utc_now()
        self.unit: str = "virtual"

    def snapshot(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "reason": self.reason,
            "camera_id": self.camera_id,
            "event_id": self.event_id,
            "unit": self.unit,
            "updated_at": _iso(self.updated_at),
        }

    def on_alert(self, dto: dict[str, Any]) -> None:
        if dto.get("event") not in ("fire", "smoke"):
            return
        if dto.get("priority") != "CRITICAL":
            return
        self.sound(
            reason=str(dto["event"]),
            camera_id=dto.get("camera_id"),
            event_id=dto.get("event_id"),
        )

    def sound(self, reason: str, camera_id: str | None = None, event_id: str | None = None) -> dict[str, Any]:
        if self.state == "silenced":
            return self.snapshot()
        cmd = AlarmCommand(cmd="on", reason=reason, camera_id=camera_id, event_id=event_id)
        return self._apply(cmd)

    def silence(self) -> dict[str, Any]:
        if self.state != "sounding":
            return self.snapshot()
        return self._apply(AlarmCommand(cmd="silence", reason=self.reason, camera_id=self.camera_id, event_id=self.event_id))

    def clear(self) -> dict[str, Any]:
        return self._apply(AlarmCommand(cmd="off"))

    def _apply(self, cmd: AlarmCommand) -> dict[str, Any]:
        if cmd.cmd == "on":
            self.state = "sounding"
            self.reason = cmd.reason
            self.camera_id = cmd.camera_id
            self.event_id = cmd.event_id
        elif cmd.cmd == "silence":
            self.state = "silenced"
        else:
            self.state = "idle"
            self.reason = None
            self.camera_id = None
            self.event_id = None
        self.updated_at = _utc_now()
        payload = cmd.model_dump(mode="json")
        try:
            self.publisher.publish_json(ALARM_TOPIC, payload, retain=True)
        except Exception as err:  # noqa: BLE001
            log.warning("alarm MQTT publish failed: %s", err)
        self._broadcast()
        log.info("alarm %s reason=%s camera=%s", self.state, self.reason, self.camera_id)
        return self.snapshot()

    def _broadcast(self) -> None:
        if not self.redis:
            return
        try:
            self.redis.publish(LIVE_CHANNEL, json.dumps({"kind": "alarm", "data": self.snapshot()}))
        except Exception as err:  # noqa: BLE001
            log.warning("alarm live publish failed: %s", err)
