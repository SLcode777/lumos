/**
 * Pure formatting helpers for type-aware cell rendering.
 * No React, no DOM — testable in isolation.
 *
 * Consumed by app/.../[table]/cell.tsx.
 */

const URL_REGEX = /^https?:\/\//i

/**
 * Postgres data_type strings can carry a precision/length suffix like
 * `numeric(10,2)` or `character varying(255)`. We strip those before matching
 * to keep the dispatch table small. The result is lowercased and trimmed.
 */
export function normalizeDataType(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, "")
    .trim()
}

/**
 * Type buckets used by the Cell component. Coverage is curated for the
 * common Postgres types; anything not in these sets falls back to the
 * generic stringification path.
 */
export const NUMERIC_TYPES = new Set([
  "integer",
  "bigint",
  "smallint",
  "numeric",
  "decimal",
  "real",
  "double precision",
])

export const DATE_TYPES = new Set([
  "date",
  "timestamp",
  "timestamp without time zone",
  "timestamp with time zone",
  "time",
  "time without time zone",
  "time with time zone",
])

export const TEXT_TYPES = new Set(["text", "character varying", "character", "citext"])

/** True for any text-like string that "looks like" an HTTP(S) URL. */
export function looksLikeUrl(value: string): boolean {
  return URL_REGEX.test(value)
}

/**
 * True when the URL looks like a direct link to an image file. Detection is
 * path-only and case-insensitive — the query string is ignored, so
 * `https://cdn.example.com/avatar.png?v=42` still matches.
 *
 * Why path-only: many image URLs carry version/signature query strings,
 * so testing the raw URL with `endsWith(".png")` misses 80% of CDN cases.
 * Going through `new URL()` is the cleanest way to grab the pathname.
 *
 * Some popular image CDNs serve images at extensionless paths (e.g. GitHub
 * avatars at `/u/123`). For those we match by hostname instead.
 */
const IMAGE_EXT_REGEX = /\.(jpe?g|png|webp|gif|avif|svg)$/i

const IMAGE_HOST_REGEX =
  /(?:^|\.)(?:githubusercontent\.com|gravatar\.com|imgur\.com|googleusercontent\.com|twimg\.com|fbcdn\.net|cdninstagram\.com|cloudinary\.com|imagedelivery\.net|imagekit\.io|picsum\.photos|pravatar\.cc)$/i

export function looksLikeImageUrl(value: string): boolean {
  if (!looksLikeUrl(value)) return false
  try {
    const u = new URL(value)
    if (IMAGE_EXT_REGEX.test(u.pathname)) return true
    return IMAGE_HOST_REGEX.test(u.hostname)
  } catch {
    return false
  }
}

/**
 * Truncate a string to `max` characters, adding an ellipsis if it was cut.
 * Returns the original string when shorter or equal.
 */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max)}…`
}

/**
 * Render a JSON value as a compact preview that fits in a chip.
 * Objects → `{ key: …, … }` style snippet
 * Arrays  → `[a, b, …]` style snippet
 * Cycles or BigInt → `"{…}"` placeholder fallback.
 */
export function previewJson(value: unknown, max = 60): string {
  try {
    const json = JSON.stringify(value)
    if (!json) return "—"
    return truncate(json, max)
  } catch {
    return Array.isArray(value) ? "[…]" : "{…}"
  }
}

/**
 * Detect whether a column is an array based on its `udt_name`.
 * Postgres prefixes array UDT names with an underscore (e.g. `_int4`).
 */
export function isArrayColumn(udtName: string): boolean {
  return udtName.startsWith("_")
}

/** Module-level so we don't reallocate per render. */
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

const dateOnlyFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })

/**
 * Format a date-like value using the user's locale.
 * Returns `null` if the input doesn't parse to a valid date.
 */
export function formatDate(value: unknown, dataType: string): { iso: string; display: string } | null {
  // pg returns dates as Date objects (with the date-fns adapter) or as strings.
  const date = value instanceof Date ? value : new Date(value as string)
  if (Number.isNaN(date.getTime())) return null

  const isDateOnly = dataType === "date"
  return {
    iso: date.toISOString(),
    display: isDateOnly ? dateOnlyFormatter.format(date) : dateTimeFormatter.format(date),
  }
}

/**
 * Cheap stringification for header/title contexts where we want a string,
 * not a React node. Mirrors the data-grid's `renderRaw` policy: null → em-dash;
 * objects → JSON.stringify with String fallback; everything else → String.
 */
export function stringifyForTitle(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/**
 * Stringify a raw column value for clipboard copy.
 *
 * Returns `null` for null/undefined — the caller is expected to skip rendering
 * the copy affordance entirely in that case (we don't paste empty strings into
 * the user's clipboard silently).
 *
 * This is intentionally LOSSLESS w.r.t. the underlying scalar:
 * - Dates → ISO 8601 (independent of the user's locale formatting in the cell).
 * - Objects / arrays → JSON.stringify (no truncation, no preview).
 * - Booleans → "true" / "false" (not the badge UI).
 * - Numbers / uuids / text → String(value).
 *
 * Crucially, this does NOT apply any humanization (FK label resolution, image
 * thumbnailing, JSON preview). When a FK column shows "The Gourmet Pantry" in
 * the cell, the caller still passes us the raw FK id — and that's what ends
 * up in the clipboard.
 */
export function stringifyForClipboard(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "bigint") return value.toString()
  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      // Cycles, BigInt inside an object, etc. Fallback rather than throw —
      // a degraded string is still better than nothing.
      return String(value)
    }
  }
  return String(value)
}