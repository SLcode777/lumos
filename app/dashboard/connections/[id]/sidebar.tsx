import type { DatabaseSchema } from "@/lib/introspect"

import { SidebarClient } from "./sidebar-client"

type Props = Readonly<{
  schema: DatabaseSchema
  connectionId: string
}>

export function Sidebar({ schema, connectionId }: Props) {
  // Group tables by schema. Most DBs only use "public", in which case we
  // skip the schema headers entirely for a cleaner look.
  const grouped = groupBySchema(schema.tables)
  const showSchemaHeaders = grouped.size > 1

  return (
    <SidebarClient
      connectionId={connectionId}
      groupedTables={Array.from(grouped.entries()).map(([schemaName, tables]) => ({
        schema: schemaName,
        tables: tables.map((t) => ({
          name: t.name,
          rowCountEstimate: t.rowCountEstimate,
        })),
      }))}
      showSchemaHeaders={showSchemaHeaders}
    />
  )
}

function groupBySchema<T extends { schema: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const list = map.get(item.schema) ?? []
    list.push(item)
    map.set(item.schema, list)
  }
  return map
}
