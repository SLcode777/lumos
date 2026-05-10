"use client"

import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

type Props = Readonly<{
  href: string
  /** Used as an aria-label so screen readers know what the card does. */
  ariaLabel: string
  children: ReactNode
}>

/**
 * Wraps the card in a button-shaped clickable region without nesting <a>.
 *
 * We can't use <Link> as the wrapper: cards contain URL chips that render
 * their own <a>, and nested <a> is invalid HTML. Instead, we listen for
 * clicks on the article and skip the navigation when the click target is
 * already an interactive element (link or button) inside the card.
 */
export function ClickableCard({ href, ariaLabel, children }: Props) {
  const router = useRouter()

  const navigate = () => router.push(href, { scroll: false })

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className="cursor-pointer rounded-xl border bg-card p-4 shadow-sm ring-1 ring-foreground/5 transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={(e) => {
        // Skip navigation if the user clicked on a child <a> or <button>
        // (e.g., an external URL chip, or the future close button).
        if ((e.target as HTMLElement).closest("a, button")) return
        navigate()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          navigate()
        }
      }}
    >
      {children}
    </article>
  )
}
