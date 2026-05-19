"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"

type Props = Readonly<{
  page: number
  pageSize: number
  totalPages: number
  totalRows: number
}>

const PAGE_SIZES = [25, 50, 100] as const
const compactNumber = new Intl.NumberFormat("en", { notation: "compact" })

export function PaginationControls({ page, pageSize, totalPages, totalRows }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function buildHref(updates: Record<string, string>): string {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      sp.set(key, value)
    }
    return `${pathname}?${sp.toString()}`
  }

  function handlePageSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    // Reset to page 1 when changing page size — current page may be out of range.
    router.push(buildHref({ pageSize: e.target.value, page: "1" }))
  }

  const isFirstPage = page <= 1
  const isLastPage = page >= totalPages

  return (
    <div className="flex items-center justify-between border-t border-border p-3 text-sm">
      <div className="flex items-center gap-3">
        <label htmlFor="page-size" className="text-muted-foreground">
          Page size
        </label>
        <select
          id="page-size"
          value={pageSize}
          onChange={handlePageSizeChange}
          className="h-8 rounded border border-input bg-background px-2 text-sm"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground">{compactNumber.format(totalRows)} rows</span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={isFirstPage} asChild={!isFirstPage}>
          {isFirstPage ? <span>Previous</span> : <Link href={buildHref({ page: String(page - 1) })}>Previous</Link>}
        </Button>
        <span className="text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={isLastPage} asChild={!isLastPage}>
          {isLastPage ? <span>Next</span> : <Link href={buildHref({ page: String(page + 1) })}>Next</Link>}
        </Button>
      </div>
    </div>
  )
}
