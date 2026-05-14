import { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { introspectSchema, type DatabaseSchema } from "@/lib/introspect"

let pool: Pool
let schema: DatabaseSchema

beforeAll(async () => {
  if (!process.env.TEST_PG_URL) {
    throw new Error(
      "TEST_PG_URL not set — start the db-demo container (cd db-demo && docker compose up -d) and set TEST_PG_URL=postgresql://demo:demo@localhost:5434/shop"
    )
  }
  pool = new Pool({ connectionString: process.env.TEST_PG_URL })
  schema = await introspectSchema(pool)
}, 15_000)

afterAll(async () => {
  await pool.end()
})

describe("introspectSchema", () => {
  it("filters out system schemas", () => {
    for (const t of schema.tables) {
      expect(t.schema).not.toMatch(/^pg_/)
      expect(t.schema).not.toBe("information_schema")
    }
  })

  it("returns the demo e-commerce tables", () => {
    const names = schema.tables.map((t) => t.name)
    expect(names).toContain("users")
    expect(names).toContain("products")
    expect(names).toContain("orders")
    expect(names).toContain("order_items")
    expect(names).toContain("reviews")
    expect(names).toContain("categories")
  })

  it("detects the users primary key (UUID)", () => {
    const usersTable = schema.tables.find((t) => t.name === "users")
    expect(usersTable?.primaryKey).toEqual(["id"])
  })

  it("detects the orders.user_id → users.id foreign key", () => {
    const fk = schema.foreignKeys.find((f) => f.fromTable === "orders" && f.fromColumns.includes("user_id"))
    expect(fk).toBeDefined()
    expect(fk?.toTable).toBe("users")
    expect(fk?.toColumns).toEqual(["id"])
  })

  it("returns columns ordered by ordinal_position", () => {
    const usersTable = schema.tables.find((t) => t.name === "users")
    expect(usersTable).toBeDefined()
    if (!usersTable) return
    for (let i = 1; i < usersTable.columns.length; i++) {
      expect(usersTable.columns[i].ordinalPosition).toBeGreaterThan(usersTable.columns[i - 1].ordinalPosition)
    }
  })

  it("returns row count estimates as numbers >= 0 (or -1 if missing)", () => {
    for (const t of schema.tables) {
      expect(typeof t.rowCountEstimate).toBe("number")
      expect(t.rowCountEstimate).toBeGreaterThanOrEqual(-1)
    }
  })

  it("captures column metadata: nullability, defaults, types", () => {
    const usersTable = schema.tables.find((t) => t.name === "users")
    expect(usersTable).toBeDefined()
    if (!usersTable) return
    const email = usersTable.columns.find((c) => c.name === "email")
    expect(email?.dataType).toBe("text")
    expect(email?.isNullable).toBe(false)
  })
})