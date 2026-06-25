# FYP Team Agreement — Industrial Safety Intelligence Platform

**COMSATS University Islamabad (Lahore Campus)** · Computer Engineering · Spring–Fall 2026  
**Version:** 2.0 (soft team agreement) · **Date:** _______________

---

> This is a **team agreement between two FYP partners** — not a legal contract.  
> We wrote it so we stay aligned, deliver on time, and avoid confusion.  

---

## 1. Team members

| | Member A | Member B |
|---|----------|----------|
| **Role** | Platform, MQTT & Jetson deploy | Edge / CV development |
| **Name** | Muhammad Ahmad | Uzair |
| **Reg. No.** | _________________ | _________________ |
| **Email** | _________________ | _________________ |

We are both responsible for finishing and defending this project together.

---

## 2. Why we have this document

We agree to:

- Know **who owns which part** of the system so we don't step on each other's work
- **Deliver sprint tasks on time** using the plan we both accepted
- Use **GitHub and Jira** properly so progress is visible
- **Document our own work** honestly (no plagiarism, no fake logs)
- Use **LaTeX, Word, and slides** properly for FYP submissions
- **Talk early** when blocked — don't go silent for days
- Have to inform in case of emergency

---

## 3. What we're building

**Industrial Safety Intelligence Platform** — real-time PPE and hazard detection on the edge, with a full backend platform behind it.

> *CV is one sensor. The platform is the project.*

**Detection scope (supervisor-approved):** worker, helmet, vest, fire, smoke, spill  
Details: `finalization/DETECTION_CLASS_SCOPE.md`

---

## 4. Who does what

### Simple split

| Member B builds | Member A builds |
|-----------------|-----------------|
| YOLO model & training | MQTT publisher → broker → bridge → consumers |
| Compliance engine (IoU, debounce) | 5 FastAPI microservices + database |
| Camera & evidence capture | React dashboard + LangGraph agent |
| Handoff dict (Python output) | Jetson flash, deploy, demo-day hardware |
| PRs to `edge/inference/`, `edge/compliance_engine/` | Everything in `transport/`, `services/`, `frontend/`, `infra/` |

### The one connection between us

Member B's code **outputs a Python dict** (event, zone, worker_id, compliance_score, detections, image_path).  
Member A's code **reads that dict and publishes it over MQTT**.  

That boundary keeps us independent until integration.

```
Member B:  Camera → YOLO → Compliance → handoff dict
                                              ↓
Member A:                          MQTT → Platform → Dashboard
```

Member B does **not** need to write MQTT code.  
Member A does **not** change B's model or compliance logic without asking first.

---

## 5. Sprint plan we both follow

We follow the **5-month plan** we agreed on together:

| Document | Purpose |
|----------|---------|
| `.sprint/centralized_sprint_plan.tex` | Master timeline — **source of truth for dates** |
| `.sprint/member_a_sprint_plan.tex` | Member A tasks only |
| `.sprint/member_b_sprint_plan.tex` | Member B tasks only |

**5 sprints × 4 weeks = 20 weeks**

| Sprint | Weeks | Shared goal |
|--------|-------|-------------|
| 1 | 1–4 | Contract frozen + MQTT/Redis working + dataset started |
| 2 | 5–8 | Backend services live + YOLO training |
| 3 | 9–12 | WebSocket, reports, synthetic data + model ready |
| 4 | 13–16 | Dashboard + Jetson integrated |
| 5 | 17–20 | DevOps, demo, submission |

**Milestones we check together:** M0 (week 4) · M1 (week 8) · M2 (week 12) · M3 (week 16) · M4 (week 20)

### Sprint rhythm (both attend)

- **Week 1** — Sprint planning: pick Jira tickets for this sprint  
- **Weekly** — 30 min sync: progress, blockers, next steps  
- **Week 4** — Sprint review: demo what you finished  
- **Weeks 4, 8, 12, 16, 20** — Integration session together  

### When is a task "done"?

