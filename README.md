# Lumos

![CI](https://github.com/SLcode777/lumos/actions/workflows/ci.yml/badge.svg)

> A web-based PostgreSQL browser — simple, elegant, pleasant to use.

Lumos lets you connect to any PostgreSQL database and visually explore its contents (tables, columns, relations, data) from a browser, on any OS.

## Status

🚧 **Pre-alpha — work in progress. Not yet usable in production.**

## How it works

After deploying Lumos:
1. The first user to sign up becomes the admin
2. Users add a PostgreSQL connection (URL stored encrypted at rest)
3. Lumos introspects the schema and lets the user browse tables, columns, and rows
4. Admins can invite teammates to share connections (read-only for now)

## Self-host with Docker Compose

The fastest way to get a working Lumos instance on your own infrastructure.

### Prerequisites

- Docker and Docker Compose installed
- One or more PostgreSQL databases you want to browse — these stay where they are, Lumos just connects to them (Lumos manages its own internal database via Docker Compose — see "What's running" below)
- Roughly 1GB of free disk for the image + Postgres data volume

### Quick start

```bash
# Clone the repo and create your env
git clone https://github.com/SLcode777/lumos.git
cd lumos
cp .env.example .env

# Generate the two required secrets
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
# Set BETTER_AUTH_URL to your public URL (or leave http://localhost:3000 for local trial)

# Build + run
docker compose up -d --build
```

Lumos is now reachable at [http://localhost:3000](http://localhost:3000). The first user to sign up becomes the admin.

### What's running

| Container | Purpose |
|---|---|
| `lumos-app` | The Next.js application (stores users, sessions, encrypted connection strings in an embedded SQLite file at `/data/lumos.db`) |

Database migrations run automatically on every `docker compose up`. The SQLite database file persists in a named volume (`lumos-data`) — `docker compose down` keeps it; `docker compose down -v` wipes it. **Backups are trivial**: `docker cp lumos-app:/data/lumos.db ./backup-$(date +%F).db`.

### Production deployment

When hosting Lumos beyond `localhost`, set `BETTER_AUTH_URL` in `.env` to the public URL your team uses (e.g. `https://lumos.acme.com`). Better Auth uses it to generate OAuth callbacks and secure cookies — wrong value breaks sign-in.

For HTTPS: uncomment the `caddy` service in `docker-compose.yml`, copy `Caddyfile.example` → `Caddyfile`, customize the domain. Caddy provisions a Let's Encrypt cert automatically on first request, assuming your domain points at the host on ports 80 + 443.

### Updating

```bash
git pull
docker compose up -d --build
```

The entrypoint applies any new migrations on the next boot. **Never lose `ENCRYPTION_KEY`**: rotating it requires re-encrypting every stored connection string.


## Local development

### Prerequisites

- [Node.js](https://nodejs.org/) 22.13+
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) with Docker Compose

### Configuring secrets

> ⚠️ **Heads-up:** the npm scripts in this repo (`pnpm dev`, `pnpm db:up`, etc.) are **pre-wrapped with `infisical run --env=dev --`** because the maintainer uses [Infisical](https://infisical.com/) for secret management. Pick the option that fits your workflow before running the setup steps below.

#### Required environment variables

Whichever option you pick below, your `dev` environment must define:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file path for the application database. Local dev: `file:./lumos.db`. In Docker: `file:/data/lumos.db` (mounted volume). |
| `TEST_PG_URL` | *(optional, tests only)* Postgres URL used by integration tests in `lib/{connections,pool-manager,introspect}.test.ts`. Defaults match the bundled `db-demo` container: `postgresql://demo:demo@localhost:5434/shop`. |
| `BETTER_AUTH_SECRET` | Random 32-byte secret used by Better Auth to sign sessions |
| `BETTER_AUTH_URL` | Public URL of this Lumos instance (e.g. `http://localhost:3000` in dev) |
| `REGISTRATION_MODE` | `open`, `invite-only` (default), or `closed` — controls how new users can sign up |
| `ENCRYPTION_KEY` | AES-256 key (32 bytes, base64) used to encrypt user-saved PostgreSQL connection strings at rest |
| `INVITATION_TTL_DAYS` | *(optional)* default lifetime in days for newly-generated invitation tokens. Defaults to `7`. |

**Generating secrets**

```bash
# BETTER_AUTH_SECRET, ENCRYPTION_KEY (any 32-byte base64 secret)
openssl rand -base64 32
```

> ⚠️ Keep `ENCRYPTION_KEY` and `BETTER_AUTH_SECRET` confidential. Losing `ENCRYPTION_KEY` means losing access to all stored connection strings. Rotating it requires re-encrypting existing rows.

#### Option A — Use Infisical (no changes needed)

If you already use Infisical (self-hosted or cloud):

```bash
infisical login
infisical init   # link this folder to your Infisical project
```

Define the variables above in your Infisical `dev` environment. The npm scripts will inject them automatically at runtime.

#### Option B — Use a plain `.env` file

If you don't use Infisical, the wrapped scripts will fail (the `infisical` CLI won't be on your `PATH`). You need to strip the `infisical run --env=dev -- ` prefix from every wrapped script in `package.json`.

**Quickest way** — one-liner that does it for you (works on Linux and macOS):

```bash
perl -i -pe 's/infisical run --env=dev -- //g' package.json
```

**Manual way** — open `package.json` and replace the entire `"scripts"` block.

Before:

```json
"scripts": {
  "dev": "infisical run --env=dev -- next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "format": "prettier --write \"**/*.{ts,tsx}\"",
  "typecheck": "tsc --noEmit",
  "db:migrate": "infisical run --env=dev -- prisma migrate dev",
  "db:studio": "infisical run --env=dev -- prisma studio",
  "db:reset": "infisical run --env=dev -- prisma migrate reset",
  "test": "infisical run --env=dev -- vitest run",
  "test:watch": "infisical run --env=dev -- vitest",
  "test:ui": "infisical run --env=dev -- vitest --ui"
}
```

After:

```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "format": "prettier --write \"**/*.{ts,tsx}\"",
  "typecheck": "tsc --noEmit",
  "db:migrate": "prisma migrate dev",
  "db:studio": "prisma studio",
  "db:reset": "prisma migrate reset",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui"
}
```

Then create your `.env` from the template and fill in every variable listed above:

```bash
cp .env.example .env
# Edit .env with your generated secrets and connection details
```

Both Next.js and Prisma will pick up the values from `.env` automatically.

> 💡 **Note for contributors:** please don't commit changes to the wrapped scripts back upstream — they're intentional. If you're opening a PR with unrelated changes, revert your `package.json` edits first.

### Setup dev

Once your secrets are configured (Option A or B above):

```bash
# Install dependencies
pnpm install

# Apply database migrations (creates lumos.db locally on first run)
pnpm db:migrate

# Start the dev server
pnpm dev
```

The app is now running at [http://localhost:3000](http://localhost:3000).

### Useful scripts

| Script | Purpose |
|---|---|
| `pnpm db:migrate` | Create and apply a Prisma migration |
| `pnpm db:studio` | Open Prisma Studio (web UI for the application database) |
| `pnpm db:reset` | ⚠️ Drop all data and replay migrations from scratch |

### Running the integration tests

Unit tests run with no extra setup (`pnpm test`). The integration tests in `lib/{connections,pool-manager,introspect}.test.ts` open a real `pg` pool — they need a throwaway Postgres pointed at by `TEST_PG_URL`. The repo ships a `db-demo/` container that does the job (also used as a connection target for trying out Lumos locally):

```bash
cd db-demo && docker compose up -d   # starts Postgres on localhost:5434, auto-seeds from db-demo/init/*.sql
# In your env (Infisical or .env):
# TEST_PG_URL=postgresql://demo:demo@localhost:5434/shop
pnpm test
```

CI uses its own service-container Postgres seeded from `db-test/fixtures/*.sql` — no need to share local URLs.

## Roadmap

Lumos is built in 10 phases (see [PRD](./PRD.md) §5 for the detail). Status below reflects what is actually shipped on `master` — not what's planned.

| Phase | Status |
|---|---|
| **1. Foundations** — auth (Better Auth, email/password), admin invitations, role-based access, AES-256-GCM credential encryption, connections dashboard | 🚧 Mostly done (Docker self-host deploy + `.env.example` pending) |
| **2. Schema introspection** — auto-discovery of tables, columns, types, PKs, FKs, navigation sidebar | ✅ Done |
| **3. Data browsing** — paginated table view, type-aware cell rendering, row detail panel | 🚧 In progress (sort, FK humanization, inverse relation counts, image previews to come) |
| **4. Connection sharing** — owners share read-only access with viewers, credentials never exposed client-side | ⏳ Planned |
| **5. Filtering and search** — global search + type-aware combinable filters with safe SQL construction | ⏳ Planned |
| **6. Relational navigation** — follow FKs between records, reverse related records, breadcrumbs | ⏳ Planned |
| **7. Inline editing** — edit data in the detail view with optimistic updates and validation | ⏳ Planned |
| **8. Schema diagram** — interactive ERD visualization with React Flow + auto-layout | ⏳ Planned |
| **9. Export** — export filtered data as CSV / JSON | ⏳ Planned |
| **10. Layout customization** — column order, visibility, and widths persisted per connection | ⏳ Planned |

Granular tracking lives in [GitHub issues](https://github.com/SLcode777/lumos/issues) and [milestones](https://github.com/SLcode777/lumos/milestones).

## Documentation

- [PRD](./PRD.md) — Product vision, technical stack, architecture, data model, roadmap. *(Written in French.)*
- [CONTRIBUTING](./CONTRIBUTING.md) — How to contribute (work in progress).

## License

[MIT](./LICENSE)
