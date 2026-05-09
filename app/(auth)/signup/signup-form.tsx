"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { signUp } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SignUpFormProps = {
  token?: string
}

export function SignUpForm({ token }: SignUpFormProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-serif text-3xl tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">Welcome to Lumos. Just an email and a password.</p>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null)
          setPending(true)

          const { error } = await signUp.email({
            email,
            password,
            name: name || email.split("@")[0],
            ...(token ? { token } : {}),
          })

          setPending(false)

          if (error) {
            setError(error.message ?? "Sign-up failed")
            return
          }

          router.push("/dashboard")
        }}
        className="flex flex-col gap-3"
      >
        <Input
          type="text"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        <Input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        <Input
          type="password"
          placeholder="Password (8+ characters)"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/signin" className="text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
