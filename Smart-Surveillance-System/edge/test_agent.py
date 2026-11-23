"""Tests for the edge agent (no broker needed: MQTT and clock are faked)."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

import pytest

from edge.agent import contract, stub_model
from edge.agent.agent import AgentConfig, EdgeAgent
from edge.agent.evidence import EvidenceUploader
from edge.agent.publisher import EdgePublisher, parse_mqtt_url

FIXTURES = json.loads((Path(__file__).resolve().parents[1] / "contracts" / "fixtures" / "handoff_cases.json").read_text())
SESSION = "0c9a7d3e-51b2-4f60-8a0e-3d9f6b2c1e44"
IDS = {"device_id": "jetson-01", "session_id": SESSION, "source": "edge"}


class FakeMqtt:
    def __init__(self) -> None:
        self.published: list[tuple[str, dict[str, Any], int, bool]] = []
        self.will: tuple[str, dict[str, Any], int, bool] | None = None
        self.creds: tuple[str, str | None] | None = None

    def username_pw_set(self, user: str, pw: str | None) -> None:
        self.creds = (user, pw)

    def will_set(self, topic: str, payload: str, qos: int, retain: bool) -> None:
        self.will = (topic, json.loads(payload), qos, retain)

    def max_queued_messages_set(self, _n: int) -> None: ...
    def reconnect_delay_set(self, **_k: Any) -> None: ...

    def publish(self, topic: str, payload: str, qos: int = 0, retain: bool = False) -> Any:
        self.published.append((topic, json.loads(payload), qos, retain))
        return None

    def loop_stop(self) -> None: ...
    def disconnect(self) -> None: ...


class Clock:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


def make_agent(**cfg: Any) -> tuple[EdgeAgent, FakeMqtt, Clock]:
    fake, clock = FakeMqtt(), Clock()
    pub = EdgePublisher(device_id="jetson-01", session_id=SESSION, client=fake)
    agent = EdgeAgent(pub, config=AgentConfig(**cfg), clock=clock)
    return agent, fake, clock


def handoff(event: str = "helmet_missing", **over: Any) -> dict[str, Any]:
    h: dict[str, Any] = {
        "event": event,
        "camera_id": "cam-01",
        "worker_id": 7,
        "compliance_score": 78.0,
        "confidence": 0.92,
        "frame": {"width": 1280, "height": 720},
        "detections": [],
    }
    h.update(over)
    return h


# -- contract: golden cases shared with the TypeScript platform ---------------
@pytest.mark.parametrize("case", FIXTURES["cases"], ids=lambda c: c["name"])
def test_golden_cases(case: dict[str, Any]) -> None:
    h, expect = case["handoff"], case["expect"]
    build = contract.metrics_from_handoff if h.get("event") == "compliant" else contract.alert_from_handoff
    if expect.get("error"):
        with pytest.raises(contract.ContractError):
            build(h, **IDS)
        return
    msg = build(h, **IDS)
    assert msg["type"] == expect["type"]
    assert contract.topic_for(msg) == expect["topic"]
    if msg["type"] == "alert":
        assert msg["priority"] == expect["priority"]
        assert msg["worker_id"] == expect["worker_id"]
    else:
        assert msg["worker_count"] == expect["worker_count"]
        assert msg["violation_count"] == expect["violation_count"]
        assert msg["compliance_score"] == expect["compliance_score"]


def test_metrics_can_be_built_from_a_violation_handoff() -> None:
    msg = contract.metrics_from_handoff(handoff("helmet_missing"), **IDS)
    assert msg["violation_count"] == 1 and msg["type"] == "metrics"


def test_compliant_is_never_an_alert() -> None:
    with pytest.raises(contract.ContractError):
        contract.alert_from_handoff(handoff("compliant", worker_id=None), **IDS)


def test_heartbeat_is_valid_and_retained() -> None:
    hb = contract.heartbeat_message(device_id="jetson-01", session_id=SESSION, uptime_sec=12, fps=4.5)
    assert contract.topic_for(hb) == "ppe/heartbeat/jetson-01"
    assert contract.is_retained(hb)


def test_timestamp_format() -> None:
    assert contract.iso_now().endswith("Z") and len(contract.iso_now()) == 24


# -- publisher -----------------------------------------------------------------
def test_parse_mqtt_url() -> None:
    assert parse_mqtt_url("mqtt://broker:1884") == ("broker", 1884, False)
    assert parse_mqtt_url("mqtt://broker") == ("broker", 1883, False)
    assert parse_mqtt_url("mqtts://broker") == ("broker", 8883, True)
    with pytest.raises(ValueError):
        parse_mqtt_url("http://nope")


def test_last_will_is_a_retained_offline_heartbeat() -> None:
    _, fake, _ = make_agent()
    assert fake.will is not None
    topic, payload, qos, retain = fake.will
    assert topic == "ppe/heartbeat/jetson-01" and qos == 1 and retain is True
    assert payload["status"] == "offline" and payload["type"] == "heartbeat"
    contract.validate_message(payload)


def test_close_publishes_offline() -> None:
    agent, fake, _ = make_agent()
    agent.publisher.close()
    assert fake.published[-1][1]["status"] == "offline"


def test_credentials_are_forwarded() -> None:
    fake = FakeMqtt()
    EdgePublisher(device_id="d", session_id=SESSION, client=fake, username="u", password="p")
    assert fake.creds == ("u", "p")


# -- agent ---------------------------------------------------------------------
def kinds(fake: FakeMqtt) -> list[str]:
    return [m["type"] for _, m, _, _ in fake.published]


def test_violation_sends_alert_and_metrics_with_qos1() -> None:
    agent, fake, _ = make_agent()
    agent.handle(handoff("fire", worker_id=None))
    assert kinds(fake) == ["alert", "metrics"]
    assert all(qos == 1 for _, _, qos, _ in fake.published)
    topic, alert, _, retain = fake.published[0]
    assert topic == "ppe/alerts/CRITICAL" and retain is False
    assert alert["source"] == "edge" and alert["device_id"] == "jetson-01"


def test_alert_cooldown_suppresses_repeats_per_worker() -> None:
    agent, fake, clock = make_agent(alert_cooldown_sec=10, metrics_every_sec=1000)
    agent.handle(handoff(worker_id=7))
    clock.t += 3
    agent.handle(handoff(worker_id=7))  # same worker, within cooldown -> suppressed
    agent.handle(handoff(worker_id=8))  # different worker -> sent
    clock.t += 8
    agent.handle(handoff(worker_id=7))  # cooldown over -> sent
    assert kinds(fake).count("alert") == 3
    assert agent.stats.alerts_suppressed == 1


def test_metrics_are_throttled() -> None:
    agent, fake, clock = make_agent(metrics_every_sec=5)
    agent.handle(handoff("compliant", worker_id=None, compliance_score=95))
    clock.t += 1
    agent.handle(handoff("compliant", worker_id=None, compliance_score=96))
    assert kinds(fake) == ["metrics"]
    clock.t += 5
    agent.handle(handoff("compliant", worker_id=None, compliance_score=97))
    assert kinds(fake) == ["metrics", "metrics"]


def test_missing_camera_and_frame_are_filled_from_config() -> None:
    class Frame:
        shape = (480, 640, 3)

    agent, fake, _ = make_agent(camera_id="cam-lab")
    agent.handle({"event": "smoke", "compliance_score": 50, "confidence": 0.9}, Frame())
    alert = fake.published[0][1]
    assert alert["camera_id"] == "cam-lab"
    assert alert["frame"] == {"width": 640, "height": 480}


def test_invalid_handoff_is_dropped_not_published() -> None:
    agent, fake, _ = make_agent()
    agent.handle({"event": "fire", "priority": "LOW"})  # edge must not send priority
    agent.handle(handoff("helmet_missing", worker_id=None))  # PPE needs a worker
    assert fake.published == [] or kinds(fake) == ["metrics"]
    assert agent.stats.rejected >= 1 and agent.stats.alerts_sent == 0


def test_list_and_none_results() -> None:
    agent, fake, _ = make_agent(metrics_every_sec=0)
    agent.handle(None)
    agent.handle([])
    agent.handle([handoff("fire", worker_id=None), handoff("smoke", worker_id=None)])
    assert kinds(fake).count("alert") == 2


def test_heartbeat_is_sent_when_due() -> None:
    agent, fake, clock = make_agent(heartbeat_every_sec=10)
    agent.tick(fps=5)
    agent.tick(fps=5)
    clock.t += 10
    agent.tick(fps=5)
    hb = [m for _, m, _, _ in fake.published if m["type"] == "heartbeat"]
    assert len(hb) == 2 and hb[0]["fps"] == 5
    assert all(r for _, m, _, r in fake.published if m["type"] == "heartbeat")


def test_stub_model_output_is_always_a_valid_handoff() -> None:
    for _ in range(300):
        h = stub_model.get_compliance_event(None)
        assert h is not None
        h = {**h, "camera_id": "cam-01"}
        contract.validate_handoff(h)
        if h["event"] != "compliant":
            contract.alert_from_handoff(h, **IDS)


# -- evidence upload -----------------------------------------------------------
class _Upload(BaseHTTPRequestHandler):
    received: dict[str, Any] = {}

    def do_POST(self) -> None:  # noqa: N802
        body = self.rfile.read(int(self.headers["content-length"]))
        _Upload.received = {"len": len(body), "type": self.headers["content-type"], "key": self.headers.get("x-api-key")}
        out = json.dumps({"image_path": "uploads/abc.png"}).encode()
        self.send_response(201)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, *_a: Any) -> None: ...


@pytest.fixture
def upload_server() -> Any:
    srv = HTTPServer(("127.0.0.1", 0), _Upload)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_port}/api/evidence"
    srv.shutdown()


def test_evidence_is_uploaded_and_image_path_rewritten(upload_server: str) -> None:
    fake, clock = FakeMqtt(), Clock()
    pub = EdgePublisher(device_id="jetson-01", session_id=SESSION, client=fake)
    agent = EdgeAgent(pub, EvidenceUploader(upload_server, "secret"), AgentConfig(), clock=clock)
    agent.handle(handoff("fire", worker_id=None, image_path=str(stub_model.SAMPLES / "sample_fire.png")))
    alert = fake.published[0][1]
    assert alert["image_path"] == "uploads/abc.png"
    assert _Upload.received["type"] == "image/png" and _Upload.received["key"] == "secret" and _Upload.received["len"] > 100


def test_failed_upload_still_sends_the_alert_without_image() -> None:
    fake = FakeMqtt()
    pub = EdgePublisher(device_id="jetson-01", session_id=SESSION, client=fake)
    agent = EdgeAgent(pub, EvidenceUploader("http://127.0.0.1:1/api/evidence", timeout=0.5), AgentConfig(), clock=Clock())
    agent.handle(handoff("fire", worker_id=None, image_path=str(stub_model.SAMPLES / "sample_fire.png")))
    assert fake.published[0][1]["image_path"] is None


def test_uploader_ignores_missing_files() -> None:
    assert EvidenceUploader("http://x/y").upload("/nope/missing.jpg") is None
    assert EvidenceUploader(None).upload("whatever.jpg") is None
