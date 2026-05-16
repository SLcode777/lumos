import { describe, expect, it } from "vitest"

import { escapeIdentifier } from "@/lib/query-table"

describe("escapeIdentifier", () => {
  it("wraps a simple identifier in double quotes", () => {
    expect(escapeIdentifier("users")).toBe(`"users"`)
  })

  it("doubles internal double quotes", () => {
    expect(escapeIdentifier(`some"weird`)).toBe(`"some""weird"`)
  })

  it("preserves spaces, dashes, unicode", () => {
    expect(escapeIdentifier("My Table")).toBe(`"My Table"`)
    expect(escapeIdentifier("my-table")).toBe(`"my-table"`)
    expect(escapeIdentifier("café")).toBe(`"café"`)
  })

  it("preserves SQL-keyword-looking identifiers", () => {
    // The whole point of quoting: 'select' as a column name is fine.
    expect(escapeIdentifier("select")).toBe(`"select"`)
  })

  it("neutralizes injection attempts in identifier strings", () => {
    // Even if a malicious value reached this function (it shouldn't, the
    // schema whitelist is the first line of defense), quoting closes the
    // SQL injection vector.
    const evil = `users"; DROP TABLE foo; --`
    const escaped = escapeIdentifier(evil)
    expect(escaped).toBe(`"users""; DROP TABLE foo; --"`)
    // Inside the double quotes, even with the doubled `"`, the result is a
    // single (very weird) identifier name, not executable SQL.
  })

  it("rejects NUL bytes", () => {
    expect(() => escapeIdentifier("foo\0bar")).toThrow(/NUL byte/)
  })

  it("accepts empty string (caller's responsibility to filter)", () => {
    expect(escapeIdentifier("")).toBe(`""`)
  })
})

describe("queryTableRows orderBy clause", () => {
  it("renders correctly inside the SELECT (sanity check via a fake pool)", async () => {
    // The fake pool just captures the SQL it receives.
    const captured: { sql?: string } = {}
    const fakePool = {
      query: (sql: string) => {
        captured.sql = sql
        return Promise.resolve({ rows: [] })
      },
    } as unknown as import("pg").Pool

    const { queryTableRows } = await import("@/lib/query-table")
    await queryTableRows(fakePool, {
      pgSchema: "public",
      table: "users",
      page: 1,
      pageSize: 25,
      orderBy: { column: "email", direction: "desc" },
    })

    expect(captured.sql).toContain(`ORDER BY "email" DESC`)
    expect(captured.sql).toMatch(/ORDER BY .* LIMIT \$1 OFFSET \$2$/)
  })
})

describe("queryRowByPk", () => {
  it("builds a parameterized WHERE on the PK column", async () => {
    const captured: { sql?: string; params?: unknown[] } = {}
    const fakePool = {
      query: (sql: string, params: unknown[]) => {
        captured.sql = sql
        captured.params = params
        return Promise.resolve({ rows: [{ id: "x", name: "foo" }] })
      },
    } as unknown as import("pg").Pool

    const { queryRowByPk } = await import("@/lib/query-table")
    const result = await queryRowByPk(fakePool, {
      pgSchema: "public",
      table: "shops",
      pkColumn: "id",
      value: "abc-123",
    })

    expect(result).toEqual({ id: "x", name: "foo" })
    expect(captured.sql).toContain(`FROM "public"."shops"`)
    expect(captured.sql).toContain(`WHERE "id" = $1 LIMIT 1`)
    expect(captured.params).toEqual(["abc-123"])
  })

  it("returns null when the row does not exist", async () => {
    const fakePool = {
      query: () => Promise.resolve({ rows: [] }),
    } as unknown as import("pg").Pool
    const { queryRowByPk } = await import("@/lib/query-table")
    const result = await queryRowByPk(fakePool, {
      pgSchema: "public",
      table: "shops",
      pkColumn: "id",
      value: "missing",
    })
    expect(result).toBeNull()
  })

  it("escapes identifiers (schema, table, pkColumn)", async () => {
    const captured: { sql?: string } = {}
    const fakePool = {
      query: (sql: string) => {
        captured.sql = sql
        return Promise.resolve({ rows: [] })
      },
    } as unknown as import("pg").Pool
    const { queryRowByPk } = await import("@/lib/query-table")
    await queryRowByPk(fakePool, {
      pgSchema: `weird"schema`,
      table: `wei"rd_table`,
      pkColumn: `we"ird_id`,
      value: "x",
    })
    expect(captured.sql).toContain(`"weird""schema"."wei""rd_table"`)
    expect(captured.sql).toContain(`"we""ird_id" = $1`)
  })
})