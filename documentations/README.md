# Documentations — IntelliSafe FYP

Planning, proposals, agreements, and sprint PDFs.  
**Application code lives in** [`../Smart-Surveillance-System/`](../Smart-Surveillance-System/).

## Contents

| Path | What |
|------|------|
| [`proposal/`](proposal/) | FYP-I proposal PDF / DOCX / presentation |
| [`.sprint/`](.sprint/) | Centralized + member sprint plans (LaTeX/PDF) |
| [`.aggrement/`](.aggrement/) | Collaboration agreement |
| [`.prerequisite/`](.prerequisite/) | Member A / B readiness checklists |
| [`DETECTION_CLASS_SCOPE.md`](DETECTION_CLASS_SCOPE.md) | Supervisor-approved detection classes |
| [`dinosaur_fyp_architecture_92471e72.plan.md`](dinosaur_fyp_architecture_92471e72.plan.md) | Full architecture plan |

## Codebase

```
../Smart-Surveillance-System/   ← contracts, edge, transport, infra, services, frontend
```

Quick start for the stack:

```bash
cd ../Smart-Surveillance-System
docker compose -f infra/docker-compose.yml up --build -d
```
