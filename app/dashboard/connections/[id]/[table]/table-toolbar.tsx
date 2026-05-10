import { ArrowDownUp, Filter, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function TableToolbar() {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3">
      <div className="relative max-w-md flex-1">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input disabled placeholder="Search records…" className="pl-9" />
      </div>
      <Button variant="outline" size="sm" disabled>
        <Filter className="h-4 w-4" /> Filter
      </Button>
      <Button variant="outline" size="sm" disabled>
        <ArrowDownUp className="h-4 w-4" /> Sort
      </Button>
    </div>
  )
}
