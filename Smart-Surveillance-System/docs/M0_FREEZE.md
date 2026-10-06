# M0 Freeze — Month 1 Week 4

**Goal:** Contract + handoff signed; simulator events visible in Redis; dataset path started.

## Sign-off

Walk one sample handoff JSON next to `contracts/events.py`, then sign:

| Item | Status | Signatures |
|------|--------|------------|
| `contracts/events.py` frozen | Ready for review | A: ______  B: ______  Date: ______ |
| `edge/README.md` handoff matches contract | Ready for review | A: ______  B: ______  Date: ______ |
| `XRANGE ppe:alerts` shows ≥ 5 valid events | Prove via infra README | A: ______ |
| Handoff fields B emits / A adds documented | See edge + contracts README | Both |

After signing: **no casual schema changes** without both members + a short note.

## Prove commands (Member A)

```bash
docker compose -f infra/docker-compose.yml up --build -d
sleep 12
docker compose -f infra/docker-compose.yml exec redis redis-cli XRANGE ppe:alerts - + COUNT 5
```

## Hardware custody (Member A)

Confirm (do not flash yet):

- [ ] Jetson Nano 2GB
- [ ] Camera + 5V 4A PSU + microSD

## Dataset (Member B)

- [ ] ≥ 200 YOLO labels (images on Drive/LFS — link in `edge/dataset/DATASET.md`)
- [ ] All 6 classes appear at least once
- [ ] Pretrained demo samples in `edge/inference/samples/`
- [ ] IoU tests passing
- [ ] GPU/CUDA Yes/No recorded in DATASET.md

## Month 2 carry-over (first tickets)

1. **Uzair:** Start YOLOv8n training on annotated set; target mAP@0.5 ≥ 0.70 on val; expand dataset toward 500+.
2. **Uzair:** Compliance engine prototype — IoU association + zone rules + debounce + rolling score → real handoff dict from webcam.
3. **Ahmad:** PostgreSQL (+ optional Timescale) schema: `violations`, `compliance_metrics`, `zone_rules`.
4. **Ahmad:** Alert Service consuming `ppe:alerts` (Redis consumer group) → persist + REST `GET /api/alerts`.
5. **Joint:** Integration session M1 — simulator (or stub handoff) events land in `violations` table.

---

*Created as part of Month 1 scaffold. Fill signatures at the Week 4 integration session.*
