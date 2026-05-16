import { notFound, redirect } from "next/navigation"

import { AccessError } from "@/lib/access"
import { decrypt } from "@/lib/crypto"
import { getSession } from "@/lib/get-session"
import { loadConnection } from "@/lib/load-connection"
import { loadSchema } from "@/lib/load-schema"
import { getConnectionPool } from "@/lib/pool-manager"
import { queryRowByPk, queryTableRows } from "@/lib/query-table"

import { PaginationControls } from "./pagination-controls"
import { buildFkIndex } from "@/lib/fk-index"
import { pickPrimaryField } from "@/lib/primary-fields"
import { RecordCards } from "./record-cards"
import { TableToolbar } from "./table-toolbar"
import { stringifyForTitle } from "@/lib/cell-format"
import { encodeRowParam, findRowByParam } from "@/lib/row-id"
import { Cell } from "./cell"
import { RowDetailPanel, type PanelData } from "./row-detail-panel"
import { parseSortParams, SortState } from "@/lib/sort"
import { ColumnInfo, type DatabaseSchema, type TableInfo } from "@/lib/introspect"
import { type FkLabels, lookupFkLabel, resolveForeignKeyLabels } from "@/lib/resolve-fks"
import {
  countInverseRelationsForPage,
  fetchRelatedRows,
  humanizeTableName,
  inverseCountKey,
  inverseRelationKey,
  type InverseRelationMeta,
  type PageInverseRelations,
} from "@/lib/inverse-relations"
import { buildPanelCloseHref, buildPanelHref, parsePanelParams, type PanelState } from "@/lib/panel-href"
import {
  RelatedRecordsSubPanel,
  type RelatedRecordCardData,
  type RelatedRecordsSubPanelData,
} from "./related-records-subpanel"
import type { Pool } from "pg"

const PAGE_SIZES = [25, 50, 100] as const
const DEFAULT_PAGE_SIZE = 50

