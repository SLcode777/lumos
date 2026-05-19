import { describe, expect, it } from "vitest"

import type { DatabaseSchema, TableInfo } from "@/lib/introspect"
import { fkLabelKey, lookupFkLabel, resolveForeignKeyLabels, type FkLabels } from "@/lib/resolve-fks"

// ─── Fixtures ────────────────────────────────────────────────────────────────

const customersTable: TableInfo = {
  schema: "public",
  name: "customers",
  rowCount: 100,
  primaryKey: ["id"],
  columns: [
    { name: "id", dataType: "uuid", udtName: "uuid", isNullable: false, defaultValue: null, ordinalPosition: 1 },
    { name: "full_name", dataType: "text", udtName: "text", isNullable: true, defaultValue: null, ordinalPosition: 2 },
  ],
}

const ordersTable: TableInfo = {
  schema: "public",
  name: "orders",
  rowCount: 500,
  primaryKey: ["id"],
  columns: [
    { name: "id", dataType: "uuid", udtName: "uuid", isNullable: false, defaultValue: null, ordinalPosition: 1 },
    {
      name: "customer_id",
      dataType: "uuid",
      udtName: "uuid",
      isNullable: true,
      defaultValue: null,
      ordinalPosition: 2,
    },
    { name: "shop_id", dataType: "integer", udtName: "int4", isNullable: true, defaultValue: null, ordinalPosition: 3 },
  ],
}

const shopsTable: TableInfo = {
  schema: "public",
  name: "shops",
  rowCount: 5,
  primaryKey: ["id"],
  columns: [
    { name: "id", dataType: "integer", udtName: "int4", isNullable: false, defaultValue: null, ordinalPosition: 1 },
    { name: "name", dataType: "text", udtName: "text", isNullable: true, defaultValue: null, ordinalPosition: 2 },
  ],
}

const schema: DatabaseSchema = {
  tables: [customersTable, ordersTable, shopsTable],
  foreignKeys: [
    {
      fromSchema: "public",
      fromTable: "orders",
      fromColumns: ["customer_id"],
      toSchema: "public",
      toTable: "customers",
      toColumns: ["id"],
      constraintName: "orders_customer_id_fkey",
    },
    {
      fromSchema: "public",
      fromTable: "orders",
      fromColumns: ["shop_id"],
      toSchema: "public",
      toTable: "shops",
      toColumns: ["id"],
      constraintName: "orders_shop_id_fkey",
    },
  ],
}

// Fake pool that records SQL + params and returns canned rows per call
function makePool(responder: (sql: string, params: unknown[]) => { rows: { pk: unknown; label: unknown }[] }) {
  const calls: { sql: string; params: unknown[] }[] = []
  const pool = {
    query: (sql: string, params: unknown[]) => {
      calls.push({ sql, params })
      return Promise.resolve(responder(sql, params))
    },
  } as unknown as import("pg").Pool
  return { pool, calls }
}

// ─── fkLabelKey ──────────────────────────────────────────────────────────────

describe("fkLabelKey", () => {
  it("composes a stable string from schema, table, value", () => {
    expect(fkLabelKey("public", "customers", "9f8a-uuid")).toBe("public.customers.9f8a-uuid")
  })

  it("coerces non-string values", () => {
    expect(fkLabelKey("public", "shops", 42)).toBe("public.shops.42")
  })
})

// ─── resolveForeignKeyLabels ─────────────────────────────────────────────────

