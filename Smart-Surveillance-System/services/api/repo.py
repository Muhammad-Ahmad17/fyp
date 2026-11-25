from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import psycopg
from psycopg.types.json import Json

from contracts.events import ALERT_EVENTS, PRIORITIES, AlertMessage, HeartbeatMessage, MetricsMessage

Conn = psycopg.Connection


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def to_alert_dto(row: dict[str, Any]) -> dict[str, Any]:
    detections = row["detections"]
    if isinstance(detections, str):
        detections = json.loads(detections)
    return {
        "id": str(row["id"]),
        "event_id": str(row["event_id"]),
        "timestamp": _iso(row["timestamp"]),
        "received_at": _iso(row["received_at"]),
        "source": row["source"],
        "device_id": row["device_id"],
        "camera_id": row["camera_id"],
        "session_id": str(row["session_id"]),
        "event": row["event_type"],
        "priority": row["priority"],
        "worker_id": row["worker_id"],
        "confidence": row["confidence"],
        "compliance_score": row["compliance_score"],
        "frame": {"width": row["frame_width"], "height": row["frame_height"]},
        "detections": detections,
        "image_path": row["image_path"],
        "acknowledged": row["acknowledged"],
        "acknowledged_at": _iso(row["acknowledged_at"]),
    }


def to_metrics_dto(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "event_id": str(row["event_id"]),
        "timestamp": _iso(row["time"]),
        "source": row["source"],
        "device_id": row["device_id"],
        "session_id": str(row["session_id"]),
        "compliance_score": row["score"],
        "worker_count": row["worker_count"],
        "violation_count": row["violation_count"],
    }


def to_device_dto(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "device_id": row["device_id"],
        "status": row["status"],
        "source": row["source"],
        "session_id": str(row["session_id"]),
        "uptime_sec": row["uptime_sec"],
        "fps": row["fps"],
        "last_seen": _iso(row["last_seen"]),
    }


def insert_alert(conn: Conn, m: AlertMessage, received_at: datetime | None = None) -> dict[str, Any] | None:
    received_at = received_at or datetime.now(timezone.utc)
    row = conn.execute(
        """
        INSERT INTO violations (
            event_id, timestamp, received_at, source, device_id, camera_id, session_id,
            event_type, priority, worker_id, confidence, compliance_score,
            frame_width, frame_height, detections, image_path
        ) VALUES (
            %(event_id)s, %(timestamp)s, %(received_at)s, %(source)s, %(device_id)s, %(camera_id)s, %(session_id)s,
            %(event_type)s, %(priority)s, %(worker_id)s, %(confidence)s, %(compliance_score)s,
            %(frame_width)s, %(frame_height)s, %(detections)s, %(image_path)s
        )
        ON CONFLICT (event_id) DO NOTHING
        RETURNING *
        """,
        {
            "event_id": str(m.event_id),
            "timestamp": m.timestamp,
            "received_at": received_at,
            "source": m.source.value,
            "device_id": m.device_id,
            "camera_id": m.camera_id,
            "session_id": str(m.session_id),
            "event_type": m.event.value,
            "priority": m.priority.value,
            "worker_id": m.worker_id,
            "confidence": m.confidence,
            "compliance_score": m.compliance_score,
            "frame_width": m.frame.width,
            "frame_height": m.frame.height,
            "detections": Json([d.model_dump(mode="json", by_alias=True) for d in m.detections]),
            "image_path": m.image_path,
        },
    ).fetchone()
    return dict(row) if row else None


def insert_metrics(conn: Conn, m: MetricsMessage, received_at: datetime | None = None) -> dict[str, Any] | None:
    received_at = received_at or datetime.now(timezone.utc)
    row = conn.execute(
        """
        INSERT INTO compliance_metrics (
            event_id, time, received_at, source, device_id, session_id, score, worker_count, violation_count
        ) VALUES (
            %(event_id)s, %(time)s, %(received_at)s, %(source)s, %(device_id)s, %(session_id)s,
            %(score)s, %(worker_count)s, %(violation_count)s
        )
        ON CONFLICT (event_id) DO NOTHING
        RETURNING *
        """,
        {
            "event_id": str(m.event_id),
            "time": m.timestamp,
            "received_at": received_at,
            "source": m.source.value,
            "device_id": m.device_id,
            "session_id": str(m.session_id),
            "score": m.compliance_score,
            "worker_count": m.worker_count,
            "violation_count": m.violation_count,
        },
    ).fetchone()
    return dict(row) if row else None


def upsert_device(conn: Conn, m: HeartbeatMessage) -> dict[str, Any] | None:
    ts = m.timestamp
    offline = m.status.value == "offline"
    row = conn.execute(
        """
        INSERT INTO devices (device_id, status, source, session_id, uptime_sec, fps, last_seen, last_event_id)
        VALUES (%(device_id)s, %(status)s, %(source)s, %(session_id)s, %(uptime_sec)s, %(fps)s, %(last_seen)s, %(last_event_id)s)
        ON CONFLICT (device_id) DO UPDATE SET
            status = EXCLUDED.status,
            source = EXCLUDED.source,
            session_id = EXCLUDED.session_id,
            uptime_sec = EXCLUDED.uptime_sec,
            fps = EXCLUDED.fps,
            last_event_id = EXCLUDED.last_event_id,
            last_seen = CASE WHEN %(offline)s THEN devices.last_seen ELSE EXCLUDED.last_seen END
        WHERE devices.last_seen < EXCLUDED.last_seen
           OR (%(offline)s AND devices.session_id = EXCLUDED.session_id)
        RETURNING *
        """,
        {
            "device_id": m.device_id,
            "status": m.status.value,
            "source": m.source.value,
            "session_id": str(m.session_id),
            "uptime_sec": m.uptime_sec,
            "fps": m.fps,
            "last_seen": ts,
            "last_event_id": str(m.event_id),
            "offline": offline,
        },
    ).fetchone()
    return dict(row) if row else None


