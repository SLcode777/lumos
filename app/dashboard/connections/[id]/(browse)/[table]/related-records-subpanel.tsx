"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { createElement, useState } from "react"
import { ChevronLeft, ChevronRight, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { ColumnInfo } from "@/lib/introspect"
import { getTableIcon } from "@/lib/table-icon"
import { CopyFieldButton } from "./copy-field-button"

export type RelatedRecordCardData = {
  /** Stable React key — typically the row's stringified PK. */
  key: string
  /** Title shown on the card (the primary field's value, already stringified). */
  title: string
  /**
   * Pre-rendered field chips (column meta + Cell-rendered content).
   *
   * `fkHref` is pre-built server-side (#40). Non-null when the column is a
   * hit FK on a single-column relation → the chip is rendered as a Link to
   * the target row's detail panel on the CURRENT route. Null otherwise →
   * chip stays as a visual-only `<div>`.
   */
  fields: {
    column: ColumnInfo
    isFk: boolean
    content: React.ReactNode
    fkHref: string | null
    clipboardValue: string | null
  }[]
  /** Number of fields hidden under "+N more fields". */
  hiddenCount: number
  /** Where clicking the card navigates — pre-built via buildPanelHref (mode: "row"). */
  href: string
}

export type RelatedRecordsSubPanelData = {
  /** Title of the panel — humanized source table name. */
  sourceTableHuman: string
  /** Source table raw name (used for the icon). */
  sourceTableRaw: string
  /** Cards to render. Already sliced to RELATED_ROWS_LIMIT. */
  cards: RelatedRecordCardData[]
  /** Total count BEFORE limit — for the "first N of M" indicator. */
  total: number
  /**
   * Link to the source table's page with the FK filter applied. Non-null when
   * the result was truncated (cards.length < total). Clicking lands on the
   * filtered table view with the active filter badge in the toolbar.
   */
  seeAllHref: string | null
}

type Props = Readonly<{
  data: RelatedRecordsSubPanelData | null
  closeHref: string
}>

/**
 * Side panel listing records related to a parent row via one inverse FK.
 * Driven by ?panel=related&panelTable=...&panelFk=...&panelParentPk=... upstream
 * — when `data` is non-null, the Sheet opens.
 *
 * Mirrors RowDetailPanel's stable-data pattern so the close animation has
 * stable content.
 */
export function RelatedRecordsSubPanel({ data, closeHref }: Props) {
  const router = useRouter()
  const tableIconNode =
    data &&
    createElement(getTableIcon(data.sourceTableRaw), {
      className: "h-4 w-4 shrink-0 text-muted-foreground",
      "aria-hidden": true,
    })

  const [stableData, setStableData] = useState(data)
  const [previousData, setPreviousData] = useState(data)
  if (data !== previousData) {
    setPreviousData(data)
    if (data !== null) setStableData(data)
  }

  const open = data !== null
  const truncated = stableData ? stableData.cards.length < stableData.total : false

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) router.push(closeHref, { scroll: false })
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-160"
        overlayHref={closeHref}
        overlayAriaLabel="Close related records panel"
        showCloseButton={false}
      >
        <Button asChild variant="ghost" className="absolute top-4 right-4 bg-secondary" size="icon-sm">
          <Link href={closeHref} aria-label="Close related records panel" scroll={false}>
            <XIcon />
            <span className="sr-only">Close</span>
          </Link>
        </Button>

        {stableData && (
          <>
            <SheetHeader className="border-b px-6 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => router.back()}
                  aria-label="Back"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Back</span>
                </Button>
                {tableIconNode}
                <SheetTitle className="min-w-0 truncate text-sm font-semibold">
                  {stableData.sourceTableHuman} ({stableData.total})
                </SheetTitle>
              </div>
              <SheetDescription className="sr-only">
                {stableData.total} related records in {stableData.sourceTableHuman}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 px-4 py-4">
              {stableData.cards.map((card) => (
                <article
                  key={card.key}
                  className="relative cursor-pointer rounded-xl bg-card p-4 shadow-sm transition hover:shadow-md dark:border dark:border-stone-800"
                >
                  <Link
                    href={card.href}
                    aria-label={`Open detail view for ${card.title}`}
                    scroll={false}
                    className="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  />
                  <div className="pointer-events-none relative z-20 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="truncate text-base font-semibold text-foreground">{card.title}</h3>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {card.fields.map(({ column, content, isFk, fkHref, clipboardValue }) => (
                        <FieldChip
                          key={column.name}
                          column={column}
                          isFk={isFk}
                          fkHref={fkHref}
                          cardHref={card.href}
                          clipboardValue={clipboardValue}
                        >
                          {content}
                        </FieldChip>
                      ))}
                    </div>
                    {card.hiddenCount > 0 && (
                      <p className="mt-3 text-xs text-muted-foreground">+{card.hiddenCount} more fields</p>
                    )}
                  </div>
                </article>
              ))}
              {truncated &&
                (stableData.seeAllHref ? (
                  <Link
                    href={stableData.seeAllHref}
                    scroll={false}
                    className="block rounded-md px-2 pt-2 text-xs text-violet-700 transition hover:text-violet-800 dark:text-violet-500 dark:hover:text-violet-400"
                  >
                    Showing first {stableData.cards.length} of {stableData.total} records · See all →
                  </Link>
                ) : (
                  <p className="px-2 pt-2 text-xs text-muted-foreground">
                    Showing first {stableData.cards.length} of
                    {stableData.total} records.
                  </p>
                ))}{" "}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function FieldChip({
  column,
  isFk,
  fkHref,
  cardHref,
  clipboardValue,
  children,
}: {
  column: ColumnInfo
  isFk: boolean
  fkHref: string | null
  cardHref: string
  clipboardValue: string | null
  children: React.ReactNode
}) {
  const chipBody = (
    <>
      <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{column.name}</p>
      <div className="mt-1 truncate text-sm">{children}</div>
    </>
  )

  // Note: relative + group enable the absolute-positioned copy button + hover reveal.
  const classes =
    "group relative block rounded-md border bg-card p-2 " +
    (isFk ? "border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/30 " : "") +
    (fkHref
      ? "transition hover:border-violet-300 hover:bg-violet-100/80 dark:hover:border-violet-800 dark:hover:bg-violet-950/50"
      : "")

  // Every chip gets a Link-overlay sandwich. The non-FK overlay points to the
  // parent card's own href — duplicate of the article's row-level Link, but
  // necessary so `:hover` fires on `.group` (the article wrapper puts the chip
  // body in a `pointer-events-none` zone, otherwise group-hover never matches
  // outside of the copy button's own bounding box).
  const overlayHref = fkHref ?? cardHref
  const isFkLink = fkHref !== null

  return (
    <div className={classes}>
      <Link
        href={overlayHref}
        scroll={false}
        aria-label={isFkLink ? `Open ${column.name} target` : undefined}
        aria-hidden={isFkLink ? undefined : true}
        tabIndex={isFkLink ? undefined : -1}
        className="absolute inset-0 z-10 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <div className="pointer-events-none relative z-20 [&_button]:pointer-events-auto">{chipBody}</div>
      {clipboardValue !== null && <CopyFieldButton value={clipboardValue} columnName={column.name} />}
    </div>
  )
}