import { describe, expect, it } from "vitest"

import {
  formatDate,
  isArrayColumn,
  looksLikeImageUrl,
  looksLikeUrl,
  normalizeDataType,
  previewJson,
  stringifyForClipboard,
  truncate,
} from "@/lib/cell-format"

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

describe("looksLikeImageUrl", () => {
  it.each([
    // Positive — basic extensions
    ["https://example.com/foo.jpg", true],
    ["https://example.com/foo.jpeg", true],
    ["https://example.com/foo.png", true],
    ["https://example.com/foo.webp", true],
    ["https://example.com/foo.gif", true],
    ["https://example.com/foo.avif", true],
    ["https://example.com/foo.svg", true],

    // Positive — uppercase
    ["https://example.com/foo.JPG", true],
    ["https://example.com/foo.PNG", true],

    // Positive — query string after the extension
    ["https://cdn.example.com/avatar.png?v=2", true],
    ["https://cdn.example.com/avatar.jpg?w=300&h=300", true],

    // Positive — path with multiple dots
    ["https://example.com/v1.2/foo.bar.jpg", true],
    ["https://example.com/some.dotted.path/image.webp", true],

    // Positive — port
    ["http://localhost:3000/uploads/profile.png", true],

    // Positive — known image CDN hostnames (extensionless paths)
    ["https://avatars.githubusercontent.com/u/156963099?v=4", true],
    ["https://www.gravatar.com/avatar/abc123", true],
    ["https://i.imgur.com/abc123", true],
    ["https://lh3.googleusercontent.com/a/ACg8ocAbc", true],
    ["https://pbs.twimg.com/profile_images/123/abc", true],
    ["https://picsum.photos/seed/headphones/400/300", true],

    // Negative — URL but no image extension
    ["https://example.com/page", false],
    ["https://example.com/page.html", false],
    ["https://example.com/foo.json", false],

    // Negative — lookalike hostname (suffix match must be on a dot boundary)
    ["https://notgithubusercontent.com/u/1", false],

    // Negative — not an HTTP(S) URL
    ["data:image/png;base64,iVBORw0KGgo=", false],
    ["ftp://example.com/foo.png", false],
    ["foo.png", false], // path only, no scheme

    // Negative — empty / garbage
    ["", false],
    ["just text with a dot.jpg in the middle", false],
    ["http://", false], // malformed URL → URL() throws → false
  ])("looksLikeImageUrl(%s) = %s", (input, expected) => {
    expect(looksLikeImageUrl(input)).toBe(expected)
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

describe("stringifyForClipboard", () => {
  it("returns null for null/undefined", () => {
    expect(stringifyForClipboard(null)).toBeNull()
    expect(stringifyForClipboard(undefined)).toBeNull()
  })

  it("stringifies primitives", () => {
    expect(stringifyForClipboard("hello")).toBe("hello")
    expect(stringifyForClipboard(42)).toBe("42")
    expect(stringifyForClipboard(0)).toBe("0")
    expect(stringifyForClipboard(true)).toBe("true")
    expect(stringifyForClipboard(false)).toBe("false")
  })

  it("returns Date as ISO 8601", () => {
    const d = new Date("2025-05-12T07:34:00.000Z")
    expect(stringifyForClipboard(d)).toBe("2025-05-12T07:34:00.000Z")
  })

  it("returns BigInt as base-10 string", () => {
    // Constructor form (vs the `n` literal) keeps the test compatible with
    // tsconfig targets below ES2020.
    expect(stringifyForClipboard(BigInt("9007199254740993"))).toBe("9007199254740993")
  })

  it("JSON.stringifies plain objects and arrays", () => {
    expect(stringifyForClipboard({ a: 1, b: "two" })).toBe('{"a":1,"b":"two"}')
    expect(stringifyForClipboard([1, 2, 3])).toBe("[1,2,3]")
  })

  it("falls back to String() on cyclic objects", () => {
    const cyclic: Record<string, unknown> = { name: "loop" }
    cyclic.self = cyclic
    // Don't assert the exact fallback string — just that it doesn't throw and
    // doesn't return null (we have *some* value to put in the clipboard).
    const out = stringifyForClipboard(cyclic)
    expect(out).not.toBeNull()
    expect(typeof out).toBe("string")
  })

  it("does NOT humanize FK values (passthrough on raw scalars)", () => {
    // Sanity check: a UUID-ish string roundtrips as-is. The FK label resolution
    // happens in Cell, not here — that's the whole point.
    expect(stringifyForClipboard("a8f3c2d1-7e4b-4a99-b3c8-1f9e5d2a8b7c")).toBe("a8f3c2d1-7e4b-4a99-b3c8-1f9e5d2a8b7c")
  })
})