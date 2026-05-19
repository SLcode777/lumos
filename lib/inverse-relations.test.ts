import { describe, expect, it } from "vitest"

import type { DatabaseSchema, TableInfo } from "@/lib/introspect"
import {
  countInverseRelationsForPage,
  humanizeTableName,
  inverseCountKey,
  inverseRelationKey,
  pluralizeRecord,
} from "@/lib/inverse-relations"

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
  ],
}

const reviewsTable: TableInfo = {
  schema: "public",
  name: "reviews",
  rowCount: 50,
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
  ],
}

const auditLogTable: TableInfo = {
  schema: "public",
  name: "audit_logs",
  rowCount: 1000,
  primaryKey: ["id"],
  columns: [
    { name: "id", dataType: "uuid", udtName: "uuid", isNullable: false, defaultValue: null, ordinalPosition: 1 },
    {
      name: "created_by_id",
      dataType: "uuid",
      udtName: "uuid",
      isNullable: true,
      defaultValue: null,
      ordinalPosition: 2,
    },
    {
      name: "updated_by_id",
      dataType: "uuid",
      udtName: "uuid",
      isNullable: true,
      defaultValue: null,
      ordinalPosition: 3,
    },
  ],
}

const schema: DatabaseSchema = {
  tables: [customersTable, ordersTable, reviewsTable, auditLogTable],
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
      fromTable: "reviews",
      fromColumns: ["customer_id"],
      toSchema: "public",
      toTable: "customers",
      toColumns: ["id"],
      constraintName: "reviews_customer_id_fkey",
    },
    {
      fromSchema: "public",
      fromTable: "audit_logs",
      fromColumns: ["created_by_id"],
      toSchema: "public",
      toTable: "customers",
      toColumns: ["id"],
      constraintName: "audit_logs_created_by_id_fkey",
    },
    {
      fromSchema: "public",
      fromTable: "audit_logs",
      fromColumns: ["updated_by_id"],
      toSchema: "public",
      toTable: "customers",
      toColumns: ["id"],
      constraintName: "audit_logs_updated_by_id_fkey",
    },
  ],
}

type GroupedRow = { pk: string; n: string }

function makePool(responder: (sql: string, params: unknown[]) => { rows: GroupedRow[] }) {
  const calls: { sql: string; params: unknown[] }[] = []
  const pool = {
    query: (sql: string, params: unknown[]) => {
      calls.push({ sql, params })
      return Promise.resolve(responder(sql, params))
    },
  } as unknown as import("pg").Pool
  return { pool, calls }
}

// ─── humanizeTableName ──────────────────────────────────────────────────────

describe("humanizeTableName", () => {
  it.each([
    ["orders", "Orders"],
    ["order_items", "Order Items"],
    ["audit_logs", "Audit Logs"],
    ["v2_audit_log", "V2 Audit Log"],
    ["", ""],
    ["a", "A"],
    ["_leading_underscore", " Leading Underscore"],
  ])("humanizeTableName(%s) = %s", (input, expected) => {
    expect(humanizeTableName(input)).toBe(expected)
  })
})

// ─── pluralizeRecord ─────────────────────────────────────────────────────────

describe("pluralizeRecord", () => {
  it.each([
    [0, "0 records"],
    [1, "1 record"],
    [2, "2 records"],
    [42, "42 records"],
  ])("pluralizeRecord(%i) = %s", (count, expected) => {
    expect(pluralizeRecord(count)).toBe(expected)
  })
})

// ─── inverseRelationKey / inverseCountKey ────────────────────────────────────

describe("key helpers", () => {
  const meta = { sourceSchema: "public", sourceTable: "orders", fromColumn: "customer_id", ambiguous: false }
  it("inverseRelationKey is schema.table.column", () => {
    expect(inverseRelationKey(meta)).toBe("public.orders.customer_id")
  })
  it("inverseCountKey is pkString|relationKey", () => {
    expect(inverseCountKey("c1", meta)).toBe("c1|public.orders.customer_id")
  })
})

// ─── countInverseRelationsForPage ────────────────────────────────────────────

