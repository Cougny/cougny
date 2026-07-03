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
# A dummy URL so `prisma generate` (which never connects) can validate config.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @cougny/db generate
# Build workspace dependencies (protocol, db) first, then the service.
RUN pnpm --filter @cougny/protocol build
RUN pnpm --filter @cougny/db build
RUN pnpm --filter @cougny/signaling build
# Produce a self-contained, production-only deployment (no dev deps, no symlinks).
RUN pnpm --filter @cougny/signaling deploy --prod --legacy /app
# `pnpm deploy` copies the pristine `@prisma/client` from the store but not the
# generated client, which Prisma emits into a sibling `.prisma` directory next
# to `@prisma/client`. The client was already generated in the `/repo` tree
# during the build steps above, so copy that generated `.prisma` directory into
# the matching location in the deployed `/app` store.
RUN set -eu; \
    SRC_PRISMA="$(find /repo/node_modules/.pnpm -maxdepth 4 -type d -name '.prisma' -path '*@prisma+client*' | head -1)"; \
    APP_CLIENT="$(find /app/node_modules/.pnpm -maxdepth 4 -type d -path '*@prisma+client*/node_modules/@prisma/client' | head -1)"; \
    DEST_NM="$(dirname "$(dirname "$APP_CLIENT")")"; \
    test -n "$SRC_PRISMA" && test -n "$DEST_NM"; \
    echo "Copying generated Prisma client: $SRC_PRISMA -> $DEST_NM/.prisma"; \
    cp -R "$SRC_PRISMA" "$DEST_NM/.prisma"; \
    node -e "const p=require(require.resolve('@prisma/client',{paths:[require('fs').realpathSync('/app/node_modules/@cougny/db')]})); if(typeof p.PrismaClient!=='function') throw new Error('generated PrismaClient not found'); console.log('Generated Prisma client present and loadable')"

# ---- runtime: minimal ------------------------------------------------------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
EXPOSE 4001
USER node
CMD ["node", "dist/index.js"]
