#!/bin/sh
# Lumos container entrypoint.
#
# Runs Prisma migrations against the configured DATABASE_URL, then exec's into
# the CMD passed by the Dockerfile (typically `node server.js`). Migrations
# are idempotent — running this on an already-up-to-date database is a no-op.
#
# Fails fast: any non-zero exit aborts startup so docker-compose marks the
# container unhealthy rather than running with a stale schema.

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] FATAL: DATABASE_URL is not set" >&2
  exit 1
fi

echo "[entrypoint] applying database migrations..."
./node_modules/.bin/prisma migrate deploy

echo "[entrypoint] starting Lumos..."
exec "$@"