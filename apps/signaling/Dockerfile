# syntax=docker/dockerfile:1

# Multi-stage build for the @cougny/signaling service.
# Built from the repo root:  docker build -f apps/signaling/Dockerfile .

# ---- base: node + pnpm via corepack ----------------------------------------
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# ---- build -----------------------------------------------------------------
FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# Build the workspace dependency (protocol) first, then the service.
RUN pnpm --filter @cougny/protocol build
RUN pnpm --filter @cougny/signaling build
# Produce a self-contained, production-only deployment (no dev deps, no symlinks).
RUN pnpm --filter @cougny/signaling deploy --prod --legacy /app

# ---- runtime: minimal ------------------------------------------------------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
EXPOSE 4001
USER node
CMD ["node", "dist/index.js"]
