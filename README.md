# Lumos

> A web-based PostgreSQL browser — simple, elegant, pleasant to use.

Lumos lets you connect to any PostgreSQL database and visually explore its contents (tables, columns, relations, data) from a browser, on any OS.

## Status

🚧 **Pre-alpha — work in progress.**

The project is in design and early development. Not yet usable.

## Local development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) with Docker Compose

### Configuring secrets

> ⚠️ **Heads-up:** the npm scripts in this repo (`pnpm dev`, `pnpm db:up`, etc.) are **pre-wrapped with `infisical run --env=dev --`** because the maintainer uses [Infisical](https://infisical.com/) for secret management. Pick the option that fits your workflow before running the setup steps below.

#### Required environment variables

Whichever option you pick below, your `dev` environment must define:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma connection string for the application database (e.g. `postgresql://lumos:<password>@localhost:5433/lumos?schema=public`) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Used by Docker Compose to bootstrap the application Postgres container |
| `BETTER_AUTH_SECRET` | Random 32-byte secret used by Better Auth to sign sessions |
| `BETTER_AUTH_URL` | Public URL of this Lumos instance (e.g. `http://localhost:3000` in dev) |
| `REGISTRATION_MODE` | `open`, `invite-only` (default), or `closed` — controls how new users can sign up |
| `ENCRYPTION_KEY` | AES-256 key (32 bytes, base64) used to encrypt user-saved PostgreSQL connection strings at rest |
| `INVITATION_TTL_DAYS` | *(optional)* default lifetime in days for newly-generated invitation tokens. Defaults to `7`. |

**Generating secrets**

```bash
# BETTER_AUTH_SECRET, ENCRYPTION_KEY (any 32-byte base64 secret)
openssl rand -base64 32

# POSTGRES_PASSWORD (alphanumeric, URL-safe in connection strings)
pwgen -sB 32 1
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

If you don't use Infisical, the wrapped scripts will fail (the `infisical` CLI won't be on your `PATH`). Open `package.json` and **replace each wrapped script with its bare version**:

| Replace this script… | …with this |
|---|---|
| `"dev": "infisical run --env=dev -- next dev --turbopack"` | `"dev": "next dev --turbopack"` |
| `"db:up": "infisical run --env=dev -- docker compose up -d postgres-app"` | `"db:up": "docker compose up -d postgres-app"` |
| `"db:down": "infisical run --env=dev -- docker compose down"` | `"db:down": "docker compose down"` |
| `"db:migrate": "infisical run --env=dev -- prisma migrate dev"` | `"db:migrate": "prisma migrate dev"` |
| `"db:studio": "infisical run --env=dev -- prisma studio"` | `"db:studio": "prisma studio"` |
| `"db:reset": "infisical run --env=dev -- prisma migrate reset"` | `"db:reset": "prisma migrate reset"` |

Then create your `.env` from the template and fill in every variable listed above:

```bash
cp .env.example .env
# Edit .env with your generated secrets and connection details
```

Both Next.js and Prisma will pick up the values from `.env` automatically.

> 💡 **Note for contributors:** please don't commit changes to the wrapped scripts back upstream — they're intentional. If you're opening a PR with unrelated changes, revert your `package.json` edits first.

### Setup

Once your secrets are configured (Option A or B above):

```bash
# Install dependencies
pnpm install

# Start the application database (PostgreSQL via Docker Compose)
pnpm db:up

# Apply database migrations
pnpm db:migrate

# Start the dev server
pnpm dev
```

The app is now running at [http://localhost:3000](http://localhost:3000).

### Useful scripts

| Script | Purpose |
|---|---|
| `pnpm db:up` | Start the application Postgres container |
| `pnpm db:down` | Stop it |
| `pnpm db:logs` | Tail Postgres logs |
| `pnpm db:migrate` | Create and apply a Prisma migration |
| `pnpm db:studio` | Open Prisma Studio (web UI for the application database) |
| `pnpm db:reset` | ⚠️ Drop all data and replay migrations from scratch |

## Documentation

- [PRD](./PRD.md) — Product vision, technical stack, architecture, data model, roadmap. *(Written in French.)*
- [CONTRIBUTING](./CONTRIBUTING.md) — How to contribute (work in progress).

## License

[MIT](./LICENSE)
