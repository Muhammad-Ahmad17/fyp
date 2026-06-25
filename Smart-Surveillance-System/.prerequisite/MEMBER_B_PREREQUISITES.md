# Member B — Prerequisites Checklist

**Role:** Edge / CV Development Lead  
**Project:** Industrial Safety Intelligence Platform  
**Must complete before Sprint 1 starts**

---

> Complete every section below and check all boxes before writing project code.  
> Reference: `finalization/COLLABORATION_AGREEMENT.md` (v1.2)

---

## 1. Your Responsibilities (Know This First)

You own **computer vision development only**. You stop at a Python handoff — Member A owns everything after that.

| You own | You do NOT own |
|---------|----------------|
| YOLO / TensorRT inference code | MQTT publisher, subscriber, or broker |
| Compliance engine (IoU, zone rules, debouncing) | Jetson flash, deploy, or demo-day hardware ops |
| Camera pipeline & evidence frame capture | Backend services, database, dashboard |
| PRs to `edge/inference/` and `edge/compliance_engine/` | Docker Compose, CI/CD, Grafana |
| Stable **internal output interface** (Python dict) | Redis, PostgreSQL, MinIO |
| Model training, evaluation, export | Changing MQTT topics or broker config |

**Handoff rule:** Your code returns structured output like:

```python
{
    "event": "helmet_missing",
    "zone": "welding_bay",
    "worker_id": 7,
    "compliance_score": 78,
    "confidence": 0.92,
    "detections": [{"class": "helmet", "bbox": [x, y, w, h], "confidence": 0.94}],
    "image_path": "evidence/session_id/frame_001.jpg"
}
```

Member A's MQTT publisher reads this and serializes it to the frozen contract. **You never publish to MQTT yourself.**

---

## 2. Hardware Prerequisites

### Required for CV development

- [ ] Development machine with **8 GB+ RAM** minimum (**16 GB+ recommended** for training)
- [ ] **GPU strongly recommended** for YOLO training (NVIDIA CUDA-capable; CPU-only training is very slow)
- [ ] Stable internet for dataset download, Ultralytics, GitHub
- [ ] **USB webcam** or access to industrial/PPE image dataset for training and testing

### Jetson access (not ownership)

- [ ] Understand that **Member A owns the Jetson** — flash, deploy, and demo operation
- [ ] You may **borrow the Jetson** from Member A for model testing — always notify before use
- [ ] You must deliver code and model files that Member A can deploy without you on demo day
- [ ] Do **not** flash Jetson or change OS/broker settings unless Member A is present and agrees

### Optional but valuable

- [ ] Same camera model Member A uses on Jetson (reduces train/deploy gap)
- [ ] External drive for dataset storage if laptop storage is limited

---

## 3. Software & Tools — Must Install Before Sprint 1

### Core development

- [ ] **Python 3.10+** (3.11 preferred) — `python3 --version`
- [ ] **Git** configured with your **real name** and **university email**
- [ ] **VS Code** (or PyCharm) with Python extension
- [ ] **venv** or **conda** for isolated project environments

### Computer vision & deep learning

- [ ] **OpenCV** (`cv2`) — read camera, draw boxes, save frames
- [ ] **NumPy** — array operations, bbox math
- [ ] **Ultralytics YOLO** (YOLOv8+) — train, validate, export
- [ ] **PyTorch** — tensors, CUDA check (`torch.cuda.is_available()`)
- [ ] **Pillow** — image loading and manipulation
- [ ] **Matplotlib** — training curves, visual debugging

### Model export & edge inference

- [ ] Export YOLO to **ONNX** format
- [ ] Understand **TensorRT** engine conversion concept (Member A deploys; you supply export)
- [ ] Know **YOLOv8n (nano)** is the target variant for Jetson Nano 2GB memory limits
- [ ] Target inference: **640×480** or **640×640**, **>15 FPS** on Jetson after Member A deploys

### Annotation & dataset

- [ ] **LabelImg**, **Roboflow**, or **CVAT** for bounding box annotation
- [ ] **YOLO format** labels (`.txt` per image: `class x_center y_center width height` normalized)
- [ ] Dataset split workflow: 80% train / 10% val / 10% test
- [ ] `data.yaml` configuration for Ultralytics training

### You do NOT need (Member A's domain)