describe("countInverseRelationsForPage", () => {
  it("returns empty when current table has no PK", async () => {
    const { pool, calls } = makePool(() => ({ rows: [] }))
    const noPkTable: TableInfo = { ...customersTable, primaryKey: [] }
    const result = await countInverseRelationsForPage({
      pool,
      schema,
      currentTable: noPkTable,
      rows: [{ id: "c1" }],
    })
    expect(result.meta).toEqual([])
    expect(result.counts.size).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it("returns empty when current table has a composite PK", async () => {
    const { pool, calls } = makePool(() => ({ rows: [] }))
    const composite: TableInfo = { ...customersTable, primaryKey: ["a", "b"] }
    const result = await countInverseRelationsForPage({
      pool,
      schema,
      currentTable: composite,
      rows: [{ id: "c1" }],
    })
    expect(result.meta).toEqual([])
    expect(calls).toHaveLength(0)
  })

  it("returns empty meta when no FK points to currentTable", async () => {
    const { pool, calls } = makePool(() => ({ rows: [] }))
    const leafSchema: DatabaseSchema = { tables: schema.tables, foreignKeys: [] }
    const result = await countInverseRelationsForPage({
      pool,
      schema: leafSchema,
      currentTable: customersTable,
      rows: [{ id: "c1" }],
    })
    expect(result.meta).toEqual([])
    expect(calls).toHaveLength(0)
  })

  it("returns meta sorted alphabetically by (sourceTable, fromColumn)", async () => {
    const { pool } = makePool(() => ({ rows: [] }))
    const result = await countInverseRelationsForPage({
      pool,
      schema,
      currentTable: customersTable,
      rows: [{ id: "c1" }],
    })
    expect(result.meta.map((m) => `${m.sourceTable}.${m.fromColumn}`)).toEqual([
      "audit_logs.created_by_id",
      "audit_logs.updated_by_id",
      "orders.customer_id",
      "reviews.customer_id",
    ])
  })

  it("marks ambiguous when the same source table has multiple FKs to us", async () => {
    const { pool } = makePool(() => ({ rows: [] }))
    const result = await countInverseRelationsForPage({
      pool,
      schema,
      currentTable: customersTable,
      rows: [{ id: "c1" }],
    })
    const audit = result.meta.filter((m) => m.sourceTable === "audit_logs")
    expect(audit).toHaveLength(2)
    expect(audit.every((m) => m.ambiguous)).toBe(true)

    const orders = result.meta.find((m) => m.sourceTable === "orders")!
    expect(orders.ambiguous).toBe(false)
  })

  it("runs one query per inverse FK in parallel, with batched IN clause", async () => {
    const rows = [{ id: "c1" }, { id: "c2" }, { id: "c3" }]
    const { pool, calls } = makePool((sql, params) => {
      if (sql.includes("orders"))
        return {
          rows: [
            { pk: "c1", n: "5" },
            { pk: "c2", n: "2" },
          ],
        }
      if (sql.includes("reviews")) return { rows: [{ pk: "c3", n: "1" }] }
      if (sql.includes("created_by_id")) return { rows: [{ pk: "c1", n: "3" }] }
      if (sql.includes("updated_by_id")) return { rows: [{ pk: "c2", n: "7" }] }
      return { rows: [] }
    })

    const result = await countInverseRelationsForPage({
      pool,
      schema,
      currentTable: customersTable,
      rows,
    })

    expect(calls).toHaveLength(4)
    // Same param list (the page's PK values) on every query.
    for (const call of calls) {
      expect(call.params).toEqual(["c1", "c2", "c3"])
      expect(call.sql).toContain("IN ($1, $2, $3)")
      expect(call.sql).toContain("GROUP BY")
    }

    // Spot-check counts
    expect(result.counts.get("c1|public.orders.customer_id")).toBe(5)
    expect(result.counts.get("c2|public.orders.customer_id")).toBe(2)
    expect(result.counts.get("c3|public.reviews.customer_id")).toBe(1)
    expect(result.counts.get("c1|public.audit_logs.created_by_id")).toBe(3)
    expect(result.counts.get("c2|public.audit_logs.updated_by_id")).toBe(7)
  })

  it("absent counts default to 0 via the call-site contract", async () => {
    const rows = [{ id: "c1" }, { id: "c2" }]
    const { pool } = makePool((sql) => {
      // orders returns only c1 — c2 should be absent from the map.
      if (sql.includes("orders")) return { rows: [{ pk: "c1", n: "5" }] }
      return { rows: [] }
    })
    const result = await countInverseRelationsForPage({
      pool,
      schema,
      currentTable: customersTable,
      rows,
    })
    expect(result.counts.has("c2|public.orders.customer_id")).toBe(false)
    // Caller-side: `counts.get(key) ?? 0`
    expect(result.counts.get("c2|public.orders.customer_id") ?? 0).toBe(0)
  })

  it("deduplicates PK values before placeholders", async () => {
    // Same PK appearing twice — shouldn't generate $1, $2 for the same value.
    const rows = [{ id: "c1" }, { id: "c1" }]
    const { pool, calls } = makePool(() => ({ rows: [] }))
    await countInverseRelationsForPage({
      pool,
      schema,
      currentTable: customersTable,
      rows,
    })
    for (const call of calls) {
      expect(call.params).toEqual(["c1"])
      expect(call.sql).toContain("IN ($1)")
    }
  })

  it("skips rows with null/undefined PK values", async () => {
    const rows = [{ id: null }, { id: "c1" }, { id: undefined }]
    const { pool, calls } = makePool(() => ({ rows: [] }))
    await countInverseRelationsForPage({
      pool,
      schema,
      currentTable: customersTable,
      rows,
    })
    for (const call of calls) {
      expect(call.params).toEqual(["c1"])
    }
  })

  it("returns meta but empty counts when no row has a valid PK", async () => {
    const rows = [{ id: null }, { id: null }]
    const { pool, calls } = makePool(() => ({ rows: [] }))
    const result = await countInverseRelationsForPage({
      pool,
      schema,
      currentTable: customersTable,
      rows,
    })
    expect(result.meta).toHaveLength(4)
    expect(result.counts.size).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it("escapes identifiers and parameterizes values", async () => {
    const { pool, calls } = makePool(() => ({ rows: [{ pk: "c1", n: "1" }] }))
    await countInverseRelationsForPage({
      pool,
      schema,
      currentTable: customersTable,
      rows: [{ id: "c1" }],
    })
    const sample = calls[0]
    expect(sample.sql).toMatch(/FROM "public"\."(orders|reviews|audit_logs)"/)
    expect(sample.sql).toMatch(/SELECT "[a-z_]+" AS pk/)
    expect(sample.params).toEqual(["c1"])
  })

  it("drops failed queries silently, keeps the others", async () => {
    const { pool } = makePool((sql) => {
      if (sql.includes("orders")) throw new Error("permission denied")
      return { rows: [{ pk: "c1", n: "1" }] }
    })
    const original = console.error
    console.error = () => {}
    try {
      const result = await countInverseRelationsForPage({
        pool,
        schema,
        currentTable: customersTable,
        rows: [{ id: "c1" }],
      })
      // orders meta is still in the list (computed from schema, not query result)
      expect(result.meta.some((m) => m.sourceTable === "orders")).toBe(true)
      // But no entry in counts → UI renders 0
      expect(result.counts.has("c1|public.orders.customer_id")).toBe(false)
      // Other tables still counted
      expect(result.counts.get("c1|public.reviews.customer_id")).toBe(1)
    } finally {
      console.error = original
    }
  })

  it("skips composite FKs (both sides single-column required)", async () => {
    const compositeSchema: DatabaseSchema = {
      tables: schema.tables,
      foreignKeys: [
        {
          fromSchema: "public",
          fromTable: "audit_logs",
          fromColumns: ["a", "b"],
          toSchema: "public",
          toTable: "customers",
          toColumns: ["id"],
          constraintName: "fk_composite_source",
        },
      ],
    }
    const { pool, calls } = makePool(() => ({ rows: [] }))
    const result = await countInverseRelationsForPage({
      pool,
      schema: compositeSchema,
      currentTable: customersTable,
      rows: [{ id: "c1" }],
    })
    expect(result.meta).toEqual([])
    expect(calls).toHaveLength(0)
  })
})

import { fetchRelatedRows, RELATED_ROWS_LIMIT } from "@/lib/inverse-relations"

describe("fetchRelatedRows", () => {
  type AnyRow = Record<string, unknown>

  function makeFetchPool(handlers: {
    /** Match by SQL substring. Order matters — first match wins. */
    onQuery: (sql: string, params: unknown[]) => { rows: AnyRow[] }
  }) {
    const calls: { sql: string; params: unknown[] }[] = []
    const pool = {
      query: (sql: string, params: unknown[]) => {
        calls.push({ sql, params })
        return Promise.resolve(handlers.onQuery(sql, params))
      },
    } as unknown as import("pg").Pool
    return { pool, calls }
  }

  const ordersMeta = {
    sourceSchema: "public" as const,
    sourceTable: "orders" as const,
    fromColumn: "customer_id" as const,
    ambiguous: false,
  }

  it("returns null when the source table is not in the schema", async () => {
    const { pool } = makeFetchPool({ onQuery: () => ({ rows: [] }) })
    const result = await fetchRelatedRows({
      pool,
      schema: { tables: [customersTable], foreignKeys: [] },
      meta: ordersMeta,
      parentPk: "c1",
    })
    expect(result).toBeNull()
  })

  it("returns null when parentPk is empty", async () => {
    const { pool } = makeFetchPool({ onQuery: () => ({ rows: [] }) })
    const result = await fetchRelatedRows({
      pool,
      schema,
      meta: ordersMeta,
      parentPk: "",
    })
    expect(result).toBeNull()
  })

  it("builds the right SQL and parameters", async () => {
    const { pool, calls } = makeFetchPool({
      onQuery: (sql) => {
        if (sql.startsWith("SELECT COUNT")) return { rows: [{ n: "2" }] }
        if (sql.startsWith("SELECT *"))
          return {
            rows: [
              { id: "o1", customer_id: "c1" },
              { id: "o2", customer_id: "c1" },
            ],
          }
        return { rows: [] }
      },
    })

    const result = await fetchRelatedRows({ pool, schema, meta: ordersMeta, parentPk: "c1" })

    expect(result).not.toBeNull()
    expect(result!.rows).toHaveLength(2)
    expect(result!.total).toBe(2)
    expect(result!.sourceTable.name).toBe("orders")

    const selectCall = calls.find((c) => c.sql.startsWith("SELECT *"))!
    expect(selectCall.sql).toContain(`FROM "public"."orders"`)
    expect(selectCall.sql).toContain(`WHERE "customer_id" = $1`)
    expect(selectCall.sql).toContain(`ORDER BY "id" ASC`) // first PK column default
    expect(selectCall.sql).toMatch(/LIMIT \$2$/)
    expect(selectCall.params).toEqual(["c1", RELATED_ROWS_LIMIT])
  })

  it("honors explicit sort over the PK default", async () => {
    const { pool, calls } = makeFetchPool({
      onQuery: (sql) => {
        if (sql.startsWith("SELECT COUNT")) return { rows: [{ n: "0" }] }
        return { rows: [] }
      },
    })

    await fetchRelatedRows({
      pool,
      schema,
      meta: ordersMeta,
      parentPk: "c1",
      sort: { column: "customer_id", direction: "desc" },
    })

    const selectCall = calls.find((c) => c.sql.startsWith("SELECT *"))!
    expect(selectCall.sql).toContain(`ORDER BY "customer_id" DESC`)
  })

  it("reports total even when total > limit (truncation case)", async () => {
    const { pool } = makeFetchPool({
      onQuery: (sql) => {
        if (sql.startsWith("SELECT COUNT")) return { rows: [{ n: "130" }] }
        return { rows: Array.from({ length: 50 }, (_, i) => ({ id: `o${i}`, customer_id: "c1" })) }
      },
    })

    const result = await fetchRelatedRows({ pool, schema, meta: ordersMeta, parentPk: "c1" })

    expect(result!.rows).toHaveLength(50)
    expect(result!.total).toBe(130)
  })
})