import type { ColumnInfo } from "@/lib/introspect"

const NAME_PRIORITIES = [
  "name",
  "title",
  "label",
  "display_name",
  "email",
  "username",
  "slug",
  "code",
  "reference",
  "transaction_id",
  "order_number",
] as const

const TEXTY_TYPES = new Set(["text", "character varying", "character", "uuid", "citext"])

/**
 * Picks the column whose value should be the card title for a row.
 * Falls back to the first PK column, then the first column.
 */
export function pickPrimaryField(columns: ColumnInfo[], primaryKey: string[]): ColumnInfo {
  for (const candidate of NAME_PRIORITIES) {
    const match = columns.find((c) => c.name.toLowerCase() === candidate)
    if (match) return match
  }
  // Any text-typed non-pk column?
  const texty = columns.find((c) => TEXTY_TYPES.has(c.dataType) && !primaryKey.includes(c.name))
  if (texty) return texty
  // PK fallback
  if (primaryKey.length > 0) {
    const pk = columns.find((c) => c.name === primaryKey[0])
    if (pk) return pk
  }
  return columns[0]
}