- ⛔ paho-mqtt, Mosquitto, MQTT broker setup
- ⛔ Redis, PostgreSQL, Docker Compose (unless learning voluntarily)
- ⛔ FastAPI, React, LangGraph

---

## 4. GitHub — Mandatory Collaboration Skills

You must demonstrate all of the following **before Sprint 1 ends**:

- [ ] Clone the shared repo and create a branch
- [ ] Make commits with clear messages using your university email
- [ ] Open a Pull Request with description: *what, why, how to test*
- [ ] Request review from Member A on all PRs to `edge/inference/` or `edge/compliance_engine/`
- [ ] Resolve a merge conflict locally
- [ ] Create a GitHub Issue with assignee, sprint label, and priority
- [ ] Never commit secrets, large model binaries without Git LFS agreement, or dataset files without `.gitignore` rules
- [ ] Never open PRs to `transport/`, `edge/mqtt_publisher/`, or `services/` — those are Member A only

**Week 1 proof task:** Open your first PR that adds a README or stub under `edge/inference/` documenting your planned detection classes.

---

## 5. Documentation & Productivity Tools

Both members must use these consistently:

| Tool | Your use |
|------|----------|
| **LaTeX** (`.tex` → PDF) | Model evaluation reports, dataset documentation |
| **DOCX** | Formal supervisor submissions when required |
| **PPT / Google Slides** | Mid-term, final, exhibition — **your CV/edge slides** |
| **Markdown** (`.md`) | Sprint logs, `edge/README.md`, handoff interface spec |

### Before Sprint 1

- [ ] Can compile or edit a LaTeX/PDF document (or use Overleaf)
- [ ] Can create presentation slides explaining your CV pipeline
- [ ] Will maintain weekly sprint log at:  
      `docs/sprint-logs/<your-name>_sprint-<N>_log.md`
- [ ] Will document the **CV handoff interface** in `edge/README.md` for Member A
- [ ] Understand AI-use policy: AI may help debug or draft; **you must understand and explain all code in viva**
- [ ] Sprint log line required each week:  
      `AI tools used this week: Yes/No — if Yes, list tool and purpose`

---

## 6. Knowledge — Concepts You Must Understand

Read before coding:

- [ ] `finalization/dinosaur_fyp_architecture_92471e72.plan.md`
- [ ] `finalization/COLLABORATION_AGREEMENT.md`
- [ ] `shit/texes/sprint_plan.pdf` — **your sprints focus on edge CV tasks**

### CV & detection concepts

- [ ] **Object detection** — bounding boxes, confidence scores, NMS
- [ ] **IoU (Intersection over Union)** — measuring box overlap
- [ ] **PPE-to-worker association** — assign **helmet & vest** boxes to nearest worker via IoU
- [ ] **Per-zone PPE rules** — welding bay requires helmet + vest (supervisor scope)
- [ ] **Compliance score** — rolling window (e.g. 5 frames) aggregated to 0–100%
- [ ] **Violation debouncing** — one alert per violation event, not 30 frames in a row
- [ ] **mAP, precision, recall** — how you evaluate model quality

### Detection classes (supervisor-approved)

Three tracks feed the Compliance Engine:

| Track | Classes | Status |
|-------|---------|--------|
| Worker Detection | `worker` | **Required** |
| PPE Detection | `helmet`, `vest` | **Required** |
| PPE Detection | `gloves`, `boots` | Optional — include only if easy to detect (mAP ≥ 0.70) |
| Hazard Detection | `fire`, `smoke`, `spill` | **Required** |

**Out of scope:** `goggles`, `forklift`, and any class not supervisor-approved.

- [ ] Read `finalization/DETECTION_CLASS_SCOPE.md` before training
- [ ] Minimum 6-class model: worker, helmet, vest, fire, smoke, spill

### Frozen contract — you must OUTPUT compatible fields

You do not implement MQTT, but your handoff dict must map to:

| Contract field | Your responsibility |
|----------------|---------------------|
| `event` | Derive from compliance logic |
| `zone` | From configured zone rules |
| `worker_id` | Track across frames |
| `compliance_score` | Your rolling calculator |
| `confidence` | From detection scores |
| `detections[]` | From YOLO output |
| `image_path` | Your evidence save logic |

Member A adds: `type`, `priority`, `timestamp`, `session_id`, and MQTT serialization.

### What happens after your code (know the pipeline — do not build it)

```
Your CV code → handoff dict → [Member A: MQTT → Broker → Redis → Services → Dashboard]
```

