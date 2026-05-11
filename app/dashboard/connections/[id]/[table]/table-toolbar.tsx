import { Filter, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ColumnInfo } from "@/lib/introspect"
import { SortState } from "@/lib/sort"
import { SortMenu } from "./sort-menu"

type Props = Readonly<{
  columns: ColumnInfo[]
  sort: SortState | null
  sortHrefs: {
    perColumn: Record<string, string>
    clear: string
    flip: string | null
  }
}>

export function TableToolbar({ columns, sort, sortHrefs }: Props) {
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
    </div>
  )
}
