import { notFound, redirect } from "next/navigation"

import { AccessError } from "@/lib/access"
import { decrypt } from "@/lib/crypto"
import { getSession } from "@/lib/get-session"
import { loadConnection } from "@/lib/load-connection"
import { loadSchema } from "@/lib/load-schema"
import { getConnectionPool } from "@/lib/pool-manager"
import { queryTableRows } from "@/lib/query-table"

import { PaginationControls } from "./pagination-controls"
import { buildFkIndex } from "@/lib/fk-index"
import { pickPrimaryField } from "@/lib/primary-fields"
import { RecordCards } from "./record-cards."
import { TableToolbar } from "./table-toolbar"
import { stringifyForTitle } from "@/lib/cell-format"
import { encodeRowParam, findRowByParam } from "@/lib/row-id"
import { Cell } from "./cell"
import { RowDetailPanel } from "./row-detail-panel"

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

  let rows: Record<string, unknown>[] = []
  let queryError: string | null = null
  try {
    const result = await queryTableRows(pool, {
      pgSchema: tableInfo.schema,
      table: tableInfo.name,
      page,
      pageSize,
    })
    rows = result.rows
  } catch (err) {
    console.error("[table-view] query failed:", err instanceof Error ? err.message : err)
    queryError = "Couldn't fetch rows from this table."
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

  const persistentQuery = persistentParams.toString()
  const closeHref = persistentQuery ? `${baseHref}?${persistentQuery}` : baseHref

  const rowHrefs = rows.map((row, i) => {
    const params = new URLSearchParams(persistentParams)
    params.set("row", encodeRowParam(row, tableInfo.primaryKey, i))
    return `${baseHref}?${params.toString()}`
  })

  // Resolve the active row from the URL, then build the panel's data shape.
  const rowParam = typeof sp.row === "string" ? sp.row : null
  const found = rowParam !== null ? findRowByParam(rows, tableInfo.primaryKey, rowParam) : null

  const panelData = found
    ? {
        title: stringifyForTitle(found.row[primary.name]),
        subtitle: `Row ${found.index + 1} of ${rows.length}`,
        fields: tableInfo.columns.map((col) => ({
          column: col,
          isFk: fkIndex.has(col.name),
          content: <Cell value={found.row[col.name]} column={col} mode="full" />,
        })),
        prevHref: found.index > 0 ? rowHrefs[found.index - 1] : null,
        nextHref: found.index < rows.length - 1 ? rowHrefs[found.index + 1] : null,
      }
    : null

  return (
    <div className="flex h-full flex-col">
      <TableToolbar />
      {queryError ? (
        <InlineErrorState message={queryError} />
      ) : (
        <RecordCards columns={tableInfo.columns} rows={rows} primary={primary} fkIndex={fkIndex} rowHrefs={rowHrefs} />
      )}
      <PaginationControls page={page} pageSize={pageSize} totalPages={totalPages} totalEstimate={totalEstimate} />
      <RowDetailPanel data={panelData} closeHref={closeHref} tableName={decodedTable} />
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
