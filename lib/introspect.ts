import type { Pool } from "pg"

import { escapeIdentifier } from "@/lib/query-table"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ColumnInfo = {
  name: string
  /** PG type name as exposed by information_schema.columns.data_type, e.g. "integer", "text", "jsonb". */
  dataType: string
  /** Underlying type name (`udt_name`); useful for arrays (`_int4`) and enums. */
  udtName: string
  isNullable: boolean
  defaultValue: string | null
  ordinalPosition: number
}

export type TableInfo = {
  schema: string
  name: string
  /** Exact row count. */
  rowCount: number
  columns: ColumnInfo[]
  /** Column names making up the primary key, in order. Empty array if no PK. */
  primaryKey: string[]
}

export type FkInfo = {
  fromSchema: string
  fromTable: string
  fromColumns: string[]
  toSchema: string
  toTable: string
  /**
   * For composite FKs, the order of `toColumns` is **not guaranteed** to
   * match `fromColumns` — `information_schema.constraint_column_usage`
   * doesn't preserve ordering. For single-column FKs (the common case)
   * this isn't an issue. Tighten if/when we have a real composite FK use case.
   */
  toColumns: string[]
  constraintName: string
}

export type DatabaseSchema = {
  tables: TableInfo[]
  foreignKeys: FkInfo[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Postgres internal schemas we never want to expose. The `pg_%` LIKE clause
// is the broad catcher; the explicit list is for readability.
const SYSTEM_SCHEMA_FILTER = `
  table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND table_schema NOT LIKE 'pg_%'
`

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads the schema of every user table reachable through the given `pool`
 * and returns a typed model.
 *
 * Schema metadata queries run in parallel:
 *   1. tables + columns (information_schema.tables JOIN columns)
 *   2. constraints — PK + FK in one go (information_schema.*)
 *
 * Row counts are exact COUNT(*) queries. Postgres planner stats such as
 * pg_stat_user_tables.n_live_tup can be stale right after seed/import work,
 * which makes the sidebar visibly wrong until autovacuum/analyze catches up.
 *
 * Errors propagate. Don't swallow them — the caller decides whether to show
 * an error state or 500 the request.
 */
export async function introspectSchema(pool: Pool): Promise<DatabaseSchema> {
  const [columnsRows, constraintRows] = await Promise.all([
    queryColumns(pool),
    queryConstraints(pool),
  ])

  // Build tables index: schema.table → TableInfo
  const tableIndex = new Map<string, TableInfo>()
  for (const row of columnsRows) {
    const key = qualified(row.table_schema, row.table_name)
    let table = tableIndex.get(key)
    if (!table) {
      table = {
        schema: row.table_schema,
        name: row.table_name,
        rowCount: -1, // filled in below
        columns: [],
        primaryKey: [], // filled in below
      }
      tableIndex.set(key, table)
    }
    table.columns.push({
      name: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
      isNullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
      ordinalPosition: row.ordinal_position,
    })
  }

  const rowCountRows = await queryRowCounts(pool, [...tableIndex.values()])

  // Apply row counts
  for (const row of rowCountRows) {
    const key = qualified(row.schemaname, row.relname)
    const table = tableIndex.get(key)
    if (table) {
      table.rowCount = row.row_count
    }
  }

  // Walk constraints: split between PKs (fill `primaryKey`) and FKs (collect)
  const fkAccumulator = new Map<string, FkInfo>() // by constraint identity
  for (const row of constraintRows) {
    if (row.constraint_type === "PRIMARY KEY") {
      const key = qualified(row.table_schema, row.table_name)
      const table = tableIndex.get(key)
      if (table) {
        table.primaryKey.push(row.column_name)
      }
      continue
    }
    if (row.constraint_type === "FOREIGN KEY") {
      const fkKey = `${row.table_schema}.${row.table_name}.${row.constraint_name}`
      let fk = fkAccumulator.get(fkKey)
      if (!fk) {
        fk = {
          fromSchema: row.table_schema,
          fromTable: row.table_name,
          fromColumns: [],
          toSchema: row.referenced_schema ?? "",
          toTable: row.referenced_table ?? "",
          toColumns: [],
          constraintName: row.constraint_name,
        }
        fkAccumulator.set(fkKey, fk)
      }
      fk.fromColumns.push(row.column_name)
      if (row.referenced_column) {
        fk.toColumns.push(row.referenced_column)
      }
    }
  }

  // Sort once at the end for stable output (tests, UI consistency)
  const tables = [...tableIndex.values()].sort((a, b) => {
    if (a.schema !== b.schema) return a.schema.localeCompare(b.schema)
    return a.name.localeCompare(b.name)
  })
  for (const t of tables) {
    t.columns.sort((a, b) => a.ordinalPosition - b.ordinalPosition)
  }
  const foreignKeys = [...fkAccumulator.values()].sort((a, b) => a.constraintName.localeCompare(b.constraintName))

  return { tables, foreignKeys }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals — one function per query, no string interpolation of user input
// ─────────────────────────────────────────────────────────────────────────────

type ColumnRow = {
  table_schema: string
  table_name: string
  column_name: string
  data_type: string
  udt_name: string
  is_nullable: "YES" | "NO"
  column_default: string | null
  ordinal_position: number
}

async function queryColumns(pool: Pool): Promise<ColumnRow[]> {
  const sql = `
    SELECT
      c.table_schema,
      c.table_name,
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default,
      c.ordinal_position
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
      AND t.table_name = c.table_name
    WHERE t.table_type = 'BASE TABLE'
      AND ${SYSTEM_SCHEMA_FILTER.replaceAll("table_schema", "t.table_schema")}
    ORDER BY c.table_schema, c.table_name, c.ordinal_position
  `
  const result = await pool.query<ColumnRow>(sql)
  return result.rows
}

type ConstraintRow = {
  constraint_type: "PRIMARY KEY" | "FOREIGN KEY"
  table_schema: string
  table_name: string
  constraint_name: string
  column_name: string
  ordinal_position: number
  referenced_schema: string | null
  referenced_table: string | null
  referenced_column: string | null
}

async function queryConstraints(pool: Pool): Promise<ConstraintRow[]> {
  // We `LEFT JOIN` constraint_column_usage because PK rows don't reference
  // anything — those columns will be NULL for PK rows, populated for FK rows.
  const sql = `
    SELECT
      tc.constraint_type,
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      kcu.ordinal_position,
      ccu.table_schema AS referenced_schema,
      ccu.table_name   AS referenced_table,
      ccu.column_name  AS referenced_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_schema = ccu.constraint_schema
      AND tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
      AND ${SYSTEM_SCHEMA_FILTER.replaceAll("table_schema", "tc.table_schema")}
    ORDER BY tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position
  `
  const result = await pool.query<ConstraintRow>(sql)
  return result.rows
}

type RowCountRow = {
  schemaname: string
  relname: string
  row_count: number
}

async function queryRowCounts(pool: Pool, tables: Pick<TableInfo, "schema" | "name">[]): Promise<RowCountRow[]> {
  return Promise.all(
    tables.map(async (table) => {
      const sql = `SELECT COUNT(*)::bigint AS row_count FROM ${escapeIdentifier(table.schema)}.${escapeIdentifier(table.name)}`
      const result = await pool.query<{ row_count: string }>(sql)
      const count = Number.parseInt(result.rows[0]?.row_count ?? "0", 10)
      return {
        schemaname: table.schema,
        relname: table.name,
        row_count: Number.isFinite(count) ? count : 0,
      }
    })
  )
}

function qualified(schema: string, name: string): string {
  return `${schema}.${name}`
}
