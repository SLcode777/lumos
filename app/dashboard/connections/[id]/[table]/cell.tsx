import { ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  DATE_TYPES,
  NUMERIC_TYPES,
  TEXT_TYPES,
  formatDate,
  isArrayColumn,
  looksLikeUrl,
  normalizeDataType,
  previewJson,
  truncate,
} from "@/lib/cell-format"
import type { ColumnInfo } from "@/lib/introspect"

const MAX_TEXT_PREVIEW = 80

type Props = Readonly<{
  value: unknown
  column: ColumnInfo
}>

/**
 * Type-aware single-cell renderer. Returns inline content suitable for
 * embedding inside a card chip (its parent applies truncation + color).
 *
 * Dispatch is on the column's normalized `data_type`. Falls back to a
 * stringified preview for any unknown type.
 */
export function Cell({ value, column }: Props) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">—</span>
  }

  // Arrays first: udt_name is the only reliable signal (pg returns `data_type`
  // = "ARRAY" but that's not granular enough — we check udt_name to know
  // both that it's an array and what element type).
  if (isArrayColumn(column.udtName)) {
    return <span className="font-mono text-xs">{previewJson(value)}</span>
  }

  const t = normalizeDataType(column.dataType)

  if (t === "boolean") {
    return value ? (
      <Badge variant="secondary" className="font-medium">
        true
      </Badge>
    ) : (
      <Badge variant="outline" className="font-medium">
        false
      </Badge>
    )
  }

  if (NUMERIC_TYPES.has(t)) {
    return <span className="font-mono tabular-nums">{String(value)}</span>
  }

  if (DATE_TYPES.has(t)) {
    const formatted = formatDate(value, t)
    if (!formatted) return <span>{String(value)}</span>
    return (
      <time dateTime={formatted.iso} className="whitespace-nowrap">
        {formatted.display}
      </time>
    )
  }

  if (t === "uuid") {
    return <span className="font-mono text-xs">{String(value)}</span>
  }

  if (t === "json" || t === "jsonb") {
    return <span className="font-mono text-xs">{previewJson(value)}</span>
  }

  if (TEXT_TYPES.has(t)) {
    const str = String(value)
    if (looksLikeUrl(str)) {
      return (
        <a
          href={str}
          target="_blank"
          rel="noopener noreferrer"
          title={str}
          className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
        >
          <span className="truncate">{truncate(str, MAX_TEXT_PREVIEW)}</span>
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
        </a>
      )
    }
    return <span title={str.length > MAX_TEXT_PREVIEW ? str : undefined}>{truncate(str, MAX_TEXT_PREVIEW)}</span>
  }

  // Fallback: string-stringify, preview, italic.
  let display: string
  try {
    display = typeof value === "object" ? JSON.stringify(value) : String(value)
  } catch {
    display = String(value)
  }
  return (
    <span className="text-muted-foreground italic" title={display.length > MAX_TEXT_PREVIEW ? display : undefined}>
      {truncate(display, MAX_TEXT_PREVIEW)}
    </span>
  )
}
