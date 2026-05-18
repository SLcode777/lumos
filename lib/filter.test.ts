import { describe, expect, it } from "vitest"

import type { ColumnInfo } from "@/lib/introspect"
import { buildClearWhereHref, buildWhereHref, parseWhereParam } from "@/lib/filter"

const columns: ColumnInfo[] = [
  { name: "id", dataType: "uuid", udtName: "uuid", isNullable: false, defaultValue: null, ordinalPosition: 1 },
  { name: "name", dataType: "text", udtName: "text", isNullable: true, defaultValue: null, ordinalPosition: 2 },
  { name: "created_at", dataType: "timestamp", udtName: "timestamp", isNullable: true, defaultValue: null, ordinalPosition: 3 },
]

describe("parseWhereParam", () => {
  it("returns null when missing or malformed", () => {
    expect(parseWhereParam(undefined, columns)).toBeNull()
    expect(parseWhereParam("", columns)).toBeNull()
    expect(parseWhereParam(["a:b", "c:d"], columns)).toBeNull() // array → bogus
    expect(parseWhereParam("nocolon", columns)).toBeNull()
    expect(parseWhereParam(":nopkey", columns)).toBeNull() // colon as first char
  })

  it("parses a simple column:value", () => {
    expect(parseWhereParam("name:foo", columns)).toEqual({ column: "name", value: "foo" })
  })

  it("uses the first colon as separator (timestamps with `:` preserved)", () => {
    expect(parseWhereParam("created_at:2026-05-16T12:34:56Z", columns)).toEqual({
      column: "created_at",
      value: "2026-05-16T12:34:56Z",
    })
  })

  it("allows empty value (filter for empty string)", () => {
    expect(parseWhereParam("name:", columns)).toEqual({ column: "name", value: "" })
  })

  it("rejects unknown column (whitelist)", () => {
    expect(parseWhereParam("nonexistent:foo", columns)).toBeNull()
  })
})

describe("buildWhereHref", () => {
  const base = "/dashboard/connections/X/products"
  const persistent = (entries: [string, string][]) => {
    const p = new URLSearchParams()
    for (const [k, v] of entries) p.append(k, v)
    return p
  }

  it("appends the where param, preserving persistent params", () => {
    const href = buildWhereHref(
      base,
      persistent([["page", "2"], ["sort", "name"]]),
      { column: "in_stock", value: "true" }
    )
    expect(href).toBe(`${base}?page=2&sort=name&where=in_stock%3Atrue`)
  })

  it("strips a pre-existing where before re-setting", () => {
    const params = persistent([["where", "stale:value"], ["page", "1"]])
    const href = buildWhereHref(base, params, { column: "name", value: "foo" })
    expect(href).toContain("where=name%3Afoo")
    expect(href).not.toContain("stale")
  })
})

describe("buildClearWhereHref", () => {
  const base = "/x"
  it("strips where and keeps other params", () => {
    const p = new URLSearchParams()
    p.set("page", "3")
    p.set("where", "name:foo")
    p.set("sort", "id")
    expect(buildClearWhereHref(base, p)).toBe("/x?page=3&sort=id")
  })

  it("returns the bare baseHref when nothing else persists", () => {
    expect(buildClearWhereHref(base, new URLSearchParams())).toBe("/x")
  })
})