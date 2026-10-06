"""Unit tests for IoU association."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Allow importing without package install
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from compliance_engine.iou import associate_ppe_to_worker, iou  # noqa: E402


def test_identical_boxes_iou_is_one() -> None:
    box = [10.0, 10.0, 50.0, 50.0]
    assert iou(box, box) == pytest.approx(1.0)


def test_non_overlapping_boxes_iou_is_zero() -> None:
    a = [0.0, 0.0, 10.0, 10.0]
    b = [20.0, 20.0, 10.0, 10.0]
    assert iou(a, b) == 0.0


def test_partial_overlap() -> None:
    # 10x10 box overlapping 5x5 area with another → IoU = 25 / (100+100-25) = 0.142...
    a = [0.0, 0.0, 10.0, 10.0]
    b = [5.0, 5.0, 10.0, 10.0]
    assert iou(a, b) == pytest.approx(25.0 / 175.0)


def test_associate_helmet_above_threshold() -> None:
    worker = [100.0, 100.0, 80.0, 200.0]
    helmet = [110.0, 90.0, 40.0, 40.0]  # overlaps worker head region
    far = [400.0, 400.0, 20.0, 20.0]
    idxs = associate_ppe_to_worker(worker, [helmet, far], threshold=0.05)
    assert 0 in idxs
    assert 1 not in idxs
