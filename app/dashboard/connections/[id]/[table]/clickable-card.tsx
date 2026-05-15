import type { ReactNode } from "react"
import Link from "next/link"

type Props = Readonly<{
  href: string
  /** Used as an aria-label so screen readers know what the card does. */
  ariaLabel: string
  children: ReactNode
}>

export function ClickableCard({ href, ariaLabel, children }: Props) {
  return (
    <article className="relative cursor-pointer rounded-xl border bg-card p-4 shadow-sm ring-1 ring-foreground/5 transition hover:shadow-md">
      <Link
        href={href}
        aria-label={ariaLabel}
        scroll={false}
        className="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <div className="pointer-events-none relative z-20 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        {children}
      </div>
    </article>
  )
}