---

## 7. Accounts & Access

- [ ] GitHub account with access to shared repository
- [ ] Roboflow / Kaggle account if using public PPE datasets
- [ ] Shared team chat channel agreed (WhatsApp / Discord / Slack)
- [ ] Supervisor contact saved and introduction meeting done
- [ ] Agreement on where model weights are stored (Git LFS, Google Drive, or Member A deploys from your export)

---

## 8. What You Must NOT Do

- [ ] I will **not** write or configure **any MQTT code** (publisher, subscriber, broker)
- [ ] I will **not** flash, reconfigure, or deploy to Jetson without Member A
- [ ] I will **not** modify `transport/`, `services/`, `frontend/`, or `infra/` directories
- [ ] I will **not** change `contracts/events.py` without Member A's written approval
- [ ] I will **not** push directly to `main` without a PR
- [ ] I will **not** submit undocumented work or AI-generated sprint logs as my own
- [ ] I will **not** miss three consecutive sprint meetings (per collaboration agreement)

---

## 9. Week 0 Readiness Gate — Proof Tasks

Complete these **before Sprint 1 Week 1 planning meeting**:

| # | Task | Done |
|---|------|------|
| 1 | Install Python, Git, create venv, install OpenCV + Ultralytics | ☐ |
| 2 | Clone repo, create branch, open first PR to `edge/` | ☐ |
| 3 | Run YOLO pretrained inference on a sample image — save annotated output | ☐ |
| 4 | Annotate at least **20 sample images** in YOLO format (practice workflow) | ☐ |
| 5 | Implement a simple **IoU function** between two bounding boxes (unit test) | ☐ |
| 6 | Document planned detection classes in `edge/inference/README.md` | ☐ |
| 7 | Draft **CV handoff interface** (Python dict schema) and share with Member A | ☐ |
| 8 | Read architecture plan + collaboration agreement fully | ☐ |
| 9 | Attend kickoff meeting; agree handoff interface with Member A | ☐ |
| 10 | Confirm GPU/CUDA status or document CPU-only training plan with timeline impact | ☐ |

---

## 10. Dataset & Model — Minimum Standards

Before Sprint 2 ends, plan to meet:

| Requirement | Target |
|-------------|--------|
| Total annotated images | 1000+ (focus on 6 required classes) |
| Required classes | worker, helmet, vest, fire, smoke, spill |
| Optional stretch | gloves, boots — only if easy to detect |
| Annotation format | YOLO `.txt` |
| Model variant | YOLOv8n (nano) |
| mAP@0.5 on test set | ≥ 0.70 |
| Export formats ready for Member A | `.pt` best weights + ONNX export |
| Evidence capture | Save frame on violation; return path string in handoff dict |

Document dataset sources and licenses in `edge/inference/DATASET.md`.

---

## 11. Recommended Learning (If Gaps Exist)

| Topic | Suggested starting point |
|-------|-------------------------|
| Ultralytics YOLOv8 | [docs.ultralytics.com](https://docs.ultralytics.com) |
| IoU & NMS | Any CV tutorial on object detection post-processing |
| OpenCV Python | OpenCV official Python tutorials — video capture, imwrite |
| YOLO annotation | Roboflow YOLO format guide |
| TensorRT export | NVIDIA docs — ONNX to TensorRT (coordinate with Member A) |
| GitHub flow | GitHub Docs — Pull Request workflow |

**Target:** Close all gaps within **Week 1 of Sprint 1**. Do not start full model training until handoff interface is agreed with Member A.

---

## 12. Viva Preparation — You Must Explain

Even though Member A owns the platform, you must explain in viva:

- [ ] How your YOLO model was trained and evaluated
- [ ] How IoU association links PPE to workers
- [ ] How compliance score and debouncing work
- [ ] What your handoff dict contains and how Member A consumes it
- [ ] Full system architecture at high level (not just your module)

---

## 13. Sign-Off

I confirm I have reviewed this checklist, understand my role boundaries (CV only, no MQTT), and am ready to begin Sprint 1 work.

| Field | Value |
|-------|-------|
| **Name** | _________________________ |
| **Reg. No.** | _________________________ |
| **Date** | _________________________ |
| **Signature** | _________________________ |

**Reviewed by Member A:** _________________________ **Date:** _______________

---

*Document version: 1.0 — aligned with COLLABORATION_AGREEMENT v1.2*
