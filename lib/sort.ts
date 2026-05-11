import type { ColumnInfo } from "@/lib/introspect"

export type SortDirection = "asc" | "desc"

export type SortState = {
  column: string
  direction: SortDirection
}

/**
 * Parses and validates the `sort` and `order` URL search params against the
 * current table's columns. Anything off-script (unknown column, bad direction,
 * missing one of the two params) → returns `null` and the caller skips the
 * ORDER BY clause. Silent ignore is by design: a stale bookmark with a removed
 * column name should still render, just without sorting.
 */
export function parseSortParams(
  rawSort: string | string[] | undefined,
  rawOrder: string | string[] | undefined,
  columns: ColumnInfo[]
): SortState | null {
  if (typeof rawSort !== "string" || rawSort.length === 0) return null

  // Whitelist against the introspected schema. Without this, an attacker could
  // inject a (rejected at SQL level, but still) arbitrary identifier.
  const match = columns.find((c) => c.name === rawSort)
  if (!match) return null

  // `order` defaults to "asc" when missing or invalid — being lenient here
  // makes `?sort=name` work as a shareable shorthand for asc.
  const direction: SortDirection = rawOrder === "desc" ? "desc" : "asc"

  return { column: match.name, direction }
}
