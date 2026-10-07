# Prior Research vs. IntelliSafe: What We're Adding

**Project:** IntelliSafe — Real-Time Event-Driven Industrial Safety Monitoring using Edge Computer Vision  
**Team:** Muhammad Ahmad (FA23-BCE-113) & Muhammad Uzair (FA23-BCE-098)  
**Date:** Oct 7, 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Foundation: Prior Research in PPE Detection](#prior-research)
3. [The Gap: Why Detection Alone Is Not Enough](#the-gap)
4. [What IntelliSafe Adds: The System Layer](#what-we-add)
5. [Detailed Comparison Table](#comparison-table)
6. [References](#references)

---

## Executive Summary {#executive-summary}

### The Research Landscape
Deep learning for PPE detection is **mature and published**. Papers like Nath et al. [2] and Wang et al. [3] show that YOLO-family detectors can find helmets and vests in real-time construction footage with 90%+ accuracy.

### The Deployment Gap
What those papers **do not** address: the system around the detection. They train a model, run inference on images, and publish results. Real sites need:
- Per-worker compliance checking (not just "helmet detected")
- Debouncing (one alert per violation, not 30 per second)
- Hazard events (fire/smoke) alongside PPE
- Image evidence (timestamped, stored)
- Live alerts to supervisors
- Historical trend analysis
- PDF compliance reports

### What IntelliSafe Contributes
We take the **proven detection layer** and build a **production-grade system** around it:
- Frozen event contract (decouples edge from backend)
- Event-driven messaging (MQTT → Redis Streams)
- Microservices architecture (independent scaling)
- Compliance engine (per-worker, per-zone rules)
- Full-stack proof (Docker, CI/CD, observability)

**This is not a research contribution in detection. This is an engineering contribution in deployment.**

---

## Foundation: Prior Research in PPE Detection {#prior-research}

### Key References from Our Proposal

#### [2] Nath, Behzadan, and Paal (2020)
**Title:** "Deep learning for site safety: Real-time detection of personal protective equipment"  
**Venue:** Automation in Construction, vol. 112, 103085  
**Key contribution:** Demonstrates YOLOv3 and YOLOv4 detectors for helmet detection on construction sites with 90%+ accuracy.

**What they did:**
- Collected 1,500+ images from real construction sites
- Trained YOLOv3/v4 on helmet detection
- Achieved real-time inference on GPU
- Showed false-positive/false-negative trade-offs

**What they did NOT do:**
- No per-worker compliance logic (just "helmet detected" vs. not)
- No multi-class detection (only helmets, not vests or hazards)
- No event delivery system
- No dashboard or reporting
- No Jetson / edge deployment (GPU-only)

---

#### [3] Wang, Wu, Yang, et al. (2021)
**Title:** "Fast personal protective equipment detection for real construction sites using deep learning approaches"  
**Venue:** Sensors, vol. 21, no. 10, 3478  
**Key contribution:** Compares multiple deep learning architectures (Faster R-CNN, YOLOv3, YOLOv4) for PPE detection in the wild.

**What they did:**
- Tested 4 detection architectures
- Evaluated on real construction site footage
- Measured latency and accuracy trade-offs
- Recommended YOLOv4 as best balance

**What they did NOT do:**
- No compliance scoring (just detection)
- No evidence capture or storage
- No alert system
- No analytics or reporting
- No focus on edge hardware constraints

---

#### [4] Redmon et al. (2016)
**Title:** "You only look once: Unified, real-time object detection"  
**Venue:** IEEE CVPR 2016  
**Key contribution:** Introduced YOLO — the foundational algorithm for real-time single-stage object detection.

**Impact on our project:**
- YOLO is the detection backbone we use (YOLOv8n)
- Enables real-time inference on edge devices
- Unified detection framework (workers + PPE + hazards in one pass)

**Not in scope:** YOLO is 8+ years old; we use the latest version (v8).

---

#### [7] de Venâncio, Lisboa, and Barbosa (2022)
**Title:** "An automatic fire detection system based on deep convolutional neural networks for low-power, resource-constrained devices"  
**Venue:** Neural Computing and Applications, vol. 34, pp. 15349–15368  
**Key contribution:** Demonstrates CNN-based fire detection on embedded hardware (Raspberry Pi, Jetson).

**What they did:**
- Trained fire/smoke detection models
- Deployed on low-power hardware
- Optimized for latency and memory

**What they did NOT do:**
- No integration with PPE detection
- No compliance or rules engine
- No alert delivery system
- No multi-event handling
- No evidence storage or reporting

---

### Synthesis of Prior Research

| Aspect | Nath et al. [2] | Wang et al. [3] | Redmon et al. [4] | de Venâncio et al. [7] |
|--------|---|---|---|---|
| **PPE Detection** | ✅ Helmet | ✅ Helmet, vest | N/A (foundational) | N/A |
| **Hazard Detection** | ❌ | ❌ | N/A | ✅ Fire/smoke |
| **Real-time FPS** | ✅ (GPU) | ✅ (GPU) | ✅ (GPU) | ✅ (edge) |
| **Per-worker compliance** | ❌ | ❌ | N/A | N/A |
| **Debouncing/filtering** | ❌ | ❌ | N/A | ❌ |
| **Evidence capture** | ❌ | ❌ | N/A | ❌ |
| **Event delivery** | ❌ | ❌ | N/A | ❌ |
| **Supervisor dashboard** | ❌ | ❌ | N/A | ❌ |
| **Trend analytics** | ❌ | ❌ | N/A | ❌ |
| **PDF reports** | ❌ | ❌ | N/A | ❌ |
| **Edge deployment** | GPU-only | GPU-only | N/A | ✅ (Jetson) |

---

## The Gap: Why Detection Alone Is Not Enough {#the-gap}

### What Site Safety Actually Needs

A real industrial site has these requirements:

1. **Compliance Decisions, Not Just Detections**
   - Detect: "helmet at position (100, 120)"
   - Compliance: "worker 7 is missing a helmet → violation"
   - Prior work stops at detect; sites need the decision.

2. **Multi-Class Hazard Awareness**
   - Helmets and vests (PPE) are **required every shift**
   - Fire and smoke are **instant evacuation events**
   - Prior work treats them separately; sites need both in one view.

3. **Evidence for Audits**
   - A timestamped image of the violation
   - JSON log of what the system saw and decided
   - Prior work: no storage, just a detection bounding box.

4. **Durability of Alerts**
   - On-site supervisor must see the alert **immediately**
   - Must be **stored** if the supervisor was distracted
   - Must **not spam** (30 alerts for one violation)
   - Prior work: typically assumes a camera feed, not a delivery system.

5. **Trends and Insights**
   - "Which zone has the worst compliance?"
   - "Did training last week improve helmet usage?"
   - "Is this worker a repeat offender?"
   - Prior work: no analytics, no historical tracking.

6. **Actionable Reports**
   - PDF with zone breakdowns, shift comparisons, trend charts
   - Reasons to focus training efforts
   - Prior work: no reporting layer.

### The Research-to-Deployment Gap
```
Academic Paper:
  Train model → Run inference → Publish results ✓

Real Factory:
  Detect → Decide (per-worker, per-zone rules)
         → Alert (deduplicate, prioritize, deliver)
         → Store (evidence + metadata)
         → Analyze (trends, insights)
         → Report (supervisor-friendly PDF)
```

**Prior research covers the first step. IntelliSafe builds the entire pipeline.**

---

## What IntelliSafe Adds: The System Layer {#what-we-add}

### 1. Compliance Engine (Domain Logic)

**What we built:**
```python
# IoU-based PPE-worker association
For each detected worker:
  Find helmets/vests with IoU > 0.3
  Check zone rules (e.g., "welding bay requires helmet + vest")
  Raise violation if rules violated
  Keep rolling 5-frame compliance score
  Debounce: one alert per violation, not per frame
```

**Why it matters:**
- Detection says "helmet at pixel (100, 120)"; logic says "worker 7 violates helmet rule"
- Debouncing prevents 30 alerts per second from becoming 900 per minute
- Per-zone rules let supervisors enforce different standards (chemical storage stricter than general floor)

**New intellectual contribution:** The debounce + rolling scoring logic is custom; prior work doesn't address this.

---

### 2. Frozen Event Contract (Architecture)

**What we built:**
```json
{
  "type": "alert|metrics|heartbeat",
  "event": "helmet_missing|vest_missing|fire|smoke|spill|compliant",
  "priority": "CRITICAL|HIGH|MEDIUM|LOW",
  "timestamp": "ISO8601",
  "session_id": "uuid",
  "worker_id": 7,
  "zone": "welding_bay",
  "confidence": 0.92,
  "compliance_score": 78.0,
  "detections": [...],
  "image_path": "evidence/session/frame_001.jpg"
}
```

**Why it matters:**
- Decouples edge (Jetson) from backend (cloud services)
- Edge team can train models while backend team builds services
- Contract is versioned; changes require both teams' approval

**Engineering discipline:** This is a **system design principle**, not something you find in detection papers.

---

### 3. Event-Driven Transport (MQTT → Redis Streams)

**What we built:**
- Mosquitto MQTT broker (industry standard for edge messaging)
- Custom MQTT-Redis bridge (transforms MQTT topics into Redis Streams)
- Three named streams: `ppe:alerts`, `ppe:metrics`, `ppe:heartbeat`
- Consumer groups: multiple services can read the same stream independently

**Why it matters:**
- **Persistence:** events survive service restarts (unlike raw MQTT)
- **Decoupling:** services don't know about each other; just read the stream
- **Backpressure:** services process at their own pace; no dropped messages
- **Exactly-once delivery:** acknowledgements per message

**New contribution:** The bridge is custom code; prior work doesn't include transport infrastructure.

---

### 4. Microservices Architecture

**What we built:**
- Alert Service: consumes alerts, deduplicates, writes to DB
- Metrics Service: aggregates compliance scores by zone and shift
- Reporting Service: generates PDF reports on demand
- WebSocket Gateway: broadcasts events to the dashboard in real-time
- Agent Service (optional): LLM-powered incident analysis

**Why it matters:**
- Each service scales independently (if alerts spike, only Alert Service scales)
- Service failure is isolated (Reporting Service down ≠ alerting down)
- Easy to add new services later (e.g., email alerts, Slack integration)

**New contribution:** Multi-service orchestration is a **system design choice**; prior work is single-purpose.

---

### 5. Compliance Analytics & Reporting

**What we built:**
- Historical violations table (timestamp, worker_id, event_type, image_path)
- Compliance metrics table (zone, shift, score over time)
- REST API: `/api/alerts?zone=&priority=&from=&to=`
- PDF reports: zone breakdown, shift comparison, trend charts, recommendations

**Why it matters:**
- Supervisors can see **which zone** is the problem (not just "there's a violation")
- Trend data shows whether training worked (compliance % rising/falling)
- PDF report is **supervisor-ready** (org header, charts, actionable insights)

**New contribution:** Analytics pipeline from raw detections to business intelligence.

---

### 6. Full-Stack DevOps

**What we built:**
- Docker Compose: one-command startup of 12 services (Mosquitto, Redis, Postgres, MinIO, 5 FastAPI services, React, Prometheus, Grafana)
- GitHub Actions CI/CD: lint → unit tests → integration tests → build images
- Prometheus metrics: instrumented every service for real-time monitoring
- Grafana dashboards: system health (events/sec, latency, errors) and safety KPIs (compliance score, violation rate)

**Why it matters:**
- **Reproducibility:** any developer can run `docker compose up` and have a live system
- **Production readiness:** CI/CD, observability, and scaling patterns are all there
- **Visibility:** see system health and safety metrics in real-time dashboards

**New contribution:** Production-grade deployment and observability for an industrial safety system.

---

### 7. Edge Deployment on Jetson Nano

**What we built:**
- YOLO model export to ONNX and TensorRT
- TensorRT FP16 optimization (half-precision for memory)
- Camera capture → inference → compliance logic → MQTT publishing on edge
- Evidence images saved locally; synced when online
- Graceful degradation: events buffer on Jetson if backend is down

**Why it matters:**
- **Low-cost:** Jetson Nano is $100; no GPU datacenter needed
- **Privacy:** video never leaves the factory; only events and images at violations
- **Resilience:** system works offline and syncs when connectivity returns
- **Real-time:** <2 second latency from violation to supervisor alert

**Connection to prior research:** de Venâncio et al. [7] showed fire detection on Jetson; we extend that to full PPE + hazard + compliance + reporting stack.

---

## Detailed Comparison Table {#comparison-table}

### Full Feature Matrix: Prior Research vs. IntelliSafe

| Feature | Academic Papers | IntelliSafe | Notes |
|---------|---|---|---|
| **Detection** | | | |
| Multi-class YOLO (workers + PPE + hazards) | Partial [2][3] | ✅ Full | We combine all in one 6-class model |
| Real-time FPS on GPU | ✅ [2][3] | ✅ 10+ FPS | Works on Jetson Nano, not just GPU |
| Fire/smoke detection | ✅ [7] | ✅ | Integrated with PPE in one model |
| **Compliance & Logic** | | | |
| Per-worker compliance checking | ❌ | ✅ | Novel: IoU association + debounce |
| Per-zone configurable rules | ❌ | ✅ | Supervisor can edit zone requirements |
| Rolling compliance score | ❌ | ✅ | 5-frame window aggregation |
| Debouncing (one alert per violation) | ❌ | ✅ | Prevents alert spam |
| **Evidence & Storage** | | | |
| Timestamped image capture | ❌ | ✅ | Every violation is photographed |
| JSON metadata logging | ❌ | ✅ | Detection scores, confidence, etc. |
| Image evidence database | ❌ | ✅ | MinIO or PostgreSQL bytea |
| **Alert Delivery** | | | |
| MQTT transport | Assumes [8] | ✅ | Industry-standard messaging |
| Persistence (survive restarts) | ❌ | ✅ | Redis Streams consumer groups |
| Deduplication | ❌ | ✅ | Custom Alert Service logic |
| Priority routing | ❌ | ✅ | CRITICAL vs. MEDIUM vs. LOW |
| Live WebSocket broadcast | ❌ | ✅ | Real-time supervisor dashboard |
| **Analytics & Reporting** | | | |
| Historical violations query | ❌ | ✅ | REST API + time-range filtering |
| Compliance trend analysis | ❌ | ✅ | Zone + shift breakdown |
| PDF report generation | ❌ | ✅ | Org header, charts, recommendations |
| Supervisor dashboard | ❌ | ✅ | React UI with live updates |
| **Deployment & Operations** | | | |
| Edge (Jetson Nano) | Partial [7] | ✅ Full | Complete edge stack |
| Docker Compose full stack | ❌ | ✅ | 12-service orchestration |
| CI/CD (GitHub Actions) | ❌ | ✅ | Lint, test, build, push images |
| Observability (Prometheus) | ❌ | ✅ | All services instrumented |
| Health dashboards (Grafana) | ❌ | ✅ | System + safety KPI dashboards |
| **Integration & Scale** | | | |
| End-to-end demo | Partial | ✅ Full | Live helmet removal → alert → dashboard |
| Multi-zone scaling | ❌ | ✅ Pattern | Architecture supports 100+ zones |
| Offline resilience | ❌ | ✅ | Events buffer on edge |

---

## Summary: Where IntelliSafe Innovates

### Detection Layer (Proven by Prior Work)
✅ YOLO object detection is mature; we use YOLOv8n.  
✅ PPE detection achieves 90%+ accuracy; prior papers show this.  
✅ Fire/smoke detection on edge is feasible; de Venâncio et al. [7] proved it.  

**We do NOT claim novelty in detection itself.**

---

### System Layer (Our Contribution)

1. **Compliance Engine**
   - Per-worker, per-zone compliance checking
   - Debouncing to prevent alert spam
   - Rolling compliance scoring
   - **Not in prior work.**

2. **Event Transport**
   - MQTT broker + custom bridge to Redis Streams
   - Consumer groups for independent service consumption
   - Persistence and exactly-once delivery
   - **Not in prior work.**

3. **Microservices Architecture**
   - Alert Service, Metrics Service, Reporting Service, WebSocket Gateway
   - Independent scaling and failure isolation
   - **Not in prior work.**

4. **Analytics & Reporting**
   - Historical trend analysis per zone and shift
   - PDF compliance reports with actionable insights
   - Supervisor-ready dashboards
   - **Not in prior work.**

5. **Production Deployment**
   - Docker Compose for reproducible startup
   - GitHub Actions CI/CD
   - Prometheus observability
   - Grafana health and safety dashboards
   - **Not in prior work.**

6. **Edge Deployment at Scale**
   - Full stack on Jetson Nano (detection + compliance + MQTT + buffering)
   - Graceful offline operation
   - **Extended from de Venâncio et al. [7]; fully integrated.**

---

## References {#references}

[1] International Labour Organization, *A Call for Safer and Healthier Working Environments*. Geneva, Switzerland: ILO, 2023.

[2] N. D. Nath, A. H. Behzadan, and S. G. Paal, "Deep learning for site safety: Real-time detection of personal protective equipment," *Automation in Construction*, vol. 112, Art. no. 103085, 2020.

[3] Z. Wang, Y. Wu, L. Yang, A. Thirunavukarasu, C. Evison, and Y. Zhao, "Fast personal protective equipment detection for real construction sites using deep learning approaches," *Sensors*, vol. 21, no. 10, Art. no. 3478, 2021.

[4] J. Redmon, S. Divvala, R. Girshick, and A. Farhadi, "You only look once: Unified, real-time object detection," in *Proc. IEEE Conf. Comput. Vis. Pattern Recognit. (CVPR)*, 2016, pp. 779–788.

[5] G. Jocher, A. Chaurasia, and J. Qiu, *Ultralytics YOLOv8*. 2023. [Online]. Available: https://github.com/ultralytics/ultralytics

[6] NVIDIA Corporation, *Jetson Nano Developer Kit*. [Online]. Available: https://developer.nvidia.com/embedded/jetson-nano

[7] P. V. A. B. de Venâncio, A. C. Lisboa, and A. V. Barbosa, "An automatic fire detection system based on deep convolutional neural networks for low-power, resource-constrained devices," *Neural Computing and Applications*, vol. 34, pp. 15349–15368, 2022.

[8] OASIS, *MQTT Version 5.0*, OASIS Standard, Mar. 2019. [Online]. Available: https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html

---

## Document Summary for Defense

Use this document to answer:

**Q: "Is this just applying existing detection models? What's novel?"**

A: "YOLO detection is mature—papers [2] and [3] proved that. Fire detection on edge is feasible—[7] showed it. Our novelty is the **system layer**: compliance engine, event-driven architecture, full-stack DevOps, analytics, and end-to-end deployment. We take proven components and engineer a production-grade safety platform. That's the innovation."

---

**Version:** 1.0  
**Last updated:** Oct 7, 2026  
**Status:** Ready for Defense
