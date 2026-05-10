import { describe, expect, it } from "vitest"

import { formatDate, isArrayColumn, looksLikeUrl, normalizeDataType, previewJson, truncate } from "@/lib/cell-format"

describe("normalizeDataType", () => {
  it("lowercases and trims", () => {
    expect(normalizeDataType("  TEXT  ")).toBe("text")
  })

  it("strips precision/length suffixes", () => {
    expect(normalizeDataType("numeric(10,2)")).toBe("numeric")
    expect(normalizeDataType("character varying(255)")).toBe("character varying")
  })

  it("leaves multi-word types intact", () => {
    expect(normalizeDataType("timestamp without time zone")).toBe("timestamp without time zone")
  })
})

describe("looksLikeUrl", () => {
  it.each([
    ["https://example.com", true],
    ["http://localhost:3000/foo", true],
    ["HTTPS://EXAMPLE.COM", true],
    ["ftp://example.com", false],
    ["example.com", false],
    ["just text", false],
    ["", false],
  ])("looksLikeUrl(%s) = %s", (input, expected) => {
    expect(looksLikeUrl(input)).toBe(expected)
  })
})

describe("truncate", () => {
  it("returns the original string when short enough", () => {
    expect(truncate("hello", 10)).toBe("hello")
  })

  it("cuts and adds an ellipsis when too long", () => {
    expect(truncate("hello world", 5)).toBe("hello…")
  })

  it("treats max as inclusive", () => {
    expect(truncate("hello", 5)).toBe("hello")
  })
})

describe("previewJson", () => {
  it("stringifies objects compactly", () => {
    expect(previewJson({ a: 1, b: 2 })).toBe('{"a":1,"b":2}')
  })

  it("truncates long output", () => {
    expect(previewJson({ a: "x".repeat(100) }, 20)).toBe('{"a":"xxxxxxxxxxxxxx…')
  })

  it("falls back gracefully on cycles", () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(previewJson(cyclic)).toBe("{…}")
  })

  it("falls back gracefully on BigInt", () => {
    expect(previewJson({ n: BigInt(123) })).toBe("{…}")
  })
})

describe("isArrayColumn", () => {
  it("detects underscore-prefixed udt_name", () => {
    expect(isArrayColumn("_int4")).toBe(true)
    expect(isArrayColumn("_text")).toBe(true)
  })

  it("rejects regular types", () => {
    expect(isArrayColumn("int4")).toBe(false)
    expect(isArrayColumn("text")).toBe(false)
  })
})

describe("formatDate", () => {
  it("formats a Date object", () => {
    const result = formatDate(new Date("2026-05-10T14:30:00Z"), "timestamp without time zone")
    expect(result).not.toBeNull()
    expect(result!.iso).toBe("2026-05-10T14:30:00.000Z")
    expect(result!.display).toMatch(/2026/) // locale-dependent, just check it formatted
  })

  it("formats an ISO string", () => {
    const result = formatDate("2026-05-10T14:30:00Z", "timestamp")
    expect(result).not.toBeNull()
    expect(result!.iso).toBe("2026-05-10T14:30:00.000Z")
  })

  it("uses date-only format for `date` dataType", () => {
    const withTime = formatDate("2026-05-10T14:30:00Z", "timestamp")
    const dateOnly = formatDate("2026-05-10", "date")
    // Date-only output should not contain a colon (no time).
    expect(dateOnly!.display).not.toContain(":")
    expect(withTime!.display).toContain(":")
  })

  it("returns null for invalid input", () => {
    expect(formatDate("not a date", "timestamp")).toBeNull()
    expect(formatDate("", "date")).toBeNull()
  })
})
