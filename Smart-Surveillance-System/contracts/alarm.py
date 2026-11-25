"""Site emergency alarm command (MQTT `ppe/alarm`).

This is not a SafetyMessage. The bridge must ignore the topic so it does not
dead-letter the retained alarm command. Fire and smoke turn the siren on;
the dashboard (or a later ESP32 button) silences it.

No zone: camera_id says which camera saw the hazard.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import Field

from contracts.events import StrictModel

ALARM_TOPIC = "ppe/alarm"
ALARM_REASONS = ("fire", "smoke")
ALARM_COMMANDS = ("on", "off", "silence")
ALARM_STATES = ("idle", "sounding", "silenced")


class AlarmCommand(StrictModel):
    cmd: Literal["on", "off", "silence"]
    reason: Optional[Literal["fire", "smoke"]] = None
    camera_id: Optional[str] = Field(default=None, min_length=1, max_length=64)
    event_id: Optional[str] = None
