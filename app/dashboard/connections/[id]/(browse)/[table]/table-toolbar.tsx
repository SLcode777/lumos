import { Filter, Search, X } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ColumnInfo } from "@/lib/introspect"
import { SortState } from "@/lib/sort"
import { SortMenu } from "./sort-menu"
import { WhereState } from "@/lib/filter"

type Props = Readonly<{
  columns: ColumnInfo[]
  sort: SortState | null
  sortHrefs: {
    perColumn: Record<string, string>
    clear: string
    flip: string | null
  }
  where: WhereState | null
  clearWhereHref: string
}>

export function TableToolbar({ columns, sort, sortHrefs, where, clearWhereHref }: Props) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3">
      <div className="relative max-w-md flex-1">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input disabled placeholder="Search records…" className="pl-9" />
      </div>
      <Button variant="outline" size="sm" disabled>
        <Filter className="h-4 w-4" /> Filter
      </Button>
      <SortMenu columns={columns} current={sort} hrefs={sortHrefs} />
      {where && (
      <Link
      href={clearWhereHref}
      scroll={false}
      className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50/60 px-2 py-1 text-xs text-violet-700 transition hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-950/50"
      aria-label={`Clear filter on ${where.column}`}
      title="Clear filter"
      >
    <span className="font-medium">Filtered by</span>
    <span className="font-mono">{where.column} = {where.value || '""'}</span>
    <X className="h-3 w-3" aria-hidden />
  </Link>
)}
    </div>
  )
}
