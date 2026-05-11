import { describe, expect, it } from "vitest"

import type { ColumnInfo } from "@/lib/introspect"
import { parseSortParams } from "@/lib/sort"

function col(name: string): ColumnInfo {
  return {
    name,
    dataType: "text",
    udtName: "text",
    isNullable: false,
    defaultValue: null,
    ordinalPosition: 1,
  }
}

const COLS: ColumnInfo[] = [col("id"), col("full_name"), col("email")]

describe("parseSortParams", () => {
  it("returns null when sort param is missing", () => {
    expect(parseSortParams(undefined, "asc", COLS)).toBeNull()
    expect(parseSortParams("", "asc", COLS)).toBeNull()
  })

  it("returns null when sort param is not a string (array form)", () => {
    expect(parseSortParams(["full_name", "email"], "asc", COLS)).toBeNull()
  })

  it("returns null when sort column is not in the whitelist", () => {
    expect(parseSortParams("password_hash", "asc", COLS)).toBeNull()
  })

  it("returns null on a SQL-injection-shaped column name", () => {
    expect(parseSortParams(`id"; DROP TABLE users; --`, "asc", COLS)).toBeNull()
  })

  it("returns asc by default when order is missing", () => {
    expect(parseSortParams("full_name", undefined, COLS)).toEqual({
      column: "full_name",
      direction: "asc",
    })
  })

  it("returns asc by default when order is invalid", () => {
    expect(parseSortParams("full_name", "ascending", COLS)).toEqual({
      column: "full_name",
      direction: "asc",
    })
    expect(parseSortParams("full_name", "DESC", COLS)).toEqual({
      column: "full_name",
      direction: "asc", // case-sensitive: "DESC" is not "desc"
    })
  })

  it("returns desc when explicitly requested", () => {
    expect(parseSortParams("email", "desc", COLS)).toEqual({
      column: "email",
      direction: "desc",
    })
  })

  it("is case-sensitive on the column name (matches PG default behavior)", () => {
    expect(parseSortParams("Full_Name", "asc", COLS)).toBeNull()
  })
})