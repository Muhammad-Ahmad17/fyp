import json

from contracts.events import EXAMPLE_ALERT, EXAMPLE_METRICS, SafetyMessageAdapter
from contracts.transport import STREAMS, topic_for
from transport.mqtt_redis_bridge.bridge import handle_message


class FakeRedis:
    def __init__(self) -> None:
        self.streams: dict[str, list[dict[str, str]]] = {}

    def xadd(self, stream: str, fields: dict[str, str]) -> str:
        self.streams.setdefault(stream, []).append(fields)
        return "1-0"


def test_valid_alert_goes_to_alerts_stream() -> None:
    r = FakeRedis()
    msg = SafetyMessageAdapter.validate(EXAMPLE_ALERT)
    assert handle_message(r, topic_for(msg), json.dumps(EXAMPLE_ALERT)) == "ok"
    assert len(r.streams[STREAMS["alert"]]) == 1
    assert STREAMS["dead_letter"] not in r.streams


def test_bad_json_is_dead_lettered() -> None:
    r = FakeRedis()
    assert handle_message(r, "ppe/alerts/HIGH", "{not json") == "dead_letter"
    assert r.streams[STREAMS["dead_letter"]][0]["reason"].startswith("validation_error")


def test_old_zone_topic_is_dead_lettered() -> None:
    r = FakeRedis()
    assert handle_message(r, "ppe/alerts/welding_bay/HIGH", json.dumps(EXAMPLE_ALERT)) == "dead_letter"


def test_metrics_route() -> None:
    r = FakeRedis()
    msg = SafetyMessageAdapter.validate(EXAMPLE_METRICS)
    assert handle_message(r, topic_for(msg), json.dumps(EXAMPLE_METRICS)) == "ok"
    assert STREAMS["metrics"] in r.streams
