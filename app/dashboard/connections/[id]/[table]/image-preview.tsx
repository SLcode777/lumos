"use client"

import { useState } from "react"

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"

type Props = Readonly<{
  url: string
  mode: "compact" | "full"
  /**
   * Pre-rendered React node used when the image fails to load (404, CORS,
   * non-image MIME type). Passed in as a prop so this client component
   * doesn't need to know how to render a plain URL — the caller (Cell)
   * supplies a `<UrlLink>` already configured for the right mode.
   */
  fallback: React.ReactNode
}>

/**
 * Lazy-loaded inline `<img>` thumbnail. Falls back to the URL rendering on
 * load error. Plain `<img>` is used (not Next/Image) because Lumos can be
 * pointed at any DB containing image URLs from any domain — domain
 * allowlisting via next.config.ts isn't viable.
 *
 * Privacy note for self-hosters: the user's browser fetches the image
 * directly from the source, sending a Referer header. See README's
 * "How it works" section.
 */
export function ImagePreview({ url, mode, fallback }: Props) {
  const [failed, setFailed] = useState(false)

  if (failed) return <>{fallback}</>

  if (mode === "full") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block">
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="max-h-64 max-w-full rounded-md border bg-card object-contain"
        />
      </a>
    )
  }

  // Compact mode: show a thumbnail; reveal a larger preview on hover.
  // openDelay kept short so the preview feels responsive without firing on
  // accidental cursor flyovers.
  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <a href={url} target="_blank" rel="noopener noreferrer" title={url} className="inline-block align-middle">
          <img
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-8 w-8 shrink-0 rounded border bg-card object-cover"
          />
        </a>
      </HoverCardTrigger>
      <HoverCardContent className="w-auto p-2">
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="max-h-80 max-w-96 rounded-2xl bg-card object-contain"
        />
      </HoverCardContent>
    </HoverCard>
  )
}