export default async function TableViewPage({
  params,
  searchParams,
}: PageProps<"/dashboard/connections/[id]/[table]">) {
  const session = await getSession()
  const { id, table } = await params

  if (!session) {
    redirect(`/signin?next=/dashboard/connections/${id}/${table}`)
  }

  let conn
  try {
    conn = await loadConnection(id, session.user.id)
  } catch (err) {
    if (err instanceof AccessError) notFound()
    throw err
  }

  const connectionString = decrypt({
    ciphertext: conn.encryptedConnString,
    iv: conn.iv,
    authTag: conn.authTag,
  })
  const pool = getConnectionPool(conn.id, connectionString, conn.sslEnabled)

  // Schema is needed to validate the [table] segment AND to render the
  // data grid headers. Cached: layout already ran this.
  let schema
  try {
    schema = await loadSchema(pool)
  } catch (err) {
    console.error("[table-view] schema load failed:", err instanceof Error ? err.message : err)
    return <InlineErrorState message="Could not introspect the database. The connection may be unreachable." />
  }

  // Decode the URL segment (Next.js auto-decodes %20 etc., but be explicit).
  const decodedTable = decodeURIComponent(table)

  // Validate against the introspected schema — this is the whitelist.
  const tableInfo = schema.tables.find((t) => t.name === decodedTable)
  if (!tableInfo) notFound()

  // Parse pagination from searchParams (validated + clamped).
  const sp = await searchParams
  const pageSize = parsePageSize(sp.pageSize)
  const page = parsePage(sp.page)
  const sort = parseSortParams(sp.sort, sp.order, tableInfo.columns)

  let rows: Record<string, unknown>[] = []
  let queryError: string | null = null
  try {
    const result = await queryTableRows(pool, {
      pgSchema: tableInfo.schema,
      table: tableInfo.name,
      page,
      pageSize,
      orderBy: sort,
    })
    rows = result.rows
  } catch (err) {
    console.error("[table-view] query failed:", err instanceof Error ? err.message : err)
    queryError = "Couldn't fetch rows from this table."
  }

  // Resolve FK labels and inverse relations for the page in ONE batch per target table.
  // Best-effort: if it fails entirely, we fall back to raw values silently.
  let fkLabels = new Map<string, string | null>()
  let pageInverseRelations: Awaited<ReturnType<typeof countInverseRelationsForPage>> = {
    meta: [],
    counts: new Map(),
  }
  if (!queryError) {
    // Both helpers depend only on `rows`. Run them in parallel on the shared
    // pool — no inter-dependency, and the wall-time wins on warm pools.
    const [labels, inv] = await Promise.all([
      resolveForeignKeyLabels({ pool, schema, fromTable: tableInfo, rows }),
      countInverseRelationsForPage({ pool, schema, currentTable: tableInfo, rows }),
    ])
    fkLabels = labels
    pageInverseRelations = inv
  }
  const totalEstimate = tableInfo.rowCountEstimate >= 0 ? tableInfo.rowCountEstimate : 0
  const totalPages = Math.max(1, Math.ceil(totalEstimate / pageSize))

  const primary = pickPrimaryField(tableInfo.columns, tableInfo.primaryKey)
  const fkIndex = buildFkIndex(schema.foreignKeys, tableInfo.schema, tableInfo.name)

  // Build the URL building blocks. The base URL is the table view route; the
  // "non-row" search params (page, pageSize, sort eventually) are kept across
  // all row hrefs so users don't lose pagination state when opening a detail.
  const baseHref = `/dashboard/connections/${id}/${encodeURIComponent(decodedTable)}`
  const persistentParams = new URLSearchParams()
  if (typeof sp.page === "string") persistentParams.set("page", sp.page)
  if (typeof sp.pageSize === "string") persistentParams.set("pageSize", sp.pageSize)
  if (sort) {
    persistentParams.set("sort", sort.column)
    persistentParams.set("order", sort.direction)
  }

  const sortHrefs = buildSortHrefs(baseHref, sp, sort, tableInfo.columns)

  const closeHref = buildPanelCloseHref(baseHref, persistentParams)

  const rowHrefs = rows.map((row, i) =>
    buildPanelHref(baseHref, persistentParams, {
      mode: "row",
      panelTable: tableInfo.name,
      panelRow: encodeRowParam(row, tableInfo.primaryKey, i),
    })
  )

  // Pre-compute hrefs for inverse-relation chips on the row cards. Keyed by
  // `${rowPk}|${inverseRelationKey(meta)}`. Empty relations (count=0) are
  // skipped — those chips stay inert. Composite-PK current tables never
  // produce inverse meta (cf. countInverseRelationsForPage), so pkCol is set
  // whenever there's anything to link.
  const inverseHrefs = new Map<string, string>()
  const pkCol = tableInfo.primaryKey[0]
  if (pkCol) {
    for (const row of rows) {
      const rowPk = row[pkCol]
      if (rowPk === null || rowPk === undefined) continue
      const rowPkString = String(rowPk)
      for (const meta of pageInverseRelations.meta) {
        const count = pageInverseRelations.counts.get(inverseCountKey(rowPkString, meta)) ?? 0
        if (count === 0) continue
        inverseHrefs.set(
          `${rowPkString}|${inverseRelationKey(meta)}`,
          buildPanelHref(baseHref, persistentParams, {
            mode: "related",
            panelTable: meta.sourceTable,
            panelFk: meta.fromColumn,
            panelParentPk: rowPkString,
          })
        )
      }
    }
  }

  // Parse panel state from the URL — orthogonal to the route. Two modes are
  // wired up: `row` (single-row detail, fresh fetch via buildRowPanelData) and
  // `related` (drill-down list, fresh fetch via buildRelatedPanelData). The
  // page-level batches above stay scoped to the row cards on the table view.
  const panelState = parsePanelParams(sp)
  let panelData: PanelData | null = null
  let relatedData: RelatedRecordsSubPanelData | null = null

  if (panelState?.mode === "row") {
    panelData = await buildRowPanelData({
      pool,
      schema,
      panelTable: panelState.panelTable,
      panelRow: panelState.panelRow,
      currentTable: tableInfo,
      currentRows: rows,
      currentRowHrefs: rowHrefs,
      baseHref,
      persistentParams,
    })
  } else if (panelState?.mode === "related") {
    relatedData = await buildRelatedPanelData({
      pool,
      schema,
      panelState,
      pageInverseRelationsMeta: pageInverseRelations.meta,
      baseHref,
      persistentParams,
    })
  }

  return (
    <div className="flex h-full flex-col">
      <TableToolbar columns={tableInfo.columns} sort={sort} sortHrefs={sortHrefs} />
      {queryError ? (
        <InlineErrorState message={queryError} />
      ) : (
        <RecordCards
          columns={tableInfo.columns}
          rows={rows}
          primary={primary}
          pkColumnName={tableInfo.primaryKey[0]}
          fkIndex={fkIndex}
          fkLabels={fkLabels}
          pageInverseRelations={pageInverseRelations}
          rowHrefs={rowHrefs}
          inverseHrefs={inverseHrefs}
        />
      )}
      <PaginationControls page={page} pageSize={pageSize} totalPages={totalPages} totalEstimate={totalEstimate} />
      <RowDetailPanel
        data={panelData}
        closeHref={closeHref}
        tableName={panelState?.panelTable ?? decodedTable}
      />
      <RelatedRecordsSubPanel data={relatedData} closeHref={closeHref} />
    </div>
  )
}

