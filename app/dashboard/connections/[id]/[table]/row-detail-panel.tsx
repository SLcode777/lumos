"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { createElement, useState } from "react"
import { ChevronLeft, ChevronRight, Link2, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { ColumnInfo } from "@/lib/introspect"
import { getTableIcon } from "@/lib/table-icon"
import { cn } from "@/lib/utils"
import { humanizeTableName, InverseRelationMeta, pluralizeRecord } from "@/lib/inverse-relations"

export type PanelData = {
  title: string
  subtitle: string
  /**
   * `isFk` drives the violet styling and the Link2 icon on each field card —
   * mirrors the chip styling in record-cards.tsx.
   *
   * `fkHref` is pre-built server-side (#40). Non-null when the column is a
   * hit FK on a single-column relation → the field card is rendered as a
   * Link navigating to the target row's detail panel. Null otherwise (raw
   * value, orphan, null, composite) → card stays as a visual-only `<div>`.
   */
  fields: { column: ColumnInfo; content: React.ReactNode; isFk: boolean; fkHref: string | null }[]
  /**
   * `href` is pre-built server-side. Non-null when count > 0 → the card is
   * rendered as a Link to the related sub-panel (mode `related`). Null when
   * count === 0 → card stays inert (visual-only).
   */
  inverseRelations: { meta: InverseRelationMeta; count: number; href: string | null }[]
  prevHref: string | null
  nextHref: string | null
}

type Props = Readonly<{
  data: PanelData | null
  closeHref: string
  tableName: string
}>

/**
 * Side panel showing the full content of a single row. Driven by the
 * `?row=` searchParam upstream — when `data` is non-null, the Sheet opens.
 *
 * Closing (Escape, click outside, X) navigates back to the close URL,
 * which clears `?row=`. We keep the last non-null `data` in a ref-shaped
 * state so the close animation has stable content to render.
 */
export function RowDetailPanel({ data, closeHref, tableName }: Props) {
  const router = useRouter()
  // Resolve via createElement instead of JSX: React Compiler flags
  // <Capitalized /> when the component reference is a local variable,
  // even when the underlying resolution is stable. createElement is a
  // function call so the rule doesn't apply.
  const tableIconNode = createElement(getTableIcon(tableName), {
    className: "h-4 w-4 shrink-0 text-muted-foreground",
    "aria-hidden": true,
  })

  // Keep the last non-null `data` so the close animation has stable content.
  // Without this, navigating to closeHref clears `data` instantly and the
  // panel would slide out empty.
  //
  // Pattern: "Adjusting state during render" from React 19 docs — when a prop
  // changes, set the relevant state synchronously inside the render. React
  // detects this and re-runs the render with the new state without an extra
  // commit, so it's cheaper (and lint-clean) compared to useEffect.
  const [stableData, setStableData] = useState(data)
  const [previousData, setPreviousData] = useState(data)
  if (data !== previousData) {
    setPreviousData(data)
    if (data !== null) setStableData(data)
  }

  const open = data !== null

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) router.push(closeHref, { scroll: false })
      }}
    >
      <SheetContent
        side="right"
        // The shadcn Sheet defaults to `data-[side=right]:sm:max-w-sm` (384px).
        // We need the same selector prefix here, otherwise tailwind-merge keeps
        // both classes and the more specific one (the default) wins via CSS.
        className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-160"
        overlayHref={closeHref}
        overlayAriaLabel="Close detail panel"
        showCloseButton={false}
      >
        <Button asChild variant="ghost" className="absolute top-4 right-4 bg-secondary" size="icon-sm">
          <Link href={closeHref} aria-label="Close detail panel" scroll={false}>
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
                <span className="shrink-0 text-sm text-muted-foreground">{tableName}</span>
                <span className="shrink-0 text-sm text-muted-foreground">/</span>
                <SheetTitle className="min-w-0 truncate text-sm font-semibold">{stableData.title}</SheetTitle>
              </div>
              <SheetDescription className="sr-only">{stableData.subtitle}</SheetDescription>
            </SheetHeader>

            <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-6 py-2">
              <Button variant="ghost" size="sm" disabled={!stableData.prevHref} asChild={!!stableData.prevHref}>
                {stableData.prevHref ? (
                  <Link href={stableData.prevHref} scroll={false}>
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Link>
                ) : (
                  <>
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </>
                )}
              </Button>
              <span className="text-xs text-muted-foreground">{stableData.subtitle}</span>
              <Button variant="ghost" size="sm" disabled={!stableData.nextHref} asChild={!!stableData.nextHref}>
                {stableData.nextHref ? (
                  <Link href={stableData.nextHref} scroll={false}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 px-6 py-5">
              {stableData.fields.map(({ column, content, isFk, fkHref }) => {
                // Body is the same regardless of clickability — only the
                // wrapping element (Link vs div) and a hover state differ.
                const cardBody = (
                  <>
                    <p
                      className={cn(
                        "mb-1 flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase",
                        isFk ? "text-violet-700 dark:text-violet-300" : "text-muted-foreground"
                      )}
                    >
                      {isFk && <Link2 className="h-3 w-3" aria-hidden />}
                      {column.name}
                    </p>
                    <div className="text-sm">{content}</div>
                  </>
                )

                const classes = cn(
                  "block rounded-xl border bg-card p-4 shadow-sm ring-1 ring-foreground/5",
                  isFk &&
                    "border-violet-200 bg-violet-50/60 ring-violet-200/40 dark:border-violet-900 dark:bg-violet-950/30 dark:ring-violet-900/30",
                  fkHref &&
                    "cursor-pointer transition hover:border-violet-300 hover:bg-violet-100/80 dark:hover:border-violet-800 dark:hover:bg-violet-950/50"
                )

                // No ClickableCard parent here (the panel is in its own Sheet),
                // so the Link doesn't need the pointer-events trick. Simple wrap.
                if (fkHref) {
                  return (
                    <Link key={column.name} href={fkHref} scroll={false} className={classes}>
                      {cardBody}
                    </Link>
                  )
                }
                return (
                  <div key={column.name} className={classes}>
                    {cardBody}
                  </div>
                )
              })}
              {stableData.inverseRelations.map(({ meta, count, href }) => (
                <InverseRelationCard
                  key={`${meta.sourceSchema}.${meta.sourceTable}.${meta.fromColumn}`}
                  meta={meta}
                  count={count}
                  href={href}
                />
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function InverseRelationCard({ meta, count, href }: { meta: InverseRelationMeta; count: number; href: string | null }) {
  const empty = count === 0
  const cardBody = (
    <>
      <p
        className={cn(
          "mb-1 flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase",
          !empty ? "text-violet-700 dark:text-violet-300" : "text-muted-foreground"
        )}
      >
        <Link2 className="h-3 w-3" aria-hidden />
        {humanizeTableName(meta.sourceTable)}
        {meta.ambiguous && <span className="ml-1 text-muted-foreground/70 normal-case">({meta.fromColumn})</span>}
      </p>
      <div className="text-sm">{pluralizeRecord(count)}</div>
    </>
  )

  const classes = cn(
    "block rounded-xl border bg-card p-4 shadow-sm ring-1 ring-foreground/5",
    !empty &&
      "border-violet-200 bg-violet-50/60 ring-violet-200/40 dark:border-violet-900 dark:bg-violet-950/30 dark:ring-violet-900/30",
    empty && "opacity-60",
    href &&
      "cursor-pointer transition hover:border-violet-300 hover:bg-violet-100/80 dark:hover:border-violet-800 dark:hover:bg-violet-950/50"
  )

  if (href) {
    return (
      <Link
        href={href}
        scroll={false}
        className={classes}
        aria-label={`Open ${humanizeTableName(meta.sourceTable)} sub-panel`}
      >
        {cardBody}
      </Link>
    )
  }
  return <div className={classes}>{cardBody}</div>
}
