# Demo database

A throwaway PostgreSQL container with a populated e-commerce schema, designed
to demo Lumos features (FK resolution, type-aware rendering, image previews,
date columns, JSON, arrays, etc.) without exposing real data.

## Schema

Six tables in a small e-commerce model:

```
categories ◄─┐
             │
  products ──┘
     │
     │  ┌── reviews ──┐
     │  │             │
     ▼  ▼             ▼
order_items ◄── orders ◄── users
```

- **categories** (10 rows) — Electronics, Books, Clothing, …
- **users** (25 rows) — realistic profiles with bios, avatars, JSONB preferences, text[] tags
- **products** (30 rows) — across all categories, with image URLs (loadable Picsum images), JSONB metadata, ratings
- **orders** (80 rows) — varied statuses (pending, paid, shipped, delivered, cancelled, refunded), JSONB shipping addresses
- **order_items** (~200 rows) — junction table between orders and products
- **reviews** (~80 rows) — product reviews with realistic rating distribution

## Start

From this folder:

```bash
docker compose up -d
```

The container `lumos-demo-db` boots on **host port 5434** (so it doesn't clash
with Lumos's own application DB on 5433). On first start, the schema and seed
SQL run automatically via Postgres's `/docker-entrypoint-initdb.d/`.

## Connection string for Lumos

Add a new connection in Lumos with:

```
postgresql://demo:demo@localhost:5434/shop
```

(If you self-host Lumos in the same Docker network, use `localhost` only if
Lumos runs outside Docker. From inside another container, use the host's
internal IP or `host.docker.internal` — your choice depends on your setup.)

## Reset

```bash
docker compose down -v   # wipes the volume → next `up` re-runs the seed
docker compose up -d
```

## Stop

```bash
docker compose down      # stops the container, keeps the data volume
docker compose down -v   # also wipes data
```

## Notes

- **Image URLs use Picsum + Flaticon** — they load real images at runtime, so
  Lumos's future image-preview feature (#32) will display actual thumbnails.
- **All timestamps are deterministic** within a date range (April 2025 →
  April 2026) so the demo looks the same every time.
- **No real personal data** — emails are `firstname.lastname@example.com`-style.
- **Postgres 16 alpine**, same major version Lumos itself uses.