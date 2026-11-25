from __future__ import annotations

import hmac
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json

from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from contracts.events import ALERT_EVENTS, PRIORITIES, SOURCES
from contracts.generator import SimulateRequest, create_context, generate_from_request
from contracts.transport import LIVE_CHANNEL
from services.api import repo
from services.api.alarm import AlarmService
from services.api.config import Config
from services.api.reports import build_report_pdf

log = logging.getLogger("api")
MAX_EVIDENCE_BYTES = 5 * 1024 * 1024


class HttpError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        self.status = status
        self.code = code
        super().__init__(message)


def _png_or_jpg(body: bytes) -> str | None:
    if len(body) > 8 and body[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if len(body) > 3 and body[0] == 0xFF and body[1] == 0xD8 and body[2] == 0xFF:
        return "jpg"
    return None


class LiveHub:
    def __init__(self) -> None:
        self.clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.append(ws)
        await ws.send_json({"kind": "hello", "server_time": datetime.now(timezone.utc).isoformat()})

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.clients:
            self.clients.remove(ws)

    async def broadcast(self, raw: str) -> None:
        dead: list[WebSocket] = []
        for ws in list(self.clients):
            try:
                await ws.send_text(raw)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


def create_app(
    cfg: Config,
    db: Any,
    redis_client: Any,
    publisher: Any,
    live: LiveHub | None = None,
    alarm: AlarmService | None = None,
) -> FastAPI:
    app = FastAPI(title="IntelliSafe API", version="1.0.0")
    live = live or LiveHub()
    alarm = alarm or AlarmService(publisher, redis_client)
    app.state.db = db
    app.state.redis = redis_client
    app.state.publisher = publisher
    app.state.live = live
    app.state.alarm = alarm
    app.state.cfg = cfg
    mock = create_context(device_id="dashboard-sim")

    origins = [o.strip() for o in cfg.cors_origin.split(",") if o.strip()]
    if origins:
        app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])

    @app.exception_handler(HttpError)
    async def http_error(_req: Request, err: HttpError) -> JSONResponse:
        return JSONResponse({"error": err.code, "message": str(err)}, status_code=err.status)

    @app.exception_handler(ValidationError)
    async def validation_error(_req: Request, err: ValidationError) -> JSONResponse:
        return JSONResponse(
            {"error": "validation_error", "issues": [{"path": ".".join(str(p) for p in i["loc"]), "message": i["msg"]} for i in err.errors()]},
            status_code=400,
        )

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        checks = {"db": "ok", "redis": "ok", "mqtt": "connected" if publisher.is_connected() else "disconnected"}
        try:
            db.execute("SELECT 1")
        except Exception:  # noqa: BLE001
            checks["db"] = "error"
        try:
            redis_client.ping()
        except Exception:  # noqa: BLE001
            checks["redis"] = "error"
        healthy = checks["db"] == "ok" and checks["redis"] == "ok"
        status = "unavailable" if not healthy else ("ok" if checks["mqtt"] == "connected" else "degraded")
        return JSONResponse(
            {"status": status, "service": "api", "time": datetime.now(timezone.utc).isoformat(), "checks": checks},
            status_code=200 if healthy else 503,
        )

    @app.get("/api/alerts")
    def alerts(
        priority: str | None = None,
        event: str | None = None,
        source: str | None = None,
        acknowledged: str | None = None,
        from_: str | None = Query(None, alias="from"),
        to: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict[str, Any]:
        if priority and priority not in PRIORITIES:
            raise HttpError(400, "validation_error", "invalid priority")
        if event and event not in ALERT_EVENTS:
            raise HttpError(400, "validation_error", "invalid event")
        if source and source not in SOURCES:
            raise HttpError(400, "validation_error", "invalid source")
        if acknowledged not in (None, "true", "false"):
            raise HttpError(400, "validation_error", "invalid acknowledged")
        if limit < 1 or limit > 200 or offset < 0:
            raise HttpError(400, "validation_error", "invalid paging")
        return repo.list_alerts(
            db,
            {
                "priority": priority,
                "event": event,
                "source": source,
                "acknowledged": acknowledged,
                "from": from_,
                "to": to,
                "limit": limit,
                "offset": offset,
            },
        )

    @app.get("/api/alerts/{alert_id}")
    def get_alert(alert_id: str) -> dict[str, Any]:
        row = repo.get_alert(db, alert_id)
        if not row:
            raise HttpError(404, "not_found", "alert not found")
        return row

    @app.post("/api/alerts/{alert_id}/ack")
    def ack_alert(alert_id: str) -> dict[str, Any]:
        result = repo.acknowledge_alert(db, alert_id)
        if not result:
            raise HttpError(404, "not_found", "alert not found")
        if result["changed"]:
            event = {"kind": "ack", "data": {"id": alert_id, "acknowledged_at": result["alert"]["acknowledged_at"]}}
            try:
                redis_client.publish(LIVE_CHANNEL, __import__("json").dumps(event))
            except Exception as err:  # noqa: BLE001
                log.warning("ack broadcast failed: %s", err)
        return result["alert"]

    @app.get("/api/metrics/summary")
    def summary(hours: int = 24) -> dict[str, Any]:
        if hours < 1 or hours > 168:
            raise HttpError(400, "validation_error", "hours must be 1-168")
        return repo.metrics_summary(db, hours)

    @app.get("/api/metrics/trend")
    def trend(hours: int = 24, bucket: str | None = None) -> dict[str, Any]:
        if hours < 1 or hours > 168:
            raise HttpError(400, "validation_error", "hours must be 1-168")
        if bucket not in (None, "minute", "hour"):
            raise HttpError(400, "validation_error", "invalid bucket")
        chosen = bucket or ("minute" if hours <= 3 else "hour")
        return repo.metrics_trend(db, hours, chosen)

    @app.get("/api/devices")
    def devices() -> list[dict[str, Any]]:
        return repo.list_devices(db)

    @app.get("/api/alarm")
    def get_alarm() -> dict[str, Any]:
        return alarm.snapshot()

    @app.post("/api/alarm/silence")
    def silence_alarm() -> dict[str, Any]:
        return alarm.silence()

    @app.post("/api/alarm/clear")
    def clear_alarm() -> dict[str, Any]:
        return alarm.clear()

    @app.get("/api/reports")
    def reports(hours: int = 24) -> Response:
        if hours < 1 or hours > 168:
            raise HttpError(400, "validation_error", "hours must be 1-168")
        pdf = build_report_pdf(db, hours)
        filename = f"intellisafe-report-{hours}h.pdf"
        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @app.post("/api/simulate", status_code=202)
    async def simulate(request: Request) -> dict[str, Any]:
        if not cfg.enable_simulate:
            raise HttpError(404, "disabled", "simulate endpoint is disabled")
        if not publisher.is_connected():
            raise HttpError(503, "mqtt_unavailable", "MQTT broker is not connected")
        raw = await request.body()
        try:
            data = json.loads(raw) if raw else {}
            req = SimulateRequest.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as err:
            raise HttpError(400, "validation_error", str(err)) from err
        messages = generate_from_request(mock, req)
        published = [publisher.publish(m) for m in messages]
        return {"published": published}

    @app.post("/api/evidence", status_code=201)
    async def upload_evidence(request: Request) -> dict[str, str]:
        token = cfg.evidence_upload_token
        if token:
            given = request.headers.get("x-api-key", "")
            if not hmac.compare_digest(given, token):
                raise HttpError(401, "unauthorized", "missing or wrong x-api-key")
        body = await request.body()
        if len(body) > MAX_EVIDENCE_BYTES:
            raise HttpError(413, "too_large", "image too large")
        kind = _png_or_jpg(body)
        if not kind:
            raise HttpError(400, "bad_image", "body is not a valid PNG or JPEG")
        uploads = Path(cfg.evidence_dir) / "uploads"
        uploads.mkdir(parents=True, exist_ok=True)
        name = f"{uuid.uuid4()}.{kind}"
        (uploads / name).write_bytes(body)
        return {"image_path": f"uploads/{name}"}

    evidence_root = Path(cfg.evidence_dir)
    evidence_root.mkdir(parents=True, exist_ok=True)
    app.mount("/api/evidence", StaticFiles(directory=str(evidence_root)), name="evidence")

    @app.websocket("/ws")
    async def ws_endpoint(ws: WebSocket) -> None:
        await live.connect(ws)
        try:
            while True:
                await ws.receive_text()
        except WebSocketDisconnect:
            live.disconnect(ws)

    @app.get("/")
    def root() -> dict[str, str]:
        return {"service": "api"}

    return app