- [ ] Jira ticket closed with note what was delivered  
- [ ] Code merged via GitHub PR (if applicable)  
- [ ] It works as described in the sprint plan  
- [ ] Short entry added to your weekly sprint log  
- [ ] Partner told if you were waiting on them  

If a task slips, we **talk about it in the next sync** and move the Jira ticket — no blame, just replan.

---

## 6. Tools we use

### Before Sprint 1 — both should know these basics

Complete your prerequisite checklist first:
- Member A → `.prerequisite/MEMBER_A_PREREQUISITES.md`
- Member B → `.prerequisite/MEMBER_B_PREREQUISITES.md`

**Week 1 goal:** each person opens their first PR and creates their first Jira ticket.

---

### GitHub (code home)

We keep **all code** in one shared repo: `________________________`

**Everyone should be comfortable with:**

| Skill | Why |
|-------|-----|
| Clone, branch, push, pull | Daily work |
| Open a Pull Request | All merges go through PR |
| Review a partner's PR | Shared files need both eyes |
| Fix a merge conflict | Happens to everyone |
| Never commit secrets | Use `.env`, not the repo |

**Simple rules we follow:**

- Work on feature branches, not directly on `main`
- PR description: what changed, why, how to test
- Link Jira ticket in PR (e.g. `SSP-123`)
- Push at least every few days — don't hoard code offline for weeks
- Shared files (`contracts/`, handoff interface) need **both** to agree before merge

**New to GitHub?** Complete a tutorial in Week 1. Partner helps if stuck.

---

### Jira (tasks & sprints)

We use **Jira** for tickets and sprint planning (industry standard).  
Setup guide: `.sprint/README.md`

**Everyone should be comfortable with:**

| Skill | Why |
|-------|-----|
| Create a ticket with clear title | Assign work |
| Set assignee and sprint | Know who owns what |
| Move ticket: To Do → In Progress → Done | Track progress |
| Add label `blocker` when stuck on partner | Don't suffer silently |
| Comment with updates | Partner stays informed |

**Simple rules we follow:**

- If it's not a Jira ticket, we agree on it in chat first before treating it as real work
- One assignee per ticket
- Labels: `member-a`, `member-b`, `collab`
- Close ticket only when PR is merged (for code tasks)

**New to Jira?** Member A sets up the project; we walk through it together in Week 1.

---

### Productivity tools (documents & presentations)

| What | Tool | When |
|------|------|------|
| Technical reports, sprint PDFs | **LaTeX** → PDF | Architecture, sprint plans |
| Supervisor forms, letters | **DOCX** (Word) → PDF if needed | Formal submissions |
| Mid-term, final, demo | **PPT / Google Slides** | Presentations |
| Notes, logs, this agreement | **Markdown** | Daily team docs |

We both **review presentation slides** before submitting to supervisor.

Suggested folder layout:
```
docs/
├── sprint-logs/       ← weekly logs (required)
├── meeting-notes/
├── presentations/
└── agreements/
```

---

## 7. Documenting your work

Each of us keeps a **weekly sprint log** so we can prove what we did and explain it in viva.

**File:** `docs/sprint-logs/<your-name>_sprint-<N>_log.md`  
**Update:** once per week (Sunday evening is fine)

**Include:**

- Dates and rough hours
- What you finished (link Jira ticket + PR)
- Problems you hit and how you solved them *(your own words)*
- Screenshot or test output if helpful
- What's next week
- Anything you're waiting on from your partner

**Template:** see Appendix at bottom of this file.

---

## 8. Original work, plagiarism & AI

We both want a fair FYP. Simple understanding:

### Original work

- Code and reports should be **our own work** (or properly cited)
- Copy-pasting from old FYP batches, random GitHub repos, or classmates without credit is **not okay**
- Stack Overflow / docs snippets are fine if we **understand them** and note the source
- We can ask each other to explain any commit before submission — that's normal, not an attack

### AI tools (ChatGPT, Copilot, Cursor, etc.)

AI is a **helper**, not a substitute for learning.

