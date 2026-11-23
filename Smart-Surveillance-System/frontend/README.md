# Frontend — IntelliSafe dashboard

React 19 + Vite + Tailwind 4 + Zustand + Recharts. Types and API DTOs come from `@intellisafe/contracts`.

## Screens

- **Header** — connection state (live / reconnecting), last update
- **KPI cards** — alerts (24 h), critical, unacknowledged, average compliance
- **Compliance gauge** (site compliance, workers, violations)
- **Trend chart** — compliance score, last hour
- **Live feed** — alerts pushed over WebSocket; CRITICAL alerts raise a toast
- **Alert history** — filters (priority, event, acknowledged), paging, acknowledge
- **Evidence modal** — frame, detections, metadata, acknowledge
- **Mock event panel** — sends `POST /api/simulate` and shows the end-to-end latency
- **Devices** — heartbeat status of edge devices

## Run

```bash
npm run dev -w @intellisafe/frontend       # http://localhost:5173, proxies /api and /ws to :3000
VITE_API_TARGET=https://host npm run dev -w @intellisafe/frontend
npm test -w @intellisafe/frontend          # vitest + jsdom
npm run build -w @intellisafe/frontend     # typecheck + production build
```

In Docker the production build is served by nginx (`infra/frontend.Dockerfile`), which proxies
`/api` and `/ws` to the API container.
