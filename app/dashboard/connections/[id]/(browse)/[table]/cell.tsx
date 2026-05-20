import { Badge } from "@/components/ui/badge"
import {
  DATE_TYPES,
  NUMERIC_TYPES,
  TEXT_TYPES,
  formatDate,
  isArrayColumn,
  looksLikeUrl,
  looksLikeImageUrl,
  normalizeDataType,
  previewJson,
  truncate,
} from "@/lib/cell-format"
import type { ColumnInfo } from "@/lib/introspect"
import { cn } from "@/lib/utils"
import { FkLabelSlot } from "@/lib/resolve-fks"
import { ImagePreview } from "./image-preview" // ← ajout
import { UrlLink } from "./url-link"

const MAX_TEXT_PREVIEW = 80

type Props = Readonly<{
  value: unknown
  column: ColumnInfo
  mode?: "compact" | "full"
  /**
   * When this column is an FK and the resolver has a result for the current
   * value, render the resolved label (with the raw value in `title`) instead
   * of the type-aware dispatch. Orphan FKs render raw + a "(missing)" tag.
   * `undefined` means: not an FK / null value / not resolvable → existing path.
   */
  fkLabel?: FkLabelSlot
}>

/**
 * Type-aware single-cell renderer. Returns inline content (compact mode) or
 * block content (full mode, used by the row detail panel).
 *
 * Dispatch is on the column's normalized `data_type`. Falls back to a
 * stringified preview for any unknown type.
 */
export function Cell({ value, column, mode = "compact", fkLabel }: Props) {
  if (value === null || value === undefined) {
    if (mode === "full") {
      return <span className="text-muted-foreground italic">No value</span>
    }
    return <span className="text-muted-foreground italic">—</span>
  }

  // FK label resolution short-circuits the type-aware path.
  // Raw value remains accessible via the `title` attribute on hover.
  if (fkLabel?.kind === "hit") {
    const raw = String(value)
    if (mode === "full") {
      return (
        <span title={raw} className="wrap-break-words">
          {fkLabel.label}
        </span>
      )
    }
    return <span title={raw}>{truncate(fkLabel.label, MAX_TEXT_PREVIEW)}</span>
  }
  if (fkLabel?.kind === "missing") {
    const raw = String(value)
    if (mode === "full") {
      return (
        <span title="Target row not found" className="wrap-break-words">
          <span className="font-mono text-xs">{raw}</span> <em className="text-muted-foreground">(missing)</em>
        </span>
      )
    }
    return (
      <span title={`${raw} — target row not found`}>
        <span className="font-mono text-xs">{truncate(raw, MAX_TEXT_PREVIEW)}</span>{" "}
        <em className="text-muted-foreground not-italic">(missing)</em>
      </span>
    )
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
      if (looksLikeImageUrl(str)) {
        return <ImagePreview url={str} mode={mode} fallback={<UrlLink url={str} mode={mode} />} />
      }
      return <UrlLink url={str} mode={mode} />
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
