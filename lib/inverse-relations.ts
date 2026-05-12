import type { Pool } from "pg"

import type { DatabaseSchema, TableInfo } from "@/lib/introspect"
import { escapeIdentifier } from "@/lib/query-table"

/**
 * Metadata for one inverse relation: a foreign key declared on
 * `<sourceSchema>.<sourceTable>` that points to the current table.
 *
 * `ambiguous` is set when the same source table declares multiple FKs to us
 * (the classic `created_by_id` + `updated_by_id` case) — the UI uses this
 * flag to decide whether to append `(via <col>)` to disambiguate.
 */
export type InverseRelationMeta = {
  sourceSchema: string
  sourceTable: string
  fromColumn: string
  ambiguous: boolean
}

/**
 * Stable key for one inverse FK: `${schema}.${table}.${column}`.
 * Independent of any specific row — used for sorting + matching.
 */
export function inverseRelationKey(meta: InverseRelationMeta): string {
  return `${meta.sourceSchema}.${meta.sourceTable}.${meta.fromColumn}`
}

/**
 * Composite key for the counts map. The `|` separator is safe:
 * PG identifiers can't contain it, and PK values stringified via String()
 * (uuid/int/text) don't include it either.
 */
export function inverseCountKey(rowPkString: string, meta: InverseRelationMeta): string {
  return `${rowPkString}|${inverseRelationKey(meta)}`
}

export type PageInverseRelations = {
  /** Stable, sorted list of inverse FKs for this table. Identical for all rows. */
  meta: InverseRelationMeta[]
  /** Per-row counts. Key: `${pkValueString}|${fkKey}`. Missing → 0. */
  counts: Map<string, number>
}

type CountParams = {
  pool: Pool
  schema: DatabaseSchema
  currentTable: TableInfo
  rows: Record<string, unknown>[]
}

/**
 * For every row on the page, count the rows in every other table that
 * FK-references it. One batched query per inverse FK, run in parallel.
 *
 *   1. Walk schema.foreignKeys to find every FK targeting currentTable AND
 *      that is single-column on both sides.
 *   2. Collect the distinct, non-null PK values across `rows`.
 *   3. For each FK, run ONE
 *        SELECT fkCol, COUNT(*) FROM source WHERE fkCol IN (…) GROUP BY fkCol
 *      All run in parallel via Promise.all.
 *   4. Build the counts map keyed by `(rowPkString, fkKey)`. Rows with zero
 *      matches are simply absent from the GROUP BY result; the UI's
 *      `counts.get(key) ?? 0` is the invariant.
 *
 * Single-PK currentTable only — composite returns empty meta + counts.
 * See guide for rationale.
 *
 * Failed queries (e.g. SELECT denied on source table) are silently dropped
 * from the counts map (cells render as 0); we log via console.error so ops
 * can spot misconfiguration.
 *
 * `meta` is sorted alphabetically by (sourceTable, fromColumn) for a stable UI.
 */
export async function countInverseRelationsForPage({
  pool,
  schema,
  currentTable,
  rows,
}: CountParams): Promise<PageInverseRelations> {
  // Composite-PK currentTable: skip the whole feature.
  if (currentTable.primaryKey.length !== 1) return { meta: [], counts: new Map() }
  if (rows.length === 0) return { meta: [], counts: new Map() }

  const pkCol = currentTable.primaryKey[0]

  const eligible = schema.foreignKeys.filter(
    (fk) =>
      fk.toSchema === currentTable.schema &&
      fk.toTable === currentTable.name &&
      fk.fromColumns.length === 1 &&
      fk.toColumns.length === 1
  )
  if (eligible.length === 0) return { meta: [], counts: new Map() }

  // Detect ambiguous source tables (multiple FKs to us) up-front.
  const sourceTableCounts = new Map<string, number>()
  for (const fk of eligible) {
    const key = `${fk.fromSchema}.${fk.fromTable}`
    sourceTableCounts.set(key, (sourceTableCounts.get(key) ?? 0) + 1)
  }

  // Stable, sorted meta list — identical for every row on the page.
  const meta: InverseRelationMeta[] = eligible
    .map((fk) => ({
      sourceSchema: fk.fromSchema,
      sourceTable: fk.fromTable,
      fromColumn: fk.fromColumns[0],
      ambiguous: (sourceTableCounts.get(`${fk.fromSchema}.${fk.fromTable}`) ?? 0) > 1,
    }))
    .sort((a, b) => {
      if (a.sourceTable !== b.sourceTable) return a.sourceTable.localeCompare(b.sourceTable)
      return a.fromColumn.localeCompare(b.fromColumn)
    })

  // Distinct, non-null PK values across the page's rows.
  const pkValues = new Set<unknown>()
  for (const row of rows) {
    const v = row[pkCol]
    if (v !== null && v !== undefined) pkValues.add(v)
  }
  if (pkValues.size === 0) return { meta, counts: new Map() }

  const pkValueList = [...pkValues]
  const placeholders = pkValueList.map((_, i) => `$${i + 1}`).join(", ")

  // One query per inverse FK, all in parallel on the shared pool.
  const counts: Map<string, number> = new Map()

  await Promise.all(
    meta.map(async (m) => {
      const sql =
        `SELECT ${escapeIdentifier(m.fromColumn)} AS pk, COUNT(*)::bigint AS n ` +
        `FROM ${escapeIdentifier(m.sourceSchema)}.${escapeIdentifier(m.sourceTable)} ` +
        `WHERE ${escapeIdentifier(m.fromColumn)} IN (${placeholders}) ` +
        `GROUP BY ${escapeIdentifier(m.fromColumn)}`

      try {
        const result = await pool.query<{ pk: unknown; n: string }>(sql, pkValueList)
        for (const r of result.rows) {
          // COUNT(*) returns bigint → node-postgres gives us a string.
          // Parse defensively; ignore unparseable counts (shouldn't happen).
          const n = Number.parseInt(r.n ?? "0", 10)
          if (!Number.isFinite(n)) continue
          counts.set(inverseCountKey(String(r.pk), m), n)
        }
      } catch (err) {
        console.error(
          `[inverse-relations] COUNT failed for ${m.sourceSchema}.${m.sourceTable}.${m.fromColumn}:`,
          err instanceof Error ? err.message : err
        )
        // Don't rethrow — degraded UX (the chip shows 0) is better than a 500.
      }
    })
  )

  return { meta, counts }
}

/**
 * `order_items` → `Order Items`. Splits on `_`, capitalizes each segment.
 * Leaves digits / non-alpha intact: `v2_audit_log` → `V2 Audit Log`.
 */
export function humanizeTableName(name: string): string {
  return name
    .split("_")
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(" ")
}

/**
 * `1 record` / `0 records` / `42 records`. Generic, not table-name-dependent.
 * 0 is plural in English ("0 records"), only 1 takes the singular form.
 */
export function pluralizeRecord(count: number): string {
  return count === 1 ? "1 record" : `${count} records`
}