describe("resolveForeignKeyLabels", () => {
  it("returns an empty map when there are no rows", async () => {
    const { pool, calls } = makePool(() => ({ rows: [] }))
    const result = await resolveForeignKeyLabels({ pool, schema, fromTable: ordersTable, rows: [] })
    expect(result.size).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it("returns an empty map when the source table has no eligible FKs", async () => {
    const { pool, calls } = makePool(() => ({ rows: [] }))
    // customersTable has no outgoing FKs in this schema
    const result = await resolveForeignKeyLabels({
      pool,
      schema,
      fromTable: customersTable,
      rows: [{ id: "c1", full_name: "Alice" }],
    })
    expect(result.size).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it("batches one query per target table, with distinct values only", async () => {
    const { pool, calls } = makePool((sql) => {
      if (sql.includes("customers")) {
        return {
          rows: [
            { pk: "c1", label: "Alice" },
            { pk: "c2", label: "Bob" },
          ],
        }
      }
      if (sql.includes("shops")) {
        return { rows: [{ pk: 1, label: "Acme" }] }
      }
      return { rows: [] }
    })

    const rows = [
      { id: "o1", customer_id: "c1", shop_id: 1 },
      { id: "o2", customer_id: "c2", shop_id: 1 }, // shop_id deduped
      { id: "o3", customer_id: "c1", shop_id: 1 }, // both deduped
    ]
    const result = await resolveForeignKeyLabels({ pool, schema, fromTable: ordersTable, rows })

    expect(calls).toHaveLength(2) // customers + shops, ONE each
    const customersCall = calls.find((c) => c.sql.includes("customers"))!
    expect(customersCall.params).toHaveLength(2) // c1, c2 deduped
    expect(new Set(customersCall.params)).toEqual(new Set(["c1", "c2"]))

    const shopsCall = calls.find((c) => c.sql.includes("shops"))!
    expect(shopsCall.params).toHaveLength(1) // 1 only

    expect(result.get("public.customers.c1")).toBe("Alice")
    expect(result.get("public.customers.c2")).toBe("Bob")
    expect(result.get("public.shops.1")).toBe("Acme")
  })

  it("escapes identifiers in the SQL it generates", async () => {
    const { pool, calls } = makePool(() => ({ rows: [] }))
    await resolveForeignKeyLabels({
      pool,
      schema,
      fromTable: ordersTable,
      rows: [{ id: "o1", customer_id: "c1", shop_id: null }],
    })
    const customersCall = calls.find((c) => c.sql.includes("customers"))!
    expect(customersCall.sql).toContain(`"id"`)
    expect(customersCall.sql).toContain(`"public"."customers"`)
    expect(customersCall.sql).toContain(`"full_name"`) // picked primary field
  })

  it("skips null FK values (no entry in the map, no value in the query)", async () => {
    const { pool, calls } = makePool((sql) => {
      if (sql.includes("customers")) return { rows: [{ pk: "c1", label: "Alice" }] }
      return { rows: [] }
    })
    const rows = [
      { id: "o1", customer_id: "c1", shop_id: null },
      { id: "o2", customer_id: null, shop_id: null },
    ]
    const result = await resolveForeignKeyLabels({ pool, schema, fromTable: ordersTable, rows })

    // shops group has zero non-null values → no query, no entry
    expect(calls.find((c) => c.sql.includes("shops"))).toBeUndefined()
    expect(result.has("public.shops.null")).toBe(false)
    expect(result.get("public.customers.c1")).toBe("Alice")
  })

  it("preserves a null primary-field value as `null` in the map (not absent)", async () => {
    // Target row exists but its primary field is NULL on that specific row.
    // This must be distinguishable from an orphan FK by the caller.
    const { pool } = makePool(() => ({ rows: [{ pk: "c1", label: null }] }))
    const result = await resolveForeignKeyLabels({
      pool,
      schema,
      fromTable: ordersTable,
      rows: [{ id: "o1", customer_id: "c1", shop_id: null }],
    })
    expect(result.has("public.customers.c1")).toBe(true)
    expect(result.get("public.customers.c1")).toBeNull()
  })

  it("does not fail when one of the target queries throws — other groups still resolve", async () => {
    const { pool } = makePool((sql) => {
      if (sql.includes("customers")) throw new Error("permission denied")
      if (sql.includes("shops")) return { rows: [{ pk: 1, label: "Acme" }] }
      return { rows: [] }
    })
    // Silence the console.error from the catch
    const original = console.error
    console.error = () => {}
    try {
      const result = await resolveForeignKeyLabels({
        pool,
        schema,
        fromTable: ordersTable,
        rows: [{ id: "o1", customer_id: "c1", shop_id: 1 }],
      })
      expect(result.has("public.customers.c1")).toBe(false)
      expect(result.get("public.shops.1")).toBe("Acme")
    } finally {
      console.error = original
    }
  })

  it("skips composite FKs (both source and target columns must be single)", async () => {
    const compositeSchema: DatabaseSchema = {
      tables: schema.tables,
      foreignKeys: [
        {
          fromSchema: "public",
          fromTable: "orders",
          fromColumns: ["a", "b"], // composite source
          toSchema: "public",
          toTable: "customers",
          toColumns: ["id"],
          constraintName: "fk_composite",
        },
      ],
    }
    const { pool, calls } = makePool(() => ({ rows: [] }))
    await resolveForeignKeyLabels({
      pool,
      schema: compositeSchema,
      fromTable: ordersTable,
      rows: [{ id: "o1", a: "x", b: "y" }],
    })
    expect(calls).toHaveLength(0)
  })
})

// ─── lookupFkLabel ───────────────────────────────────────────────────────────

describe("lookupFkLabel", () => {
  const fk = schema.foreignKeys[0] // orders.customer_id → customers.id

  it("returns undefined when the column is not an FK", () => {
    const labels: FkLabels = new Map()
    expect(lookupFkLabel(labels, undefined, "anything")).toBeUndefined()
  })

  it("returns undefined when the value is null", () => {
    const labels: FkLabels = new Map([["public.customers.c1", "Alice"]])
    expect(lookupFkLabel(labels, fk, null)).toBeUndefined()
    expect(lookupFkLabel(labels, fk, undefined)).toBeUndefined()
  })

  it("returns { kind: 'hit' } when the label is found", () => {
    const labels: FkLabels = new Map([["public.customers.c1", "Alice"]])
    expect(lookupFkLabel(labels, fk, "c1")).toEqual({ kind: "hit", label: "Alice" })
  })

  it("returns { kind: 'missing' } for orphan FKs (key absent)", () => {
    const labels: FkLabels = new Map([["public.customers.c1", "Alice"]])
    expect(lookupFkLabel(labels, fk, "c-orphan")).toEqual({ kind: "missing" })
  })

  it("returns undefined when the target row exists but the label is null on it", () => {
    const labels: FkLabels = new Map([["public.customers.c1", null]])
    expect(lookupFkLabel(labels, fk, "c1")).toBeUndefined()
  })

  it("skips composite FKs", () => {
    const composite = { ...fk, fromColumns: ["a", "b"] }
    const labels: FkLabels = new Map([["public.customers.c1", "Alice"]])
    expect(lookupFkLabel(labels, composite, "c1")).toBeUndefined()
  })
})
