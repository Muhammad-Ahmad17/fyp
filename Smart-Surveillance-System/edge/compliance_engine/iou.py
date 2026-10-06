"""IoU (Intersection over Union) helpers for PPE–worker association.

Boxes are [x, y, w, h] with origin at top-left (same as handoff detections).
"""

from __future__ import annotations

from typing import Sequence


Box = Sequence[float]


def _to_xyxy(box: Box) -> tuple[float, float, float, float]:
    x, y, w, h = (float(box[0]), float(box[1]), float(box[2]), float(box[3]))
    return x, y, x + w, y + h


def iou(box_a: Box, box_b: Box) -> float:
    """Return IoU in [0, 1] for two axis-aligned boxes in xywh format."""
    ax1, ay1, ax2, ay2 = _to_xyxy(box_a)
    bx1, by1, bx2, by2 = _to_xyxy(box_b)

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0.0, inter_x2 - inter_x1)
    inter_h = max(0.0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h
    if inter_area <= 0.0:
        return 0.0

    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter_area
    if union <= 0.0:
        return 0.0
    return inter_area / union


def associate_ppe_to_worker(
    worker_box: Box,
    ppe_boxes: list[Box],
    threshold: float = 0.3,
) -> list[int]:
    """Return indices of PPE boxes whose IoU with the worker exceeds threshold."""
    return [i for i, box in enumerate(ppe_boxes) if iou(worker_box, box) > threshold]
