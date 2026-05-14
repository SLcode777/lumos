# syntax=docker/dockerfile:1.7

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: deps — install all dependencies (dev + prod) for the builder.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# libc6-compat is required by some optional native deps (sharp, etc.) on alpine.
RUN apk add --no-cache libc6-compat \
 && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# `--config.node-linker=hoisted` forces a flat node_modules without pnpm's
# symlink structure. Reason: the runner stage COPYs subsets of node_modules
# (prisma, @prisma) from this stage. pnpm's default isolated linker stores
# files in `node_modules/.pnpm/` with symlinks pointing to them — Docker COPY
# preserves symlinks but doesn't follow them, so copying just `@prisma` would
# leave broken symlinks pointing nowhere, causing `Cannot find module
# '@prisma/engines'` at runtime.
RUN pnpm install --frozen-lockfile --config.node-linker=hoisted

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: builder — generate Prisma client, build Next.js standalone output.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat \
 && corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Prisma generate doesn't need DATABASE_URL — only `prisma migrate` does.
RUN pnpm exec prisma generate \
 && pnpm exec next build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: runner — minimal image that runs the built app.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# tini reaps zombies and forwards SIGTERM properly to the Node process.
RUN apk add --no-cache tini \
 && addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Next.js standalone bundle (server.js + the trimmed-down node_modules subset
# that Next 16 ships at runtime — does NOT include Prisma).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma runtime: schema for migrate deploy, the SQL migrations themselves,
# the generated client (used by the app), AND the TypeScript config file at
# the project root that wires DATABASE_URL into prisma's datasource block
# (Prisma 7 reads `prisma.config.ts` from the working directory).
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/generated ./generated

# Full node_modules from the builder: the Prisma CLI has a long chain of
# transitive deps (@prisma/engines, @prisma/config, effect, …) and copying
# them surgically is whack-a-mole. This MERGES into the standalone subset
# already at ./node_modules (Docker COPY adds new files, overwrites same
# paths — both copies come from the same build, so overwrites are no-ops).
# Trade-off: image grows ~150MB, acceptable for a self-hosted tool.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Entrypoint script: runs `prisma migrate deploy` then execs the CMD.
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Make the entrypoint executable and create the SQLite data dir owned by the
# non-root user that will run the app.
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /data \
 && chown nextjs:nodejs /data

USER nextjs
EXPOSE 3000

ENTRYPOINT ["tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]