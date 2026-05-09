"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useState, useTransition } from "react"
import { RefreshCw, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getTableIcon } from "@/lib/table-icon"

import { refreshSchemaAction } from "./actions"

type GroupedTable = {
  schema: string
  tables: { name: string; rowCountEstimate: number }[]
}

type Props = {
  connectionId: string
  groupedTables: GroupedTable[]
  showSchemaHeaders: boolean
}

const compactNumber = new Intl.NumberFormat("en", { notation: "compact" })

export function SidebarClient({ connectionId, groupedTables, showSchemaHeaders }: Props) {
  const [query, setQuery] = useState("")
  const [isRefreshing, startRefresh] = useTransition()
  const params = useParams<{ table?: string }>()
  const activeTable = params?.table

  const filtered = filterTables(groupedTables, query)
  const totalCount = groupedTables.reduce((sum, g) => sum + g.tables.length, 0)
  const visibleCount = filtered.reduce((sum, g) => sum + g.tables.length, 0)

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-muted/30">
      {/* Top bar: search + refresh */}
      <div className="flex items-center gap-2 border-b border-border p-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tables…"
            className="h-8 pl-7 text-sm"
            aria-label="Search tables"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={isRefreshing}
          onClick={() => {
            startRefresh(async () => {
              await refreshSchemaAction(connectionId)
            })
          }}
          aria-label="Refresh schema"
          title="Refresh schema"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Tables list */}
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            {query ? "No table matches your search." : "No tables in this database."}
          </p>
        ) : (
          <ul className="space-y-4">
            {filtered.map((group) => (
              <li key={group.schema}>
                {showSchemaHeaders ? (
                  <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.schema}
                  </p>
                ) : null}
                <ul className="space-y-0.5">
                  {group.tables.map((t) => {
                    const isActive = activeTable === t.name
                    const Icon = getTableIcon(t.name)
                    return (
                      <li key={`${group.schema}.${t.name}`}>
                        <Link
                          href={`/dashboard/connections/${connectionId}/${encodeURIComponent(t.name)}`}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm transition-colors ${
                            isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                            <span className="truncate">{t.name}</span>
                          </span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            {formatRowCount(t.rowCountEstimate)}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer count */}
      <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        {query ? `${visibleCount} of ${totalCount}` : `${totalCount} table${totalCount === 1 ? "" : "s"}`}
      </div>
    </aside>
  )
}

function filterTables(groups: GroupedTable[], query: string): GroupedTable[] {
  if (!query.trim()) return groups
  const q = query.trim().toLowerCase()
  return groups
    .map((g) => ({ ...g, tables: g.tables.filter((t) => t.name.toLowerCase().includes(q)) }))
    .filter((g) => g.tables.length > 0)
}

function formatRowCount(n: number): string {
  if (n < 0) return "—"
  return compactNumber.format(n)
}
