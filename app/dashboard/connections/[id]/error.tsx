"use client"

import Link from "next/link"
import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function ConnectionDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[connection-detail] render error:", error)
  }, [error])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-8">
      <div className="max-w-md space-y-4 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="font-serif text-2xl tracking-tight">Couldn&apos;t load this connection</h2>
        <p className="text-sm text-muted-foreground">
          Lumos couldn&apos;t introspect this database. The server might be unreachable, the credentials might be wrong,
          or the user might lack the necessary permissions.
        </p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </div>
  )
}
