import { redirect } from "next/navigation"

import { requireAdmin } from "@/lib/admin"
import { listUsers } from "@/lib/users"
import { UsersTable } from "./users-tables"

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      redirect("/signin?next=/admin/users")
    }
    redirect("/")
  }

  const params = await searchParams
  const page = Number.parseInt(params.page ?? "1", 10) || 1
  const data = await listUsers(page)

  return (
    <div className="container mx-auto max-w-5xl space-y-8 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage accounts on this Lumos instance — disable, promote, or delete users.
        </p>
      </header>

      <UsersTable
        users={data.users}
        currentUserId={admin.userId}
        page={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
      />
    </div>
  )
}
