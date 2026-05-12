import { Calendar, ChevronRight, Hash, Link2, ToggleLeft, Type } from "lucide-react"

import { CardContent, CardHeader } from "@/components/ui/card"
import type { FkIndex } from "@/lib/fk-index"
import type { ColumnInfo } from "@/lib/introspect"
import { cn } from "@/lib/utils"
import { Cell } from "./cell"
import { ClickableCard } from "./clickable-card"
import { stringifyForTitle } from "@/lib/cell-format"
import { FkLabels, lookupFkLabel } from "@/lib/resolve-fks"
import {
  humanizeTableName,
  inverseCountKey,
  InverseRelationMeta,
  PageInverseRelations,
  pluralizeRecord,
} from "@/lib/inverse-relations"

const VISIBLE_ITEMS = 6

type Props = Readonly<{
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  primary: ColumnInfo
  pkColumnName: string
  fkIndex: FkIndex
  fkLabels: FkLabels
  pageInverseRelations: PageInverseRelations
  rowHrefs: string[]
}>

export function RecordCards({
  columns,
  rows,
  primary,
  pkColumnName,
  fkIndex,
  fkLabels,
  pageInverseRelations,
  rowHrefs,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-center">
        <p className="text-sm text-muted-foreground">This table is empty.</p>
      </div>
    )
  }

  const otherCols = columns.filter((c) => c.name !== primary.name)

  // Items = field columns first, then inverse relations.
  // The SET of items is fixed across rows (only counts vary), so we slice once.
  // Layouts (Phase 10) will let users override this ordering.
  const totalItems = otherCols.length + pageInverseRelations.meta.length
  const visibleFieldCount = Math.min(otherCols.length, VISIBLE_ITEMS)
  const visibleInverseCount = Math.max(0, Math.min(pageInverseRelations.meta.length, VISIBLE_ITEMS - visibleFieldCount))

  const hiddenCount = totalItems - visibleFieldCount - visibleInverseCount
  const visibleCols = otherCols.slice(0, visibleFieldCount)
  const visibleInverse = pageInverseRelations.meta.slice(0, visibleInverseCount)

  return (
    <div className="flex-1 space-y-3 overflow-auto p-4">
      {rows.map((row, i) => (
        <ClickableCard
          key={i}
          href={rowHrefs[i]}
          ariaLabel={`Open detail view for ${stringifyForTitle(row[primary.name])}`}
        >
          {" "}
          <CardHeader className="mb-3 flex flex-row items-center justify-between">
            <h3 className="truncate text-base font-semibold text-foreground">{renderRaw(row[primary.name])}</h3>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {visibleCols.map((col) => (
                <FieldChip
                  key={col.name}
                  column={col}
                  value={row[col.name]}
                  fk={fkIndex.get(col.name)}
                  fkLabels={fkLabels}
                />
              ))}
              {visibleInverse.map((meta) => {
                const count = pageInverseRelations.counts.get(inverseCountKey(String(row[pkColumnName]), meta)) ?? 0
                return (
                  <InverseRelationChip
                    key={`${meta.sourceSchema}.${meta.sourceTable}.${meta.fromColumn}`}
                    meta={meta}
                    count={count}
                  />
                )
              })}
            </div>
            {hiddenCount > 0 && <p className="mt-3 text-xs text-muted-foreground">+{hiddenCount} more fields</p>}
          </CardContent>
        </ClickableCard>
      ))}
    </div>
  )
}

function FieldChip({
  column,
  value,
  fk,
  fkLabels,
}: {
  column: ColumnInfo
  value: unknown
  fk: ReturnType<FkIndex["get"]>
  fkLabels: FkLabels
}) {
  const isFk = Boolean(fk)
  const fkLabel = lookupFkLabel(fkLabels, fk, value)

  return (
    <div
      className={cn(
        "rounded-md border bg-card p-2",
        isFk && "border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/30"
      )}
    >
      <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{column.name}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <TypeIcon column={column} isFk={isFk} />
        <span className={cn("truncate text-sm", isFk && "text-violet-700 dark:text-violet-300")}>
          <Cell value={value} column={column} fkLabel={fkLabel} />
        </span>
      </div>
    </div>
  )
}

function InverseRelationChip({ meta, count }: { meta: InverseRelationMeta; count: number }) {
  const empty = count === 0
  return (
    <div
      className={cn(
        "rounded-md border bg-card p-2",
        !empty && "border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/30",
        empty && "opacity-60"
      )}
    >
      <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {humanizeTableName(meta.sourceTable)}
        {meta.ambiguous && <span className="ml-1 text-muted-foreground/70 normal-case">({meta.fromColumn})</span>}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        <Link2 className={cn("h-3 w-3 shrink-0", empty ? "text-muted-foreground" : "text-violet-500")} />
        <span className={cn("truncate text-sm", !empty && "text-violet-700 dark:text-violet-300")}>
          {pluralizeRecord(count)}
        </span>
      </div>
    </div>
  )
}

function TypeIcon({ column, isFk }: { column: ColumnInfo; isFk: boolean }) {
  const klass = cn("h-3 w-3 shrink-0", isFk ? "text-violet-500" : "text-muted-foreground")
  if (isFk) return <Link2 className={klass} />
  const t = column.dataType
  if (t.includes("int") || t.includes("numeric") || t.includes("real") || t.includes("double"))
    return <Hash className={klass} />
  if (t.includes("timestamp") || t === "date" || t === "time") return <Calendar className={klass} />
  if (t === "boolean") return <ToggleLeft className={klass} />
  return <Type className={klass} />
}

function renderRaw(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-muted-foreground italic">—</span>
  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}
