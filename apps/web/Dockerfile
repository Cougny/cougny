# syntax=docker/dockerfile:1

# Multi-stage build for the @cougny/web Next.js app.
# Built from the repo root:  docker build -f apps/web/Dockerfile .

# ---- base: node + pnpm via corepack ----------------------------------------
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# ---- build -----------------------------------------------------------------
FROM base AS build
# NEXT_PUBLIC_* values are inlined at build time; override via build args.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_SIGNALING_URL=ws://localhost:4001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SIGNALING_URL=$NEXT_PUBLIC_SIGNALING_URL
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# Build the workspace dependency (protocol) first, then the app.
RUN pnpm --filter @cougny/protocol build
RUN pnpm --filter @cougny/web build

# ---- runtime: minimal standalone server ------------------------------------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# Next.js standalone output (traced from the monorepo root) bundles a minimal
# server plus only the node_modules it actually needs.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

EXPOSE 3000
USER node
CMD ["node", "apps/web/server.js"]
