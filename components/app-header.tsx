"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"

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
      <div className="flex flex-row items-center">
        <Image src={"/logo.png"} alt="logo" width={50} height={50} className="" />
        <span className="font-serif text-3xl tracking-tight">Lumos</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user.name ?? user.email}</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </header>
  )
}