def get_alert(conn: Conn, alert_id: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM violations WHERE id = %s", (alert_id,)).fetchone()
    return to_alert_dto(dict(row)) if row else None


def list_alerts(conn: Conn, q: dict[str, Any]) -> dict[str, Any]:
    clauses: list[str] = []
    params: list[Any] = []
    if q.get("priority"):
        clauses.append("priority = %s")
        params.append(q["priority"])
    if q.get("event"):
        clauses.append("event_type = %s")
        params.append(q["event"])
    if q.get("source"):
        clauses.append("source = %s")
        params.append(q["source"])
    if q.get("acknowledged") is not None:
        clauses.append("acknowledged = %s")
        params.append(q["acknowledged"] == "true")
    if q.get("from"):
        clauses.append("timestamp >= %s")
        params.append(q["from"])
    if q.get("to"):
        clauses.append("timestamp <= %s")
        params.append(q["to"])
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    limit = int(q.get("limit") or 50)
    offset = int(q.get("offset") or 0)
    rows = conn.execute(
        f"SELECT * FROM violations {where} ORDER BY timestamp DESC, id DESC LIMIT %s OFFSET %s",
        [*params, limit, offset],
    ).fetchall()
    total = conn.execute(f"SELECT count(*) AS n FROM violations {where}", params).fetchone()["n"]
    return {"items": [to_alert_dto(dict(r)) for r in rows], "total": int(total), "limit": limit, "offset": offset}


def list_devices(conn: Conn) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT * FROM devices ORDER BY device_id").fetchall()
    return [to_device_dto(dict(r)) for r in rows]


def acknowledge_alert(conn: Conn, alert_id: str, now: datetime | None = None) -> dict[str, Any] | None:
    now = now or datetime.now(timezone.utc)
    row = conn.execute(
        """
        UPDATE violations SET acknowledged = true, acknowledged_at = %s
        WHERE id = %s AND acknowledged = false
        RETURNING *
        """,
        (now, alert_id),
    ).fetchone()
    if row:
        return {"alert": to_alert_dto(dict(row)), "changed": True}
    existing = get_alert(conn, alert_id)
    return {"alert": existing, "changed": False} if existing else None


def metrics_summary(conn: Conn, hours: int, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    since = datetime.fromtimestamp(now.timestamp() - hours * 3600, tz=timezone.utc)
    totals = conn.execute(
        """
        SELECT count(*) AS total,
               count(*) FILTER (WHERE priority = 'CRITICAL') AS critical,
               count(*) FILTER (WHERE acknowledged = false) AS unack
        FROM violations WHERE timestamp >= %s
        """,
        (since,),
    ).fetchone()
    by_event = {
        r["event_type"]: int(r["n"])
        for r in conn.execute(
            "SELECT event_type, count(*) AS n FROM violations WHERE timestamp >= %s GROUP BY event_type",
            (since,),
        ).fetchall()
    }
    by_priority = {
        r["priority"]: int(r["n"])
        for r in conn.execute(
            "SELECT priority, count(*) AS n FROM violations WHERE timestamp >= %s GROUP BY priority",
            (since,),
        ).fetchall()
    }
    latest = conn.execute("SELECT * FROM compliance_metrics ORDER BY time DESC LIMIT 1").fetchone()
    return {
        "window_hours": hours,
        "generated_at": _iso(now),
        "alerts_total": int(totals["total"]),
        "alerts_critical": int(totals["critical"]),
        "alerts_unacknowledged": int(totals["unack"]),
        "compliance": {
            "compliance_score": latest["score"] if latest else None,
            "worker_count": latest["worker_count"] if latest else None,
            "violation_count": latest["violation_count"] if latest else None,
            "last_metrics_at": _iso(latest["time"]) if latest else None,
        },
        "by_event": [{"event": e, "count": by_event.get(e, 0)} for e in ALERT_EVENTS],
        "by_priority": [{"priority": p, "count": by_priority.get(p, 0)} for p in PRIORITIES],
        "devices": list_devices(conn),
    }


def metrics_trend(conn: Conn, hours: int, bucket: str, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    since = datetime.fromtimestamp(now.timestamp() - hours * 3600, tz=timezone.utc)
    trunc = "hour" if bucket == "hour" else "minute"
    rows = conn.execute(
        f"""
        SELECT date_trunc('{trunc}', time) AS bucket, avg(score) AS score
        FROM compliance_metrics
        WHERE time >= %s
        GROUP BY 1
        ORDER BY 1
        """,
        (since,),
    ).fetchall()
    return {
        "window_hours": hours,
        "bucket": trunc,
        "points": [
            {"bucket": _iso(r["bucket"]), "compliance_score": round(float(r["score"]) * 10) / 10}
            for r in rows
        ],
    }
