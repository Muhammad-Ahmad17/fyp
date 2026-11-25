from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

SQL_DIR = Path(__file__).resolve().parent / "sql"


@dataclass
class Config:
    port: int = int(os.getenv("PORT", "3000"))
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgres://intellisafe:intellisafe@localhost:5432/intellisafe",
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    mqtt_host: str = os.getenv("MQTT_HOST", "localhost")
    mqtt_port: int = int(os.getenv("MQTT_PORT", "1883"))
    mqtt_username: str = os.getenv("MQTT_USERNAME") or ""
    mqtt_password: str = os.getenv("MQTT_PASSWORD") or ""
    mqtt_url: str = os.getenv("MQTT_URL", "")
    enable_simulate: bool = os.getenv("ENABLE_SIMULATE", "true").lower() not in ("0", "false", "no")
    evidence_dir: str = os.getenv("EVIDENCE_DIR", str(Path(__file__).resolve().parents[2] / "edge" / "inference"))
    evidence_upload_token: str = os.getenv("EVIDENCE_UPLOAD_TOKEN") or ""
    cors_origin: str = os.getenv("CORS_ORIGIN") or ""
    log_level: str = os.getenv("LOG_LEVEL", "info")


def load_config() -> Config:
    cfg = Config()
    if cfg.mqtt_url.startswith("mqtt://") or cfg.mqtt_url.startswith("mqtts://"):
        from urllib.parse import urlparse

        parsed = urlparse(cfg.mqtt_url)
        cfg.mqtt_host = parsed.hostname or cfg.mqtt_host
        cfg.mqtt_port = parsed.port or cfg.mqtt_port
    return cfg
