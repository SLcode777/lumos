import type { Pool } from "pg"
import { SortState } from "./sort"

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
  const { pgSchema, table, page, pageSize, orderBy } = params

  // `direction` is one of two literal keywords — safe to interpolate after the
  // strict check in parseSortParams. `column` is an identifier → escape it.
  const orderClause = orderBy
    ? ` ORDER BY ${escapeIdentifier(orderBy.column)} ${orderBy.direction === "desc" ? "DESC" : "ASC"}`
    : ""

  const sql = `SELECT * FROM ${escapeIdentifier(pgSchema)}.${escapeIdentifier(table)}${orderClause} LIMIT $1 OFFSET $2`  
  const offset = (page - 1) * pageSize

  const result = await pool.query<Record<string, unknown>>(sql, [pageSize, offset])
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