function parsePageSize(raw: string | string[] | undefined): number {
  if (typeof raw !== "string") return DEFAULT_PAGE_SIZE
  const parsed = Number.parseInt(raw, 10)
  return PAGE_SIZES.includes(parsed as (typeof PAGE_SIZES)[number]) ? parsed : DEFAULT_PAGE_SIZE
}

function parsePage(raw: string | string[] | undefined): number {
  if (typeof raw !== "string") return 1
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
}

function InlineErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

/**
 * Build the per-column hrefs used by the SortMenu. Each column href encodes
 * the next state in the asc → desc → unsorted cycle for that column. The
 * `clear` href removes sort entirely.
 *
 * `page` is reset to 1 on any sort change — the previous "page 3" doesn't
 * map to anything meaningful under a new order.
 */
function buildSortHrefs(
  baseHref: string,
  sp: { [key: string]: string | string[] | undefined },
  current: SortState | null,
  columns: ColumnInfo[],
): { perColumn: Record<string, string>; clear: string; flip: string | null } {
  function buildHref(nextSort: string | null, nextOrder: "asc" | "desc" | null): string {
    const params = new URLSearchParams()
    if (typeof sp.pageSize === "string") params.set("pageSize", sp.pageSize)
    if (nextSort) params.set("sort", nextSort)
    if (nextOrder) params.set("order", nextOrder)
    // page is intentionally reset to 1 (= absent param), see JSDoc above.
    const qs = params.toString()
    return qs ? `${baseHref}?${qs}` : baseHref
  }

  const perColumn: Record<string, string> = {}
  for (const col of columns) {
    if (!current || current.column !== col.name) {
      // Inactive column → next click starts the cycle at asc.
      perColumn[col.name] = buildHref(col.name, "asc")
    } else if (current.direction === "asc") {
      // Active + asc → next click flips to desc.
      perColumn[col.name] = buildHref(col.name, "desc")
    } else {
      // Active + desc → next click clears sort.
      perColumn[col.name] = buildHref(null, null)
    }
  }

  // Strict asc↔desc flip for the active column (used by the inline arrow
  // button in the toolbar). Null when there's no active sort to flip.
  let flip: string | null = null
  if (current) {
    const flipped = current.direction === "asc" ? "desc" : "asc"
    flip = buildHref(current.column, flipped)
  }

  return {
    perColumn,
    clear: buildHref(null, null),
    flip,
  }
}

type BuildRowPanelDataParams = {
  pool: Pool
  schema: DatabaseSchema
  /** Table the panel is displaying — may differ from currentTable. */
  panelTable: string
  /** PK value from the URL (already string-encoded). */
  panelRow: string
  /** The current route's table — used to compute prev/next when the panel row is on the visible page. */
  currentTable: TableInfo
  /** The current page's rows — same use as above. */
  currentRows: Record<string, unknown>[]
  /** Pre-built hrefs for prev/next when the panel row is on the visible page. */
  currentRowHrefs: string[]
  /** Current route base href — used to build inverse-relation hrefs that stay on the current route. */
  baseHref: string
  /** Pagination/sort params preserved when toggling the sub-panel from inverse cards. */
  persistentParams: URLSearchParams
}

/**
 * Builds the data shape consumed by `<RowDetailPanel>` for `?panel=row`.
 *
 * Independent of the page-level batches (`rows`, `fkLabels`, `pageInverseRelations`):
 * fetches the target row, its forward-FK labels, and its inverse counts fresh.
 * This is what unlocks cross-table panels and deep-linked rows (#33, #40).
 *
 * Single-column PK only for the fresh fetch path. Composite PKs (`$<json>`) and
 * index encodings (`#<index>`) fall back to looking up the row in the current
 * page's rows — same behavior as pre-refactor for those edge cases.
 */
