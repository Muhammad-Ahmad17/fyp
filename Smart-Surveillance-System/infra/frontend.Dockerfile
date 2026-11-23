# Dashboard: Vite build served by nginx, which also proxies /api and /ws to the api service.
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages ./packages
COPY frontend ./frontend
COPY services/bridge/package.json ./services/bridge/package.json
COPY services/simulator/package.json ./services/simulator/package.json
COPY services/api/package.json ./services/api/package.json
RUN npm ci --ignore-scripts
COPY tsconfig.base.json ./
RUN npm run build -w @intellisafe/frontend

FROM nginx:1.27-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
