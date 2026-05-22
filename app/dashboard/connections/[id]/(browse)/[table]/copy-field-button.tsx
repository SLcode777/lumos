"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = Readonly<{
  /**
   * The already-stringified clipboard payload. Computed server-side via
   * `stringifyForClipboard(rawValue)`. Parent is responsible for skipping
   * the button entirely when this would be null — by the time we get here,
   * we always have a string to copy.
   */
  value: string
  /**
   * Used only for the aria-label. Helps screen readers distinguish the copy
   * button on each chip ("Copy email value" vs "Copy shop_id value").
   */
  columnName: string
  /**
   * Optional extra classes — lets the caller bump the icon size for the
   * larger panel cards vs the smaller chips. Default sizing fits the chip.
   */
  className?: string
}>

/**
 * Tiny copy-to-clipboard button. Hidden by default (opacity-0), revealed by
 * the parent's `group-hover:opacity-100` (or always-visible on touch — see
 * the @media query below). After a successful copy, swaps to a Check icon
 * for ~1s, then reverts.
 *
 * Click handling:
 * - We DON'T stopPropagation on the click. The button sits in a
 *   `[&_button]:pointer-events-auto` zone (provided by ClickableCard at the
 *   row-card level, and replicated locally for FK-wrapping Links). The button
 *   intercepts the click naturally; the parent Link never receives it.
 * - We DO preventDefault on form submission contexts as a belt-and-suspenders,
 *   in case this button ever lands inside a <form>.
 */
export function CopyFieldButton({ value, columnName, className }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    // No stopPropagation: the pointer-events sandwich in the parent already
    // makes sure the Link doesn't fire. Calling it here would also block
    // a future "row-level keyboard shortcut" from seeing the event.
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      // Revert after ~1s. We don't worry about the component unmounting
      // mid-timeout — setState on an unmounted component is a no-op in React 19.
      window.setTimeout(() => setCopied(false), 1000)
    } catch (err) {
      // Most likely cause: insecure context (http://, not localhost) or
      // browser permission denied. Surface it in the devtools console so the
      // self-hoster can diagnose, but don't block the UI with a toast.
      console.warn("[copy-field-button] clipboard write failed:", err)
    }
  }

  const Icon = copied ? Check : Copy

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Copy ${columnName} value`}
      className={cn(
        // z-30 sits above any Link overlay (z-10) sandwiched into the parent
        // chip — otherwise the Link captures the click before the button.
        // Hidden by default; revealed on hover, or when keyboard-focused
        // (focus-visible only — :focus from a mouse click wouldn't trigger it,
        // which is what we want: after a click, mouse moves away → icon hides).
        "absolute top-1 right-1 z-30 inline-flex h-6 w-6 items-center justify-center rounded opacity-0 transition",
        "group-hover:opacity-100",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        // Touch / coarse pointer: keep the affordance visible (hover never fires).
        "[@media(hover:none)]:opacity-100",
        // Color is a single ternary rather than a base + override — avoids the
        // CSS conflict warning when two text-* classes target the same property.
        copied ? "text-emerald-600 opacity-100 dark:text-emerald-400" : "text-muted-foreground",
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  )
}
