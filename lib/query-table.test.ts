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
