# Edge Inference — Detection Tracks

**Owner:** Member B (Muhammad Uzair)  
**Scope:** Computer vision only. No MQTT. Output is a Python handoff dict for Member A.

## Supervisor-approved classes (6 minimum)

| Track | Class | Purpose |
|-------|-------|---------|
| Worker Detection | `worker` | Count, track, anchor for PPE association |
| PPE Detection | `helmet` | Violation: `helmet_missing` |
| PPE Detection | `vest` | Violation: `vest_missing` |
| Hazard Detection | `fire` | Critical event |
| Hazard Detection | `smoke` | Critical event |
| Hazard Detection | `spill` | Environmental hazard |

**Optional stretch (only if mAP ≥ 0.70):** `gloves`, `boots`  
**Out of scope:** `goggles`, `forklift`, machinery

See also: [`DETECTION_CLASS_SCOPE.md`](../../DETECTION_CLASS_SCOPE.md)
(also archived under `documentations/DETECTION_CLASS_SCOPE.md`).

## Three tracks → Compliance Engine

```
Worker Detection  →  workers & positions  ──┐
PPE Detection     →  helmet, vest         ──┼──→  Compliance Engine
Hazard Detection  →  fire, smoke, spill   ──┘
```

## Model target

- Variant: **YOLOv8n** (nano) for Jetson Nano 2GB
- Input: 640×640
- Export for Member A: `.pt` best weights + ONNX (TensorRT conversion is Member A)

## Month 1 goals (this folder)

- [x] Document 6 classes and tracks (this README)
- [ ] Annotate ≥ 200 images (YOLO format) under `edge/dataset/`
- [ ] Run pretrained YOLO demo; save samples under `edge/inference/samples/`
- [ ] Do **not** start full training until Month 2 (after M0 freeze)

## Quick pretrained demo (local)

```bash
# from a venv with ultralytics installed
yolo predict model=yolov8n.pt source=0          # webcam
yolo predict model=yolov8n.pt source=path/to.jpg
# copy a few annotated outputs into samples/
```

## Dataset layout

```
edge/dataset/
  data.yaml
  images/{train,val,test}/
  labels/{train,val,test}/   # YOLO .txt: class x_center y_center width height (normalized)
```

Images are **not** committed (see `.gitignore`). Labels and `data.yaml` are. Store images on Drive/LFS and document the link in `DATASET.md`.
