/**
 * Serialization helpers for the `?row=` URL parameter that drives the row
 * detail panel.
 *
 * Three encoding cases, distinguished by a one-char prefix:
 *   - `<value>`        single-column PK (most common)
 *   - `$<json>`        composite PK, where <json> is the PK columns as a JSON object
 *   - `#<index>`       no PK at all — fallback to the row's index in the current page
 *
 * Real PK values (uuid, int, slug, email…) don't start with `$` or `#`,
 * so this prefix scheme is unambiguous in practice.
 */

export type Row = Record<string, unknown>

const COMPOSITE_PREFIX = "$"
const INDEX_PREFIX = "#"

export function encodeRowParam(row: Row, primaryKey: string[], index: number): string {
  if (primaryKey.length === 0) {
    return `${INDEX_PREFIX}${index}`
  }
  if (primaryKey.length === 1) {
    return String(row[primaryKey[0]])
  }
  // Composite PK: stable JSON serialization of the PK columns only.
  const obj: Record<string, unknown> = {}
  for (const col of primaryKey) {
    obj[col] = row[col]
  }
  return `${COMPOSITE_PREFIX}${JSON.stringify(obj)}`
}

export function findRowByParam(rows: Row[], primaryKey: string[], param: string): { row: Row; index: number } | null {
  if (param.startsWith(INDEX_PREFIX)) {
    const idx = Number.parseInt(param.slice(1), 10)
    if (!Number.isFinite(idx) || idx < 0 || idx >= rows.length) return null
    return { row: rows[idx], index: idx }
  }

  if (param.startsWith(COMPOSITE_PREFIX)) {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(param.slice(1)) as Record<string, unknown>
    } catch {
      return null
    }
    const idx = rows.findIndex((r) => primaryKey.every((c) => String(r[c]) === String(parsed[c])))
    return idx >= 0 ? { row: rows[idx], index: idx } : null
  }

  // Scalar PK
  if (primaryKey.length !== 1) return null
  const pk = primaryKey[0]
  const idx = rows.findIndex((r) => String(r[pk]) === param)
  return idx >= 0 ? { row: rows[idx], index: idx } : null
}
