from __future__ import annotations

import asyncio
import json
import logging
import time

import redis
import uvicorn

from contracts.transport import LIVE_CHANNEL
from services.api.alarm import AlarmService
from services.api.app import LiveHub, create_app
from services.api.config import load_config
from services.api.consumer import AlertConsumer
from services.api.db import connect, migrate
from services.api.mqtt_pub import EventPublisher

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("api")


def wait_postgres(url: str, attempts: int = 30):
    last: Exception | None = None
    for n in range(1, attempts + 1):
        try:
            conn = connect(url)
            migrate(conn)
            log.info("database ready")
            return conn
        except Exception as err:  # noqa: BLE001
            last = err
            log.warning("database not ready (attempt %s): %s", n, err)
            time.sleep(1)
    raise RuntimeError(f"postgres unavailable: {last}")


async def relay_live(redis_url: str, live: LiveHub, stop: asyncio.Event) -> None:
    pubsub = redis.Redis.from_url(redis_url, decode_responses=True).pubsub()
    pubsub.subscribe(LIVE_CHANNEL)
    log.info("subscribed to %s", LIVE_CHANNEL)
    while not stop.is_set():
        message = pubsub.get_message(ignore_subscribe_messages=True, timeout=0.5)
        if message and message.get("type") == "message":
            data = message.get("data")
            if isinstance(data, str):
                await live.broadcast(data)
        else:
            await asyncio.sleep(0.05)


def main() -> None:
    cfg = load_config()
    logging.getLogger().setLevel(cfg.log_level.upper())
    db = wait_postgres(cfg.database_url)
    r = redis.Redis.from_url(cfg.redis_url, decode_responses=True)
    publisher = EventPublisher(cfg.mqtt_host, cfg.mqtt_port, cfg.mqtt_username, cfg.mqtt_password)
    publisher.start()
    live = LiveHub()
    alarm = AlarmService(publisher, r)
    app = create_app(cfg, db, r, publisher, live, alarm)
    consumer = AlertConsumer(db, r, on_alert=alarm.on_alert)
    consumer.start()

    config = uvicorn.Config(app, host="0.0.0.0", port=cfg.port, log_level=cfg.log_level)
    server = uvicorn.Server(config)

    async def run() -> None:
        stop = asyncio.Event()
        relay = asyncio.create_task(relay_live(cfg.redis_url, live, stop))
        try:
            await server.serve()
        finally:
            stop.set()
            relay.cancel()
            consumer.stop()
            publisher.stop()
            db.close()

    asyncio.run(run())


if __name__ == "__main__":
    main()
