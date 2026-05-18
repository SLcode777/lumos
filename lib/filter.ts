import type { ColumnInfo } from "@/lib/introspect"

/**
 * Single-column equality filter — the minimal MVP shape.
 *
 * URL form: ?where=<column>:<value>
 *
 * Future work (Phase 5) will extend this to support operators, multi-column,
 * AND/OR composition, type-aware values, etc. — those will live alongside
 * this MVP plumbing rather than replacing it.
 */
export type WhereState = {
  column: string
  /** Raw string value from the URL. PG coerces per the column's actual type at query time. */
  value: string
}

/**
 * Parse + validate `?where=` against the current table's columns.
 *
 * Returns null when:
 *   - the param is missing or malformed (no `:` separator)
 *   - the column name doesn't match any known column (whitelist)
 *
 * Silent ignore is intentional — same pattern as `parseSortParams`: a stale
 * bookmark with a since-renamed column should still render, just unfiltered.
 *
 * Note: we use the FIRST `:` as the separator. Values containing `:` (e.g.
 * timestamps, URLs) are preserved intact since only the column-side is split.
 */
export function parseWhereParam(
  raw: string | string[] | undefined,
  columns: ColumnInfo[]
): WhereState | null {
  if (typeof raw !== "string" || raw.length === 0) return null

  const sepIdx = raw.indexOf(":")
  if (sepIdx < 1) return null // no separator OR colon as first char → bogus

  const column = raw.slice(0, sepIdx)
  const value = raw.slice(sepIdx + 1)

  // Whitelist against the introspected schema. Without this, an attacker could
  // craft a (still parameterized, so safe at SQL level, but) bogus identifier.
  const match = columns.find((c) => c.name === column)
  if (!match) return null

  // Empty value is technically valid (filter for empty-string in a text column),
  // so we don't reject it.
  return { column: match.name, value }
}

/**
 * Build an href that applies the given filter to the current table view URL.
 * Strips any pre-existing `where` so URLs never accumulate stale state.
 *
 * Preserves all other persistent params (page, pageSize, sort, order) AND
 * any panel state — the caller decides whether that's appropriate (usually
 * resetting `page` to 1 alongside this would be wise, but that's at the
 * caller's discretion since this helper doesn't know about pagination).
 */
export function buildWhereHref(
  baseHref: string,
  persistentParams: URLSearchParams,
  where: WhereState
): string {
  const params = new URLSearchParams(persistentParams)
  params.delete("where")
  params.set("where", `${where.column}:${where.value}`)
  const qs = params.toString()
  return qs ? `${baseHref}?${qs}` : baseHref
}

/**
 * Build the clear-filter href: same as baseHref + persistent params, with
 * the `where` param stripped. Used by the toolbar badge's clear button.
 */
export function buildClearWhereHref(baseHref: string, persistentParams: URLSearchParams): string {
  const params = new URLSearchParams(persistentParams)
  params.delete("where")
  const qs = params.toString()
  return qs ? `${baseHref}?${qs}` : baseHref
}