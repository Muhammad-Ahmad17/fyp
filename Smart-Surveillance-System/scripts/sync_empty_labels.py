#!/usr/bin/env python3
"""Create empty YOLO .txt stubs when images exist without labels.

After you drop photos into edge/dataset/images/{train,val,test}/, run:

  python scripts/sync_empty_labels.py

Then annotate (or fill) the matching .txt files under labels/.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "edge" / "dataset"
EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def sync_split(split: str) -> int:
    img_dir = ROOT / "images" / split
    lbl_dir = ROOT / "labels" / split
    lbl_dir.mkdir(parents=True, exist_ok=True)
    n = 0
    if not img_dir.exists():
        return 0
    for img in img_dir.iterdir():
        if img.suffix.lower() not in EXTS:
            continue
        lbl = lbl_dir / f"{img.stem}.txt"
        if not lbl.exists():
            lbl.write_text("", encoding="utf-8")
            n += 1
    return n


def main() -> None:
    total = 0
    for split in ("train", "val", "test"):
        created = sync_split(split)
        print(f"{split}: created {created} empty label(s)")
        total += created
    print(f"total new stubs: {total}")


if __name__ == "__main__":
    main()
