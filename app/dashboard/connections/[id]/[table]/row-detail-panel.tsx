"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { createElement, useState } from "react"
import { ChevronLeft, ChevronRight, Link2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { ColumnInfo } from "@/lib/introspect"
import { getTableIcon } from "@/lib/table-icon"
import { cn } from "@/lib/utils"
import { humanizeTableName, InverseRelationMeta, pluralizeRecord } from "@/lib/inverse-relations"

type PanelData = {
  title: string
  subtitle: string
  /**
   * `isFk` drives the violet styling and the Link2 icon on each field card —
   * mirrors the chip styling in record-cards.tsx. When the future "humanized
   * FK" issue lands, this flag will also gate making the value clickable
   * (navigate to the target row's detail view).
   */
  fields: { column: ColumnInfo; content: React.ReactNode; isFk: boolean }[]
  inverseRelations: { meta: InverseRelationMeta; count: number }[]
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
      >
        {stableData && (
          <>
            <SheetHeader className="border-b px-6 py-4">
              <div className="flex min-w-0 items-center gap-2">
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
              {stableData.fields.map(({ column, content, isFk }) => (
                <div
                  key={column.name}
                  className={cn(
                    "rounded-xl border bg-card p-4 shadow-sm ring-1 ring-foreground/5",
                    isFk &&
                      "border-violet-200 bg-violet-50/60 ring-violet-200/40 dark:border-violet-900 dark:bg-violet-950/30 dark:ring-violet-900/30"
                  )}
                >
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
                </div>
              ))}
              {stableData.inverseRelations.map(({ meta, count }) => (
                <InverseRelationCard
                  key={`${meta.sourceSchema}.${meta.sourceTable}.${meta.fromColumn}`}
                  meta={meta}
                  count={count}
                />
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function InverseRelationCard({ meta, count }: { meta: InverseRelationMeta; count: number }) {
  const empty = count === 0
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm ring-1 ring-foreground/5",
        !empty &&
          "border-violet-200 bg-violet-50/60 ring-violet-200/40 dark:border-violet-900 dark:bg-violet-950/30 dark:ring-violet-900/30",
        empty && "opacity-60"
      )}
    >
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
    </div>
  )
}