async function buildRowPanelData({
  pool,
  schema,
  panelTable,
  panelRow,
  currentTable,
  currentRows,
  currentRowHrefs,
  baseHref,
  persistentParams,
}: BuildRowPanelDataParams): Promise<PanelData | null> {
  const target = schema.tables.find((t) => t.name === panelTable)
  if (!target) return null

  // ── Resolve the row ───────────────────────────────────────────────────
  let row: Record<string, unknown> | null = null
  let indexInPage = -1 // -1 = not in the current page (no prev/next)

  const isComposite = panelRow.startsWith("$")
  const isIndex = panelRow.startsWith("#")

  if (!isComposite && !isIndex && target.primaryKey.length === 1) {
    try {
      row = await queryRowByPk(pool, {
        pgSchema: target.schema,
        table: target.name,
        pkColumn: target.primaryKey[0],
        value: panelRow,
      })
    } catch (err) {
      console.error("[panel] queryRowByPk failed:", err instanceof Error ? err.message : err)
      return null
    }
    // Same-table case: locate it in the current page so we can wire prev/next.
    if (row && target.schema === currentTable.schema && target.name === currentTable.name) {
      const idx = currentRows.findIndex((r) => String(r[target.primaryKey[0]]) === panelRow)
      if (idx >= 0) indexInPage = idx
    }
  } else if (target.schema === currentTable.schema && target.name === currentTable.name) {
    // Composite / index fallback — only works if the row is on the current page.
    const found = findRowByParam(currentRows, currentTable.primaryKey, panelRow)
    if (found) {
      row = found.row
      indexInPage = found.index
    }
  }

  if (!row) return null

  // ── Forward FK labels for THIS row (one-row batch) ────────────────────
  let panelFkLabels: FkLabels = new Map()
  try {
    panelFkLabels = await resolveForeignKeyLabels({
      pool,
      schema,
      fromTable: target,
      rows: [row],
    })
  } catch (err) {
    console.error("[panel] resolveForeignKeyLabels failed:", err instanceof Error ? err.message : err)
    // Degraded: raw values render. Panel still opens.
  }

  // ── Inverse-relation counts for THIS row (one-row batch) ──────────────
  let panelInverse: PageInverseRelations = { meta: [], counts: new Map() }
  try {
    panelInverse = await countInverseRelationsForPage({
      pool,
      schema,
      currentTable: target,
      rows: [row],
    })
  } catch (err) {
    console.error(
      "[panel] countInverseRelationsForPage failed:",
      err instanceof Error ? err.message : err
    )
    // Degraded: no inverse cards. Panel still opens.
  }

  // ── Build the panel shape ─────────────────────────────────────────────
  const targetPrimary = pickPrimaryField(target.columns, target.primaryKey)
  const targetFkIndex = buildFkIndex(schema.foreignKeys, target.schema, target.name)
  const targetPkCol = target.primaryKey[0]

  return {
    title: stringifyForTitle(row[targetPrimary.name]),
    subtitle:
      indexInPage === -1
        ? humanizeTableName(target.name)
        : `Row ${indexInPage + 1} of ${currentRows.length}`,
    fields: target.columns.map((col) => {
      const fkInfo = targetFkIndex.get(col.name)
      const value = row[col.name]
      return {
        column: col,
        isFk: Boolean(fkInfo),
        content: (
          <Cell
            value={value}
            column={col}
            mode="full"
            fkLabel={lookupFkLabel(panelFkLabels, fkInfo, value)}
          />
        ),
      }
    }),
    inverseRelations: panelInverse.meta.map((m) => {
      const count = targetPkCol
        ? panelInverse.counts.get(inverseCountKey(String(row[targetPkCol]), m)) ?? 0
        : 0
      // Pre-build the sub-panel href so the client component stays dumb.
      // Empty relations (count=0) stay inert — render as <div>, not <Link>.
      // The sub-panel's Back button uses router.back() to return here, so we
      // don't need to encode a return path in the URL.
      const href =
        count > 0 && targetPkCol
          ? buildPanelHref(baseHref, persistentParams, {
              mode: "related",
              panelTable: m.sourceTable,
              panelFk: m.fromColumn,
              panelParentPk: String(row[targetPkCol]),
            })
          : null
      return { meta: m, count, href }
    }),
    prevHref: indexInPage > 0 ? currentRowHrefs[indexInPage - 1] : null,
    nextHref:
      indexInPage >= 0 && indexInPage < currentRowHrefs.length - 1
        ? currentRowHrefs[indexInPage + 1]
        : null,
  }
}

const RELATED_VISIBLE_FIELDS = 4

