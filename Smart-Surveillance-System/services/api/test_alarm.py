from contracts.alarm import ALARM_TOPIC, AlarmCommand
from services.api.alarm import AlarmService
from transport.mqtt_redis_bridge.bridge import handle_message


class FakePub:
    def __init__(self) -> None:
        self.sent: list[tuple[str, dict, bool]] = []

    def publish_json(self, topic: str, payload: dict, retain: bool = False) -> None:
        self.sent.append((topic, payload, retain))


class FakeRedis:
    def __init__(self) -> None:
        self.streams: dict[str, list] = {}
        self.published: list[tuple[str, str]] = []

    def xadd(self, stream: str, fields: dict) -> str:
        self.streams.setdefault(stream, []).append(fields)
        return "1-0"

    def publish(self, channel: str, message: str) -> int:
        self.published.append((channel, message))
        return 1


def test_fire_sounds_alarm_and_publishes_retained_on() -> None:
    pub = FakePub()
    alarm = AlarmService(pub, FakeRedis())
    alarm.on_alert({"event": "fire", "priority": "CRITICAL", "camera_id": "cam-01", "event_id": "e1"})
    assert alarm.snapshot()["state"] == "sounding"
    assert alarm.snapshot()["reason"] == "fire"
    topic, payload, retain = pub.sent[-1]
    assert topic == ALARM_TOPIC
    assert payload["cmd"] == "on"
    assert retain is True


def test_ppe_does_not_sound_alarm() -> None:
    alarm = AlarmService(FakePub())
    alarm.on_alert({"event": "helmet_missing", "priority": "HIGH", "camera_id": "cam-01"})
    assert alarm.snapshot()["state"] == "idle"


def test_silence_then_clear() -> None:
    alarm = AlarmService(FakePub())
    alarm.sound("smoke", camera_id="cam-02")
    assert alarm.silence()["state"] == "silenced"
    alarm.on_alert({"event": "fire", "priority": "CRITICAL", "camera_id": "cam-01", "event_id": "e2"})
    assert alarm.snapshot()["state"] == "silenced"
    assert alarm.clear()["state"] == "idle"
    assert alarm.snapshot()["reason"] is None


def test_bridge_ignores_alarm_topic() -> None:
    r = FakeRedis()
    raw = AlarmCommand(cmd="on", reason="fire", camera_id="cam-01").model_dump_json()
    assert handle_message(r, ALARM_TOPIC, raw) == "ignored"
    assert r.streams == {}
