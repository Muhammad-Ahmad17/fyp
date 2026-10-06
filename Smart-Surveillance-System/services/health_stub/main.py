"""Minimal FastAPI health stub — Month 2 warm-start (compose profile: optional)."""

from fastapi import FastAPI

app = FastAPI(title="IntelliSafe Health Stub", version="0.1.0")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "health_stub", "sprint": "month-1"}
