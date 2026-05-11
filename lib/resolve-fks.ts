import type { Pool } from "pg"

import type { DatabaseSchema, FkInfo, TableInfo } from "@/lib/introspect"
import { pickPrimaryField } from "@/lib/primary-fields"
import { escapeIdentifier } from "@/lib/query-table"

/**
 * Resolved labels for FK values referenced from a page of rows.
 *
 * Key shape:  `${targetSchema}.${targetTable}.${String(value)}`
 * Value:
 *   - `string` → label found (target row exists, its primary field is non-null)
 *   - `null`   → target row exists, but its primary field column is null on that row
 * Absence: either the FK value itself was null (we don't look those up),
 *          OR the target row is missing (orphan FK).
 *
 * The caller distinguishes "null FK value" from "orphan" by inspecting the
 * source value: if it's non-null and the key isn't in the map, it's an orphan.
 * `lookupFkLabel` below encapsulates this protocol.
 */
export type FkLabels = Map<string, string | null>

/**
 * Discriminated union describing how a single FK cell should render.
 * Designed to be extensible: when target tables get their own detail-view
 * URL pattern, `hit` will grow an optional `href` and Cell will wrap the
 * label in a link without touching any other callsite.
 */
export type FkLabelSlot = { kind: "hit"; label: string } | { kind: "missing" }

/** Stable key for the labels map. Centralized so callers can't drift. */
export function fkLabelKey(targetSchema: string, targetTable: string, value: unknown): string {
  return `${targetSchema}.${targetTable}.${String(value)}`
}

type ResolveParams = {
  pool: Pool
  schema: DatabaseSchema
  fromTable: TableInfo
  rows: Record<string, unknown>[]
}

/**
 * Batch-resolve every FK column visible on this page.
 *
 *  1. Find the FKs that originate in `fromTable` AND have a single-column
 *     source + single-column target (composite ones are skipped for MVP).
 *  2. Group the distinct, non-null FK values by (toSchema, toTable).
 *  3. For each group, run ONE `SELECT pk, primaryField FROM target WHERE pk IN (…)`
 *     with the target table's primary field chosen by `pickPrimaryField`.
 *  4. Merge all results into a single `FkLabels` map.
 *
 * All identifiers are whitelisted against `schema` and escaped via
 * `escapeIdentifier`. All values go through parameterized placeholders.
 */
export async function resolveForeignKeyLabels({ pool, schema, fromTable, rows }: ResolveParams): Promise<FkLabels> {
  if (rows.length === 0) return new Map()

  // 1. FKs eligible for resolution
  const eligible = schema.foreignKeys.filter(
    (fk) =>
      fk.fromSchema === fromTable.schema &&
      fk.fromTable === fromTable.name &&
      fk.fromColumns.length === 1 &&
      fk.toColumns.length === 1
  )
  if (eligible.length === 0) return new Map()

  // 2. Per-target distinct value sets
  //    Key on (toSchema, toTable) — two FKs pointing to the same target table
  //    (e.g. `created_by` and `updated_by` → `users`) get merged into ONE query.
  type TargetGroup = {
    toSchema: string
    toTable: string
    pkCol: string
    values: Set<unknown>
  }
  const groups = new Map<string, TargetGroup>()

  for (const fk of eligible) {
    const fromCol = fk.fromColumns[0]
    const pkCol = fk.toColumns[0]
    const groupKey = `${fk.toSchema}.${fk.toTable}`

    let group = groups.get(groupKey)
    if (!group) {
      group = {
        toSchema: fk.toSchema,
        toTable: fk.toTable,
        pkCol,
        values: new Set(),
      }
      groups.set(groupKey, group)
    }

    for (const row of rows) {
      const v = row[fromCol]
      if (v !== null && v !== undefined) group.values.add(v)
    }
  }

  // 3. One query per group, in parallel
  const labels: FkLabels = new Map()

  await Promise.all(
    [...groups.values()].map(async (g) => {
      if (g.values.size === 0) return

      // Find the target table in the introspected schema → pick its primary field
      const targetTable = schema.tables.find((t) => t.schema === g.toSchema && t.name === g.toTable)
      if (!targetTable) return // target table not introspected (e.g. system schema)

      const labelCol = pickPrimaryField(targetTable.columns, targetTable.primaryKey).name

      // Build placeholders for IN (...). One per value preserves the column's
      // type and lets PG use the PK index. (A single `= ANY($1)` would force
      // an array encoding that's brittle across uuid/int/text without a cast.)
      const values = [...g.values]
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ")

      const sql =
        `SELECT ${escapeIdentifier(g.pkCol)} AS pk, ${escapeIdentifier(labelCol)} AS label ` +
        `FROM ${escapeIdentifier(g.toSchema)}.${escapeIdentifier(g.toTable)} ` +
        `WHERE ${escapeIdentifier(g.pkCol)} IN (${placeholders})`

      try {
        const result = await pool.query<{ pk: unknown; label: unknown }>(sql, values)
        for (const r of result.rows) {
          const key = fkLabelKey(g.toSchema, g.toTable, r.pk)
          // null label is kept as null in the map — the caller will fall back
          // to the raw value (and avoid showing "(missing)" for this case).
          labels.set(key, r.label === null || r.label === undefined ? null : String(r.label))
        }
      } catch (err) {
        // Don't fail the whole page render on a label-resolution miss — degraded
        // experience (raw values) is better than a 500. Log for ops.
        console.error(
          `[resolve-fks] lookup failed for ${g.toSchema}.${g.toTable}:`,
          err instanceof Error ? err.message : err
        )
      }
    })
  )

  return labels
}

/**
 * Decide how a single FK cell should render, given the resolved labels map.
 *
 * Returns `undefined` when:
 *   - the column isn't an FK (no FkInfo)
 *   - the FK value is null (nothing to look up — Cell already handles null)
 *   - the FK is composite on either side (we don't resolve those at MVP)
 *   - the target row was found but its label is null (raw render is better)
 *
 * Returns `{ kind: "missing" }` when the value was looked up but no row
 * matched in the target table (orphan FK).
 *
 * Returns `{ kind: "hit", label }` on success.
 */
export function lookupFkLabel(labels: FkLabels, fk: FkInfo | undefined, value: unknown): FkLabelSlot | undefined {
  if (!fk) return undefined
  if (value === null || value === undefined) return undefined
  if (fk.fromColumns.length !== 1 || fk.toColumns.length !== 1) return undefined

  const key = fkLabelKey(fk.toSchema, fk.toTable, value)
  if (!labels.has(key)) return { kind: "missing" }

  const label = labels.get(key)
  if (label === null || label === undefined) return undefined
  return { kind: "hit", label }
}
