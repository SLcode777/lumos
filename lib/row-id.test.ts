import { describe, expect, it } from "vitest"

import { encodeRowParam, findRowByParam, type Row } from "@/lib/row-id"

const rows: Row[] = [
  { id: "a", name: "Alice" },
  { id: "b", name: "Bob" },
  { id: "c", name: "Charlie" },
]

describe("encodeRowParam — single PK", () => {
  it("encodes the PK value as-is", () => {
    expect(encodeRowParam(rows[0], ["id"], 0)).toBe("a")
  })
})

describe("encodeRowParam — composite PK", () => {
  it("encodes composite as $<json>", () => {
    const row = { schema: "public", table: "users" }
    expect(encodeRowParam(row, ["schema", "table"], 0)).toBe('${"schema":"public","table":"users"}')
  })
})

describe("encodeRowParam — no PK", () => {
  it("falls back to #<index>", () => {
    expect(encodeRowParam(rows[2], [], 2)).toBe("#2")
  })
})

describe("findRowByParam — single PK", () => {
  it("finds the row by exact PK match", () => {
    expect(findRowByParam(rows, ["id"], "b")).toEqual({ row: rows[1], index: 1 })
  })

  it("returns null on unknown PK", () => {
    expect(findRowByParam(rows, ["id"], "z")).toBeNull()
  })
})

describe("findRowByParam — composite PK", () => {
  const composite: Row[] = [
    { schema: "public", table: "users" },
    { schema: "public", table: "orders" },
    { schema: "auth", table: "users" },
  ]

  it("finds the row when all PK columns match", () => {
    const param = '${"schema":"auth","table":"users"}'
    expect(findRowByParam(composite, ["schema", "table"], param)).toEqual({
      row: composite[2],
      index: 2,
    })
  })

  it("returns null on no match", () => {
    const param = '${"schema":"auth","table":"orders"}'
    expect(findRowByParam(composite, ["schema", "table"], param)).toBeNull()
  })

  it("returns null on malformed JSON", () => {
    expect(findRowByParam(composite, ["schema", "table"], "${not json")).toBeNull()
  })
})

describe("findRowByParam — index fallback", () => {
  it("finds the row by index", () => {
    expect(findRowByParam(rows, [], "#1")).toEqual({ row: rows[1], index: 1 })
  })

  it("returns null on out-of-range index", () => {
    expect(findRowByParam(rows, [], "#99")).toBeNull()
    expect(findRowByParam(rows, [], "#-1")).toBeNull()
  })

  it("returns null on garbage index", () => {
    expect(findRowByParam(rows, [], "#abc")).toBeNull()
  })
})

describe("encode + decode roundtrip", () => {
  it("scalar PK roundtrips", () => {
    const param = encodeRowParam(rows[1], ["id"], 1)
    expect(findRowByParam(rows, ["id"], param)).toEqual({ row: rows[1], index: 1 })
  })

  it("composite PK roundtrips", () => {
    const composite: Row[] = [
      { a: 1, b: "x" },
      { a: 2, b: "y" },
    ]
    const param = encodeRowParam(composite[1], ["a", "b"], 1)
    expect(findRowByParam(composite, ["a", "b"], param)).toEqual({ row: composite[1], index: 1 })
  })

  it("no-PK roundtrips via index", () => {
    const param = encodeRowParam(rows[2], [], 2)
    expect(findRowByParam(rows, [], param)).toEqual({ row: rows[2], index: 2 })
  })
})
