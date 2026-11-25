from __future__ import annotations

import json
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Any

import psycopg
import redis
from pydantic import ValidationError

from contracts.events import AlertMessage, HeartbeatMessage, MetricsMessage, SafetyMessageAdapter
from contracts.transport import LIVE_CHANNEL, STREAMS
from services.api import repo

log = logging.getLogger("api.consumer")

STREAM_TYPES = {
    STREAMS["alert"]: "alert",
    STREAMS["metrics"]: "metrics",
    STREAMS["heartbeat"]: "heartbeat",
}
STREAM_LIST = list(STREAM_TYPES)


class AlertConsumer:
    def __init__(
        self,
        db: psycopg.Connection,
        redis_client: redis.Redis,
        group: str = "alert-svc",
        consumer: str = "api-1",
        block_ms: int = 2000,
        batch_size: int = 50,
        max_attempts: int = 5,
        on_alert: Any | None = None,
    ) -> None:
        self.db = db
        self.redis = redis_client
        self.group = group
        self.consumer = consumer
        self.block_ms = block_ms
        self.batch_size = batch_size
        self.max_attempts = max_attempts
        self.on_alert = on_alert
        self.failures: dict[str, int] = {}
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def ensure_groups(self) -> None:
        for stream in STREAM_LIST:
            try:
                self.redis.xgroup_create(stream, self.group, id="0", mkstream=True)
            except redis.ResponseError as err:
                if "BUSYGROUP" not in str(err):
                    raise

    def start(self) -> None:
        self.ensure_groups()
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="alert-consumer", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)

    def poll_once(self, mode: str = "new") -> dict[str, int]:
        ids = [">" if mode == "new" else "0"] * len(STREAM_LIST)
        kwargs: dict[str, Any] = {"groupname": self.group, "consumername": self.consumer, "count": self.batch_size, "block": self.block_ms if mode == "new" and self.block_ms > 0 else None}
        result = self.redis.xreadgroup(self.group, self.consumer, {s: (">" if mode == "new" else "0") for s in STREAM_LIST}, count=self.batch_size, block=kwargs["block"])
        processed = 0
        failed = 0
        for stream, entries in result or []:
            for entry_id, fields in entries:
                processed += 1
                key = f"{stream}:{entry_id}"
                try:
                    self.process_entry(stream, entry_id, fields)
                    self.failures.pop(key, None)
                except Exception as err:  # noqa: BLE001
                    n = self.failures.get(key, 0) + 1
                    self.failures[key] = n
                    log.error("processing failed stream=%s id=%s attempt=%s err=%s", stream, entry_id, n, err)
                    if n >= self.max_attempts:
                        self._dead_letter(stream, entry_id, fields, f"processing_failed: {err}")
                        self.redis.xack(stream, self.group, entry_id)
                        self.failures.pop(key, None)
                    else:
                        failed += 1
        return {"processed": processed, "failed": failed}

    def process_entry(self, stream: str, entry_id: str, fields: dict[str, str]) -> str:
        try:
            data = json.loads(fields.get("payload") or "")
            msg = SafetyMessageAdapter.validate(data)
        except (json.JSONDecodeError, ValidationError, ValueError) as err:
            self._dead_letter(stream, entry_id, fields, f"validation_error: {err}")
            self.redis.xack(stream, self.group, entry_id)
            return "dead_lettered"
        if STREAM_TYPES.get(stream) != msg.type:
            self._dead_letter(stream, entry_id, fields, f"wrong_stream: {msg.type} in {stream}")
            self.redis.xack(stream, self.group, entry_id)
            return "dead_lettered"

        received = fields.get("received_at")
        received_at = datetime.fromisoformat(received.replace("Z", "+00:00")) if received else datetime.now(timezone.utc)
        live: dict[str, Any] | None = None
        outcome = "duplicate"
        if isinstance(msg, AlertMessage):
            row = repo.insert_alert(self.db, msg, received_at)
            if row:
                dto = repo.to_alert_dto(row)
                live = {"kind": "alert", "data": dto}
                outcome = "stored"
                if self.on_alert:
                    try:
                        self.on_alert(dto)
                    except Exception as err:  # noqa: BLE001
                        log.warning("alarm hook failed: %s", err)
        elif isinstance(msg, MetricsMessage):
            row = repo.insert_metrics(self.db, msg, received_at)
            if row:
                live = {"kind": "metrics", "data": repo.to_metrics_dto(row)}
                outcome = "stored"
        elif isinstance(msg, HeartbeatMessage):
            row = repo.upsert_device(self.db, msg)
            if row:
                live = {"kind": "heartbeat", "data": repo.to_device_dto(row)}
                outcome = "stored"
            else:
                outcome = "stale"

        self.redis.xack(stream, self.group, entry_id)
        if live:
            try:
                self.redis.publish(LIVE_CHANNEL, json.dumps(live))
            except Exception as err:  # noqa: BLE001
                log.warning("live publish failed: %s", err)
        return outcome

    def _dead_letter(self, stream: str, entry_id: str, fields: dict[str, str], reason: str) -> None:
        self.redis.xadd(
            STREAMS["dead_letter"],
            {
                "topic": fields.get("topic") or stream,
                "payload": (fields.get("payload") or "")[:4000],
                "reason": f"consumer:{reason}",
                "received_at": datetime.now(timezone.utc).isoformat(),
                "source_entry": f"{stream}:{entry_id}",
            },
        )
        log.warning("dead-lettered %s:%s %s", stream, entry_id, reason)

    def _loop(self) -> None:
        recover = True
        backoff = 0.5
        while not self._stop.is_set():
            try:
                if recover:
                    r = self.poll_once("pending")
                    if r["failed"] > 0:
                        time.sleep(backoff)
                        backoff = min(backoff * 2, 10)
                    elif r["processed"] == 0:
                        recover = False
                        backoff = 0.5
                    continue
                r = self.poll_once("new")
                if r["failed"] > 0:
                    recover = True
            except Exception as err:  # noqa: BLE001
                if self._stop.is_set():
                    break
                log.error("consumer loop error: %s", err)
                recover = True
                time.sleep(backoff)
                backoff = min(backoff * 2, 10)
