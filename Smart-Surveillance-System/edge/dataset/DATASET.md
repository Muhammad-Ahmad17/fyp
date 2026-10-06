# Dataset notes — IntelliSafe

**Owner:** Member B  
**Target Month 1:** ≥ 200 labelled images, all 6 classes represented.  
**Images:** do not commit large binaries; keep on Google Drive / Git LFS.

## Sources (candidates)

| Track | Suggested sources |
|-------|-------------------|
| PPE (worker, helmet, vest) | Roboflow Universe PPE / hard-hat datasets; self-captured webcam |
| Fire / smoke | D-Fire or similar public fire-smoke sets |
| Spill | Self-collected or thin public set (secondary priority Month 1) |

## Annotation

1. Tool: Roboflow or CVAT (YOLO export).
2. Classes must match `data.yaml` order: worker, helmet, vest, fire, smoke, spill.
3. Place images under `images/{train,val,test}/` and labels under `labels/{train,val,test}/`.
4. One `.txt` per image; empty file if no objects.

## Drive / LFS link

_Record shared folder URL here after kickoff:_  
`_______________________________________________`

## Progress

| Milestone | Count | Done |
|-----------|-------|------|
| Week 2 | 50+ | ☐ |
| Week 3 | 150+ | ☐ |
| Week 4 (M0) | 200+ | ☐ |

## Hardware note (training)

GPU/CUDA available for training: **Yes / No** (circle one).  
If No: Month 1 pretrained demo on CPU; Month 2 training via Google Colab.
