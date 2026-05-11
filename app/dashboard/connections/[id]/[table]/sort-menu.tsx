"use client"

import Link from "next/link"
import { ArrowDown, ArrowDownUp, ArrowUp, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ColumnInfo } from "@/lib/introspect"
import type { SortState } from "@/lib/sort"
import { cn } from "@/lib/utils"

type Props = Readonly<{
  columns: ColumnInfo[]
  current: SortState | null
  /**
   * Pre-built href map: for every column, an href that advances the cycle if
   * the user clicks. We build it in the server component (page.tsx) so the
   * client component stays pure-render.
   */
  hrefs: {
    /** Map<columnName, hrefThatToggles> */
    perColumn: Record<string, string>
    /** href that clears the sort entirely (used for "Clear sort"). */
    clear: string
    /** href that flips asc↔desc on the active column; null when no active sort. */
    flip: string | null
  }
}>

type DirectionArrowProps = Readonly<{ direction: "asc" | "desc"; className?: string }>

function DirectionArrow({ direction, className }: DirectionArrowProps) {
  const Icon = direction === "asc" ? ArrowUp : ArrowDown
  return <Icon className={className} aria-hidden />
}

export function SortMenu({ columns, current, hrefs }: Props) {
  let flipLabel = ""
  if (current) {
    const nextDirection = current.direction === "asc" ? "descending" : "ascending"
    flipLabel = `Switch to ${nextDirection} order`
  }
  return (
    <div className="inline-flex">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5", current && "rounded-r-none border-r-0")}
          >
            <ArrowDownUp className="h-4 w-4" />
            {current ? (
              <>
                <span>Sort:</span>
                <span className="font-medium">{current.column}</span>
              </>
            ) : (
              <span>Sort</span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[60vh] w-56 overflow-y-auto">
          <DropdownMenuLabel className="text-xs tracking-wide text-muted-foreground uppercase">
            Sort by column
          </DropdownMenuLabel>
          {columns.map((col) => {
            const isActive = current?.column === col.name
            return (
              <DropdownMenuItem key={col.name} asChild>
                <Link
                  href={hrefs.perColumn[col.name]}
                  className={cn("flex items-center justify-between gap-2", isActive && "font-medium")}
                >
                  <span className="truncate">{col.name}</span>
                  {isActive ? (
                    <DirectionArrow direction={current.direction} className="h-3.5 w-3.5 shrink-0" />
                  ) : null}
                </Link>
              </DropdownMenuItem>
            )
          })}
          {current ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={hrefs.clear} className="flex items-center gap-2 text-muted-foreground">
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Clear sort
                </Link>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {current && hrefs.flip ? (
        <Button asChild variant="outline" size="sm" className="rounded-l-none px-2">
          <Link href={hrefs.flip} aria-label={flipLabel} title={flipLabel}>
            <DirectionArrow direction={current.direction} className="h-3.5 w-3.5" />
          </Link>
        </Button>
      ) : null}
    </div>
  )
}
