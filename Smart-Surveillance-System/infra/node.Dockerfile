# One Dockerfile for the three Node services. Build context = Smart-Surveillance-System/
#   docker build -f infra/node.Dockerfile --target bridge    -t intellisafe-bridge .
#   docker build -f infra/node.Dockerfile --target simulator -t intellisafe-simulator .
#   docker build -f infra/node.Dockerfile --target api       -t intellisafe-api .

FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages ./packages
COPY services ./services
COPY frontend/package.json ./frontend/package.json
RUN npm ci --ignore-scripts
COPY tsconfig.base.json ./
RUN for s in bridge simulator api; do npm run build -w @intellisafe/$s; done

# Production node_modules only (runtime deps are not bundled; workspace packages are).
FROM node:22-alpine AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY services/bridge/package.json ./services/bridge/package.json
COPY services/simulator/package.json ./services/simulator/package.json
COPY services/api/package.json ./services/api/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --omit=dev --ignore-scripts \
      -w @intellisafe/bridge -w @intellisafe/simulator -w @intellisafe/api

FROM node:22-alpine AS runtime-base
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /repo/node_modules ./node_modules
USER node

FROM runtime-base AS bridge
COPY --from=build /repo/services/bridge/dist ./dist
CMD ["node", "dist/main.js"]

FROM runtime-base AS simulator
COPY --from=build /repo/services/simulator/dist ./dist
CMD ["node", "dist/main.js"]

FROM runtime-base AS api
ENV EVIDENCE_DIR=/app/evidence MIGRATIONS_DIR=/app/drizzle PORT=3000
COPY --from=build /repo/services/api/dist ./dist
COPY --from=build /repo/services/api/drizzle ./drizzle
# Evidence frames served at /api/evidence/samples/*
COPY edge/inference/samples ./evidence/samples
# Frames uploaded by the edge device (POST /api/evidence) land here; mounted as a volume in compose.
USER root
RUN mkdir -p /app/evidence/uploads && chown node:node /app/evidence/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "dist/server.js"]