**Okay:**
- Debugging hints, boilerplate, drafting text we then rewrite
- Learning a concept we then implement ourselves

**Not okay:**
- Submitting AI-written sprint logs or viva answers as our own
- Merging code we cannot explain
- Fake "work done" entries

**Each weekly log includes one line:**  
`AI used this week: Yes/No — if yes, what for`

University AI policy overrides this if stricter.

---

## 9. Communication

| Situation | How we reach each other |
|-----------|-------------------------|
| Quick update | WhatsApp / Discord group |
| Task discussion | Jira comment |
| Code review | GitHub PR comment |
| Stuck / blocker | Message partner same day + Jira label `blocker` |
| Can't make a meeting | Tell partner **before** the meeting, reschedule |

**Meetings we try to keep:**

| Meeting | When |
|---------|------|
| Sprint planning | First week of each sprint |
| Weekly sync | Once per week (~30 min) |
| Sprint review | Last week of each sprint |
| Integration test | Weeks 4, 8, 12, 16, 20 |

Life happens — exams, family, health. Just **communicate early** and we adjust.

---

## 10. Integration & hardware

### Frozen contract (Sprint 1)

We agree on `contracts/events.py` together in Sprint 1 and don't change it casually after that.  
Changes need both of us + a note to supervisor if timeline shifts.

### Member B delivers (by Sprint 4–5)

- Merged PRs in `edge/inference/` and `edge/compliance_engine/`
- Model weights + ONNX export
- `edge/README.md` explaining handoff dict
- Available to answer questions during Member A's Jetson deploy

### Member A handles

- Jetson Nano + camera (custody)
- Flash, deploy, MQTT publisher, demo-day operation
- Full platform stack

Member B can **borrow the Jetson** for testing — just ask Member A first.

---

## 11. When things don't go to plan

We're teammates, not opponents. If deliverables slip or something feels unfair:

1. **Talk to each other first** — most issues are miscommunication  
2. **Look at the sprint plan and this agreement** — remind ourselves what we agreed  
3. **Adjust Jira tickets** together — replan is normal  
4. **Involve supervisor** only if we genuinely can't resolve it after a honest try  

We both benefit from the project succeeding. Early honesty beats late surprises.

---

## 12. Changes to this agreement

If our plan changes (timeline, scope, roles), we update this file together and save as `COLLABORATION_AGREEMENT_v2.x.md`. Big changes we mention to supervisor.

---

## 13. Sign-off

We have read this together and agree to follow it in good faith.

### Member A

- [ ] I know my scope: platform, MQTT, Jetson deploy  
- [ ] I will use GitHub + Jira and keep weekly logs  
- [ ] I will follow our 5-month sprint plan  
- [ ] I will document my work honestly  

**Name:** _________________ **Signature:** _________________ **Date:** _______

### Member B

- [ ] I know my scope: CV development only, handoff dict, no MQTT  
- [ ] I will use GitHub + Jira and keep weekly logs  
- [ ] I will follow our 5-month sprint plan  
- [ ] I will document my work honestly  

**Name:** _________________ **Signature:** _________________ **Date:** _______

---

## Appendix — Weekly sprint log template

Copy into `docs/sprint-logs/` each week:

```markdown
# Sprint Log — [Your Name] — Sprint [N] — Week [W]

**Dates:** YYYY-MM-DD to YYYY-MM-DD  
**Hours (approx):**  
**AI used:** Yes/No — [tool + purpose if yes]

## Done this week
- SSP-___ : [task] — PR #___

## Problems & how I solved them
- ...

## Proof (optional)
- screenshot / test output / link

## Next week
- ...

## Waiting on partner?
- ...
```

---

## Quick reference

```
MEMBER B                          MEMBER A
────────                          ────────
YOLO + compliance                 MQTT + full platform
→ handoff dict                    → Jetson deploy + demo
edge/inference/                   transport/ services/ frontend/
edge/compliance_engine/

        JOINT: sprint plan, contract, integration sessions, final demo
```

---

*Good luck to both of us — let's build something we're proud to demo.*
