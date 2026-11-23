# Supervisor-Approved Detection Class Scope

**Status:** Approved by supervisor — do not add classes without written approval.  
**Last updated:** 2026

> **Scope change (pending supervisor confirmation):** the `spill` class and the zone concept were
> removed because the project is tested in a single room. Classes are now worker, helmet, vest, fire,
> smoke (5). Ahmad decided this on the platform side; get the supervisor's written OK and Uzair's
> agreement before treating it as final.

---

## Overview

Edge perception is split into **three detection tracks** that feed the **Compliance Engine**:

```
Worker Detection  →  Workers & Positions  ──┐
PPE Detection       →  Helmet, Vest         ──┼──→  Compliance Engine
Hazard Detection    →  Fire, Smoke          ──┘
```

---

## Required Classes (In Scope)

| Track | YOLO class | Compliance use |
|-------|------------|----------------|
| **Worker Detection** | `worker` | Track positions; anchor for PPE IoU association |
| **PPE Detection** | `helmet` | Required PPE — violation: `helmet_missing` |
| **PPE Detection** | `vest` | Required PPE — violation: `vest_missing` |
| **Hazard Detection** | `fire` | Critical hazard — event: `fire` |
| **Hazard Detection** | `smoke` | Critical hazard — event: `smoke` |

**Minimum model classes:** `worker`, `helmet`, `vest`, `fire`, `smoke` (5 classes)

---

## Optional / Stretch (Only If Easy to Detect)

| Class | Notes |
|-------|--------|
| `gloves` | Include **only** if annotation data and mAP are strong; not required for demo |
| `boots` | Include **only** if annotation data and mAP are strong; not required for demo |

If added later, extend events with `gloves_missing` / `boots_missing` via contract amendment (Section 9.1 of collaboration agreement).

---

## Explicitly Out of Scope

Do **not** train or demo these unless supervisor approves a scope change:

- `goggles`
- `forklift`
- Any class not listed above

---

## Frozen Event Types (Contract)

Aligned with required classes only:

```
helmet_missing | vest_missing | fire | smoke | compliant
```

---

## Site Rules (Database / UI)

PPE requirements for the site (single room, no zones) — **supervisor scope:**

| Field | Required in UI |
|-------|----------------|
| `requires_helmet` | Yes |
| `requires_vest` | Yes |
| `requires_gloves` | Optional stretch only |
| `requires_boots` | Optional stretch only |

---

## Compliance Engine Logic

1. **Worker track** — detect workers; assign stable `worker_id` across frames  
2. **PPE track** — associate helmet & vest boxes to nearest worker via IoU  
3. **Hazard track** — fire/smoke trigger hazard events (not worker-associated)  
4. **Score** — rolling 5-frame compliance based on **helmet + vest** per site rules  
5. **Debounce** — one alert per violation type per worker per window  

---

## Member B Deliverable Checklist (CV)

- [ ] YOLO model trained on **5 required classes** minimum  
- [ ] Three-track pipeline documented in `edge/inference/README.md`  
- [ ] IoU association: helmet & vest → worker  
- [ ] Hazard events independent of worker association  
- [ ] Optional: gloves/boots only if mAP ≥ 0.70 on validation set  

---

## References

- Architecture: `dinosaur_fyp_architecture_92471e72.plan.md`
- Member B prerequisites: `.prerequisite/MEMBER_B_PREREQUISITES.md`
- Sprint plan: `shit/texes/sprint_plan.tex`
