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

#### Option A — Use Infisical (no changes needed)

If you already use Infisical (self-hosted or cloud):

```bash
infisical login
infisical init   # link this folder to your Infisical project
```

Make sure your Infisical `dev` environment defines:
`DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`.

The npm scripts will inject your secrets automatically at runtime.

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

Then create your `.env` from the template:

```bash
cp .env.example .env
# Edit .env and fill in: DATABASE_URL, POSTGRES_USER, POSTGRES_PASSWORD,
# POSTGRES_DB, POSTGRES_PORT
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