type BuildRelatedPanelDataParams = {
  pool: Pool
  schema: DatabaseSchema
  /** Already typed `mode: "related"` by the parsePanelParams discriminant. */
  panelState: Extract<PanelState, { mode: "related" }>
  /** Inverse-FK meta list for the current route's table — used to validate the (panelTable, panelFk) pair. */
  pageInverseRelationsMeta: InverseRelationMeta[]
  /** Current route base href — card hrefs use this so the chained nav stays on the route. */
  baseHref: string
  /** Pagination/sort params preserved when switching the panel mode. */
  persistentParams: URLSearchParams
}

/**
 * Builds the data shape consumed by `<RelatedRecordsSubPanel>` for `?panel=related`.
 *
 * Independent of the page-level batches: fetches the related rows fresh via
 * `fetchRelatedRows`, batches FK humanization for them, and prepares clickable
 * card hrefs that switch the panel into `row` mode on the SAME ROUTE (chained
 * navigation never leaves the user's "browsing context").
 *
 * Returns null when:
 *   - (panelTable, panelFk) doesn't match any eligible inverse FK of the current
 *     route's table (stale or hand-typed URL)
 *   - the source table isn't in the introspected schema
 *   - fetchRelatedRows throws
 */
async function buildRelatedPanelData({
  pool,
  schema,
  panelState,
  pageInverseRelationsMeta,
  baseHref,
  persistentParams,
}: BuildRelatedPanelDataParams): Promise<RelatedRecordsSubPanelData | null> {
  // Validate: the (panelTable, panelFk) pair must match one of the current
  // table's eligible inverse FKs. Otherwise the URL is stale or hand-crafted.
  const meta = pageInverseRelationsMeta.find(
    (m) => m.sourceTable === panelState.panelTable && m.fromColumn === panelState.panelFk
  )
  if (!meta) return null

  // Sub-panel sort whitelisted against the SOURCE table's columns (not the route's).
  const sourceTableInfo = schema.tables.find(
    (t) => t.schema === meta.sourceSchema && t.name === meta.sourceTable
  )
  const sort = sourceTableInfo
    ? parseSortParams(panelState.panelSort, panelState.panelOrder, sourceTableInfo.columns)
    : null

  let fetched
  try {
    fetched = await fetchRelatedRows({
      pool,
      schema,
      meta,
      parentPk: panelState.panelParentPk,
      sort,
    })
  } catch (err) {
    console.error("[panel] fetchRelatedRows failed:", err instanceof Error ? err.message : err)
    return null
  }
  if (!fetched) return null

  const { sourceTable, rows: relatedRows, fkLabels, total } = fetched
  const sourcePrimary = pickPrimaryField(sourceTable.columns, sourceTable.primaryKey)
  const sourcePkCol = sourceTable.primaryKey[0]
  const sourceFkIndex = buildFkIndex(schema.foreignKeys, sourceTable.schema, sourceTable.name)

  const otherCols = sourceTable.columns.filter((c) => c.name !== sourcePrimary.name)
  const visibleCols = otherCols.slice(0, RELATED_VISIBLE_FIELDS)
  const hiddenCount = Math.max(0, otherCols.length - RELATED_VISIBLE_FIELDS)

  const cards: RelatedRecordCardData[] = relatedRows.map((row, i) => {
    const keyValue = sourcePkCol ? String(row[sourcePkCol] ?? `#${i}`) : `#${i}`

    // Click on a card → switch the panel into row mode for that target row.
    // baseHref is the CURRENT route — we DO NOT navigate to /<sourceTable>.
    // That's the whole point: chained nav stays on the current route.
    // The row panel's Back button uses router.back() so no return URL needed.
    const href = sourcePkCol
      ? buildPanelHref(baseHref, persistentParams, {
          mode: "row",
          panelTable: sourceTable.name,
          panelRow: String(row[sourcePkCol]),
        })
      : baseHref

    return {
      key: keyValue,
      title: stringifyForTitle(row[sourcePrimary.name]),
      hiddenCount,
      href,
      fields: visibleCols.map((col) => {
        const fkInfo = sourceFkIndex.get(col.name)
        const value = row[col.name]
        return {
          column: col,
          isFk: Boolean(fkInfo),
          content: (
            <Cell
              value={value}
              column={col}
              mode="compact"
              fkLabel={lookupFkLabel(fkLabels, fkInfo, value)}
            />
          ),
        }
      }),
    }
  })

  return {
    sourceTableHuman: humanizeTableName(sourceTable.name),
    sourceTableRaw: sourceTable.name,
    cards,
    total,
  }
}