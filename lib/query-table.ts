import type { Pool } from "pg"
import { SortState } from "./sort"
import { WhereState } from "./filter"

export type QueryTableRowsParams = {
  /** PG schema name (NOT the DatabaseSchema model). */
  pgSchema: string
  /** Table name. */
  table: string
  /** 1-indexed page number. */
  page: number
  /** Number of rows per page. */
  pageSize: number
  /** Optional sort. Caller MUST have whitelisted the column already. */
  orderBy?: SortState | null
  /**
   * Optional WHERE filter — applies `<col> = $N` to the rows query.
   * Column MUST have been whitelisted by the caller (e.g. via `parseWhereParam`).
   * Value is passed as a parameterized placeholder → no SQL injection.
   */
  where?: WhereState | null
}

export type QueryTableRowsResult = {
  rows: Record<string, unknown>[]
}

/**
 * Runs a paginated `SELECT * FROM <schema>.<table> LIMIT $1 OFFSET $2`.
 *
 * Identifiers (schema, table) are quoted via `escapeIdentifier`. The caller
 * is responsible for validating these against the introspected schema BEFORE
 * passing them in — this helper does not check existence, it only escapes
 * what it gets.
 *
 * Values (page, pageSize) are passed as parameterized values, never inlined.
 */
export async function queryTableRows(pool: Pool, params: QueryTableRowsParams): Promise<QueryTableRowsResult> {
  const { pgSchema, table, page, pageSize, orderBy, where } = params

  // `direction` is one of two literal keywords — safe to interpolate after the
  // strict check in parseSortParams. `column` is an identifier → escape it.
  const orderClause = orderBy
    ? ` ORDER BY ${escapeIdentifier(orderBy.column)} ${orderBy.direction === "desc" ? "DESC" : "ASC"}`
    : ""

  // WHERE clause: optional. The column is escaped as an identifier; the value
  // goes in a parameterized placeholder. PG coerces the string to the column's
  // type — invalid values raise a SQL error which the caller catches.
  const whereClause = where ? ` WHERE ${escapeIdentifier(where.column)} = $1` : ""
  const baseValues: unknown[] = where ? [where.value] : []
  const limitPlaceholder = `$${baseValues.length + 1}`
  const offsetPlaceholder = `$${baseValues.length + 2}`
  const sql = `SELECT * FROM ${escapeIdentifier(pgSchema)}.${escapeIdentifier(table)}${whereClause}${orderClause} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`
  const offset = (page - 1) * pageSize
  const result = await pool.query<Record<string, unknown>>(sql, [...baseValues, pageSize, offset])
  return { rows: result.rows }
}

/**
 * Quote a Postgres identifier safely. Doubles internal `"` and wraps in `"`.
 *
 * Equivalent to `Client.prototype.escapeIdentifier` from node-postgres,
 * inlined here so we don't need a Client instance to call it.
 *
 * Rejects NUL bytes (forbidden in PG identifiers per the docs).
 */
export function escapeIdentifier(name: string): string {
  if (name.includes("\0")) {
    throw new Error("Identifier contains a NUL byte, which is forbidden in Postgres")
  }
  return `"${name.replace(/"/g, '""')}"`
}

export type QueryRowByPkParams = {
  pgSchema: string
  table: string
  /** Single PK column name. Composite PKs not supported (caller must fall back). */
  pkColumn: string
  /** Raw PK value (string from URL — PG coerces per the column's actual type). */
  value: string
}

/**
 * Fetches a single row by primary key. Used by the panel-data pipeline so the
 * row detail panel can render any row, not just one already on the current page.
 *
 * Returns null when no row matches. Errors propagate — caller logs and falls
 * back to closed panel.
 *
 * Composite PKs are intentionally not supported here. Callers should detect
 * the `$`-prefixed encoding from `encodeRowParam` and route through the
 * in-page `findRowByParam` fallback instead.
 */
export async function queryRowByPk(
  pool: import("pg").Pool,
  { pgSchema, table, pkColumn, value }: QueryRowByPkParams
): Promise<Record<string, unknown> | null> {
  const sql =
    `SELECT * FROM ${escapeIdentifier(pgSchema)}.${escapeIdentifier(table)} ` +
    `WHERE ${escapeIdentifier(pkColumn)} = $1 LIMIT 1`
  const result = await pool.query<Record<string, unknown>>(sql, [value])
  return result.rows[0] ?? null
}

export type QueryTableRowCountParams = {
  pgSchema: string
  table: string
  /** Filter to apply — same shape as queryTableRows. Required: this helper is only useful WITH a filter. */
  where: WhereState
}

/**
 * Exact COUNT(*) of rows matching the filter.
 *
 * Only called when a filter is active — without filter, the table view keeps
 * using `n_live_tup` for pagination boundaries (cheap O(1) lookup; cf. #42 for
 * the safety net when estimates lie). With filter, n_live_tup doesn't know
 * about it, so we have to count for real.
 *
 * Cost: O(N) on the filtered subset. For most filtered queries this is
 * negligible (indexed FK columns). On a 10M-row table with a non-indexed
 * filter column, this can be hundreds of ms — acceptable for a "deliberate
 * user action" (clicking a filter), would be unacceptable on every render.
 */
export async function queryTableRowCount(
  pool: Pool,
  { pgSchema, table, where }: QueryTableRowCountParams
): Promise<number> {
  const sql =
    `SELECT COUNT(*)::bigint AS n FROM ${escapeIdentifier(pgSchema)}.${escapeIdentifier(table)} ` +
    `WHERE ${escapeIdentifier(where.column)} = $1`
  const result = await pool.query<{ n: string }>(sql, [where.value])
  const n = Number.parseInt(result.rows[0]?.n ?? "0", 10)
  return Number.isFinite(n) ? n : 0
}