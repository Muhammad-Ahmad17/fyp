from __future__ import annotations

import logging
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from services.api.config import SQL_DIR

log = logging.getLogger("api.db")


def connect(database_url: str) -> psycopg.Connection:
    return psycopg.connect(database_url, row_factory=dict_row, autocommit=True)


def migrate(conn: psycopg.Connection) -> None:
    sql = (SQL_DIR / "001_init.sql").read_text()
    conn.execute(sql)
    log.info("database migrated")
