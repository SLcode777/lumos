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
import { cn } from "@/lib/utils"

const MAX_TEXT_PREVIEW = 80

type Props = Readonly<{
  value: unknown
  column: ColumnInfo
  mode?: "compact" | "full"
}>

/**
 * Type-aware single-cell renderer. Returns inline content (compact mode) or
 * block content (full mode, used by the row detail panel).
 *
 * Dispatch is on the column's normalized `data_type`. Falls back to a
 * stringified preview for any unknown type.
 */
export function Cell({ value, column, mode = "compact" }: Props) {
  if (value === null || value === undefined) {
    if (mode === "full") {
      return <span className="text-muted-foreground italic">No value</span>
    }
    return <span className="text-muted-foreground italic">—</span>
  }

  // Arrays first: udt_name is the only reliable signal (pg returns `data_type`
  // = "ARRAY" but that's not granular enough — we check udt_name to know
  // both that it's an array and what element type).
  if (isArrayColumn(column.udtName)) {
    if (mode === "full") {
      return <pre className="font-mono text-xs break-words whitespace-pre-wrap">{safeJsonStringify(value, 2)}</pre>
    }
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
    if (mode === "full") {
      return <pre className="wrap-break-words font-mono text-xs whitespace-pre-wrap">{safeJsonStringify(value, 2)}</pre>
    }
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
          className={cn("underline-offset-2 hover:underline", mode === "full" && "break-all")}
        >
          {mode === "full" ? str : truncate(str, MAX_TEXT_PREVIEW)}
          <ExternalLink className="ml-1 inline-block h-3 w-3 align-text-bottom" aria-hidden />
        </a>
      )
    }
    if (mode === "full") {
      return <span className="wrap-break-words whitespace-pre-wrap">{str}</span>
    }
    return <span title={str.length > MAX_TEXT_PREVIEW ? str : undefined}>{truncate(str, MAX_TEXT_PREVIEW)}</span>
  }

  // Fallback: string-stringify, preview, italic. Truncate in compact, full text in full.
  let display: string
  try {
    display = typeof value === "object" ? JSON.stringify(value) : String(value)
  } catch {
    display = String(value)
  }
  if (mode === "full") {
    return <span className="wrap-break-words whitespace-pre-wrap text-muted-foreground italic">{display}</span>
  }
  return (
    <span className="text-muted-foreground italic" title={display.length > MAX_TEXT_PREVIEW ? display : undefined}>
      {truncate(display, MAX_TEXT_PREVIEW)}
    </span>
  )
}

function safeJsonStringify(value: unknown, indent: number): string {
  try {
    return JSON.stringify(value, null, indent)
  } catch {
    return String(value)
  }
}