"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Defer the icon render until we're hydrated on the client. SSR doesn't
  // know the user's resolved theme (depends on system preference / localStorage),
  // so rendering eagerly would flash the wrong icon and trigger an
  // hydration mismatch warning. This is the pattern next-themes documents.
  // The lint rule below would normally reject setState-in-effect, but the
  // alternative ("Adjusting state during render") doesn't fit a runtime
  // boundary like SSR→client.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme (Lumos)" : "Switch to dark theme (Nox)"}
      title={isDark ? "Lumos" : "Nox"}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}

export { ThemeToggle }
