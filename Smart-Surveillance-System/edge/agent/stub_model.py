"""A fake model with the same interface as the real one, so the whole pipeline can run today.

Uzair's real model replaces this: any module that exposes `get_compliance_event(frame)` works, e.g.

    python -m edge.agent --model edge.inference.model

The stub is mostly compliant with occasional violations, and points `image_path` at the sample images
so the evidence-upload path is exercised as well.
"""

from __future__ import annotations

import random
from pathlib import Path
from typing import Any

SAMPLES = Path(__file__).resolve().parents[1] / "inference" / "samples"

_rng = random.Random()

_SCENARIOS = [
    # (weight, event, image file)
    (80, "compliant", None),
    (8, "helmet_missing", "sample_helmet_missing.png"),
    (6, "vest_missing", "sample_worker_ppe.png"),
    (2, "smoke", "sample_smoke.png"),
    (2, "fire", "sample_fire.png"),
]


def get_compliance_event(frame: Any = None) -> dict[str, Any] | None:  # noqa: ARG001 - frame unused by the stub
    event, image = _rng.choices(
        [(e, i) for _, e, i in _SCENARIOS], weights=[w for w, _, _ in _SCENARIOS]
    )[0]
    workers = _rng.randint(1, 6)
    detections: list[dict[str, Any]] = [
        {"class": "worker", "bbox": [100 + 40 * n, 120, 80, 200], "confidence": round(_rng.uniform(0.8, 0.98), 2)}
        for n in range(workers)
    ]
    handoff: dict[str, Any] = {
        "event": event,
        "compliance_score": round(_rng.uniform(88, 99) if event == "compliant" else _rng.uniform(45, 80), 1),
        "confidence": round(_rng.uniform(0.8, 0.97), 2),
        "frame": {"width": 1280, "height": 720},
        "detections": detections,
        "worker_count": workers,
        "violation_count": 0 if event == "compliant" else 1,
        "image_path": str(SAMPLES / image) if image else None,
    }
    if event in ("helmet_missing", "vest_missing"):
        handoff["worker_id"] = _rng.randint(1, workers)
    else:
        handoff["worker_id"] = None
    return handoff
