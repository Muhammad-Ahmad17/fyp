"""Turns model handoffs into published contract messages.

Per frame the model returns a handoff dict (or a list of them, or None). The agent
  - fills `camera_id`, `frame` from its config / the frame when the model omits them,
  - sends an alert for every violation, but not more than once per cooldown for the same
    (event, worker), otherwise a violation that lasts 10 s would produce hundreds of alerts,
  - sends metrics at most every `metrics_every_sec` (from any handoff, so the gauge keeps moving),
  - uploads the evidence frame once, only for alerts that are actually sent,
  - sends a heartbeat every `heartbeat_every_sec`.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping

from . import contract
from .evidence import EvidenceUploader
from .publisher import EdgePublisher

log = logging.getLogger("edge.agent")


@dataclass
class AgentConfig:
    camera_id: str = "cam-01"
    alert_cooldown_sec: float = 10.0
    metrics_every_sec: float = 5.0
    heartbeat_every_sec: float = 10.0


@dataclass
class Stats:
    alerts_sent: int = 0
    alerts_suppressed: int = 0
    metrics_sent: int = 0
    rejected: int = 0
    heartbeats: int = 0
    topics: list[str] = field(default_factory=list)


class Throttle:
    """Allow a key at most once per interval."""

    def __init__(self) -> None:
        self._last: dict[Any, float] = {}

    def allow(self, key: Any, now: float, interval: float) -> bool:
        last = self._last.get(key)
        if last is not None and now - last < interval:
            return False
        self._last[key] = now
        return True


def frame_size(frame: Any) -> dict[str, int] | None:
    shape = getattr(frame, "shape", None)  # numpy / OpenCV frame: (height, width, channels)
    if shape is not None and len(shape) >= 2:
        return {"width": int(shape[1]), "height": int(shape[0])}
    return None


class EdgeAgent:
    def __init__(
        self,
        publisher: EdgePublisher,
        uploader: EvidenceUploader | None = None,
        config: AgentConfig | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.publisher = publisher
        self.uploader = uploader or EvidenceUploader(None)
        self.config = config or AgentConfig()
        self.clock = clock
        self.stats = Stats()
        self._alerts = Throttle()
        self._metrics = Throttle()
        self._heartbeat_at: float | None = None

    def _fill(self, handoff: Mapping[str, Any], frame: Any) -> dict[str, Any]:
        h = dict(handoff)
        h.setdefault("camera_id", self.config.camera_id)
        if "frame" not in h:
            size = frame_size(frame)
            if size:
                h["frame"] = size
        return h

    def _ids(self) -> dict[str, str]:
        return {"device_id": self.publisher.device_id, "session_id": self.publisher.session_id, "source": self.publisher.source}

    def _publish(self, message: Mapping[str, Any]) -> None:
        self.stats.topics.append(self.publisher.publish(message))

    def handle(self, result: Any, frame: Any = None) -> None:
        """`result` is what get_compliance_event(frame) returned."""
        if not result:
            return
        for handoff in result if isinstance(result, list) else [result]:
            self._handle_one(handoff, frame)

    def _handle_one(self, handoff: Mapping[str, Any], frame: Any) -> None:
        h = self._fill(handoff, frame)
        try:
            contract.validate_handoff(h)
        except contract.ContractError as err:
            self.stats.rejected += 1
            log.warning("handoff rejected: %s", err)
            return
        now = self.clock()

        if h["event"] != "compliant":
            key = (h["event"], h.get("worker_id"))
            if self._alerts.allow(key, now, self.config.alert_cooldown_sec):
                if self.uploader.enabled:
                    h["image_path"] = self.uploader.upload(h.get("image_path"))
                try:
                    self._publish(contract.alert_from_handoff(h, **self._ids()))
                    self.stats.alerts_sent += 1
                except contract.ContractError as err:
                    self.stats.rejected += 1
                    log.warning("alert rejected: %s", err)
            else:
                self.stats.alerts_suppressed += 1

        if self._metrics.allow("site", now, self.config.metrics_every_sec):
            self._publish(contract.metrics_from_handoff(h, **self._ids()))
            self.stats.metrics_sent += 1

    def tick(self, fps: float = 0.0) -> None:
        """Call regularly (every frame is fine); sends a heartbeat when due."""
        now = self.clock()
        if self._heartbeat_at is None or now - self._heartbeat_at >= self.config.heartbeat_every_sec:
            self._heartbeat_at = now
            self.stats.topics.append(self.publisher.publish_heartbeat(fps=fps))
            self.stats.heartbeats += 1
