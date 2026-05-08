"use client"

import { useRouter } from "next/navigation"

import { signOut } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

type AppHeaderProps = {
  user: {
    email: string
    name?: string | null
  }
}

export function AppHeader({ user }: AppHeaderProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push("/signin")
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between border-b border-border p-4">
      <span className="font-serif text-xl tracking-tight">Lumos</span>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user.name ?? user.email}</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </header>
  )
}
