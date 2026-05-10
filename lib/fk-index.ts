import type { FkInfo } from "@/lib/introspect"

export type FkIndex = Map<string, FkInfo>

/** Build a quick lookup: columnName → FK metadata, for a given table. */
export function buildFkIndex(foreignKeys: FkInfo[], schema: string, table: string): FkIndex {
  const idx: FkIndex = new Map()
  for (const fk of foreignKeys) {
    if (fk.fromSchema !== schema || fk.fromTable !== table) continue
    // Single-column FKs are the common case; for composite, index each from-column.
    for (const col of fk.fromColumns) {
      idx.set(col, fk)
    }
  }
  return idx
}
