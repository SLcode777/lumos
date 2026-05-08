import { AppHeader } from "@/components/app-header"
import { getSession } from "@/lib/get-session"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect("/signin")
  }

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader user={session.user} />
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-serif text-4xl tracking-tight">Welcome, {session.user.name ?? session.user.email}</h1>
          <p className="text-sm text-muted-foreground">
            Your role: <code>{session.user.role ?? "unknown"}</code>
          </p>
          <p className="text-sm text-muted-foreground">This is a placeholder. The real dashboard ships in issue #13.</p>
        </div>
      </main>
    </div>
  )
}
