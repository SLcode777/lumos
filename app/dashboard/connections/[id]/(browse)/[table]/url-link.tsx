import { ExternalLink } from "lucide-react"

import { truncate } from "@/lib/cell-format"
import { cn } from "@/lib/utils"

const MAX_TEXT_PREVIEW = 80

type Props = Readonly<{
  url: string
  mode: "compact" | "full"
}>

/**
 * Shared rendering for "this text is a URL" — used by Cell for plain URLs
 * AND by ImagePreview as the fallback when an image fails to load. No state,
 * no event handlers, so this file can be imported by both server and client
 * components without a "use client" directive.
 */
export function UrlLink({ url, mode }: Props) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      className={cn("underline-offset-2 hover:underline", mode === "full" && "break-all")}
    >
      {mode === "full" ? url : truncate(url, MAX_TEXT_PREVIEW)}
      <ExternalLink className="ml-1 inline-block h-3 w-3 align-text-bottom" aria-hidden />
    </a>
  )
}
