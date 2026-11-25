"""Edge agent CLI.

    python -m edge.agent                              # stub model, synthetic frames (pipeline test)
    python -m edge.agent --source webcam              # laptop camera, stub model
    python -m edge.agent --source webcam --model edge.inference.model     # Uzair's model
    python -m edge.agent --source video:clip.mp4 --model edge.inference.model

Configuration (environment variables, all optional):
    MQTT_URL (mqtt://localhost:1883)  MQTT_USERNAME  MQTT_PASSWORD
    EDGE_DEVICE_ID (jetson-01)  EDGE_CAMERA_ID (cam-01)
    EVIDENCE_UPLOAD_URL (e.g. http://localhost:3000/api/evidence)  EVIDENCE_UPLOAD_TOKEN
    EDGE_ALERT_COOLDOWN_SEC (10)  EDGE_METRICS_EVERY_SEC (5)  EDGE_HEARTBEAT_EVERY_SEC (10)  EDGE_FPS (5)
"""

from __future__ import annotations

import argparse
import importlib
import logging
import os
import signal
import time
import uuid
from typing import Any, Callable, Iterator

from .agent import AgentConfig, EdgeAgent
from .evidence import EvidenceUploader
from .publisher import EdgePublisher

log = logging.getLogger("edge")


def frames(source: str, fps: float) -> Iterator[Any]:
    """Yields frames. `stub` yields None at `fps`; webcam / video need OpenCV (pip install opencv-python)."""
    if source == "stub":
        while True:
            time.sleep(1.0 / fps)
            yield None
    try:
        import cv2  # type: ignore[import-not-found]  # noqa: PLC0415 - optional dependency
    except ImportError as err:
        raise SystemExit("OpenCV is required for camera/video sources: pip install opencv-python") from err
    if source == "webcam":
        cap = cv2.VideoCapture(0)
    elif source.startswith("cam:"):
        cap = cv2.VideoCapture(int(source[4:]))
    elif source.startswith("video:"):
        cap = cv2.VideoCapture(source[6:])
    else:
        raise SystemExit(f"unknown --source {source!r} (stub | webcam | cam:N | video:PATH)")
    if not cap.isOpened():
        raise SystemExit(f"cannot open source {source!r}")
    try:
        min_gap = 1.0 / fps
        last = 0.0
        while True:
            ok, frame = cap.read()
            if not ok:
                return
            now = time.monotonic()
            if now - last < min_gap:  # run the model at most `fps` times per second
                continue
            last = now
            yield frame
    finally:
        cap.release()


def load_model(path: str) -> Callable[[Any], Any]:
    module = importlib.import_module(path)
    fn = getattr(module, "get_compliance_event", None)
    if not callable(fn):
        raise SystemExit(f"{path} must expose get_compliance_event(frame) -> dict | list[dict] | None")
    return fn


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m edge.agent", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--source", default="stub")
    p.add_argument("--model", default="edge.agent.stub_model", help="module exposing get_compliance_event(frame)")
    p.add_argument("--duration", type=float, default=0, help="stop after N seconds (0 = run until Ctrl-C)")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

    env = os.environ.get
    fps = float(env("EDGE_FPS", "5"))
    publisher = EdgePublisher(
        device_id=env("EDGE_DEVICE_ID", "jetson-01") or "jetson-01",
        session_id=str(uuid.uuid4()),
        mqtt_url=env("MQTT_URL", "mqtt://localhost:1883") or "mqtt://localhost:1883",
        username=env("MQTT_USERNAME") or None,
        password=env("MQTT_PASSWORD") or None,
    )
    agent = EdgeAgent(
        publisher,
        EvidenceUploader(env("EVIDENCE_UPLOAD_URL") or None, env("EVIDENCE_UPLOAD_TOKEN") or None),
        AgentConfig(
            camera_id=env("EDGE_CAMERA_ID", "cam-01") or "cam-01",
            alert_cooldown_sec=float(env("EDGE_ALERT_COOLDOWN_SEC", "10")),
            metrics_every_sec=float(env("EDGE_METRICS_EVERY_SEC", "5")),
            heartbeat_every_sec=float(env("EDGE_HEARTBEAT_EVERY_SEC", "10")),
        ),
    )
    get_event = load_model(args.model)

    stop = False

    def _stop(*_a: Any) -> None:
        nonlocal stop
        stop = True

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    publisher.start()
    if not publisher.wait_connected(10):
        log.warning("MQTT not reachable yet at %s:%s, will keep retrying", publisher.host, publisher.port)
    log.info("agent started: device=%s camera=%s source=%s model=%s", publisher.device_id, agent.config.camera_id, args.source, args.model)

    started = time.monotonic()
    count = 0
    try:
        for frame in frames(args.source, fps):
            if stop or (args.duration and time.monotonic() - started >= args.duration):
                break
            count += 1
            agent.handle(get_event(frame), frame)
            agent.tick(fps=count / max(time.monotonic() - started, 1e-6))
    finally:
        publisher.close()
        s = agent.stats
        log.info("stopped: frames=%d alerts=%d (suppressed %d) metrics=%d heartbeats=%d rejected=%d", count, s.alerts_sent, s.alerts_suppressed, s.metrics_sent, s.heartbeats, s.rejected)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
