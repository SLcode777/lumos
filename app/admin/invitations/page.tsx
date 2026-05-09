import { redirect } from "next/navigation"

import { requireAdmin } from "@/lib/admin"
import { listInvitations } from "@/lib/invitations"

import { GenerateInvitationDialog } from "./generate-invitation-dialog"
import { InvitationsTable } from "./invitations-table"

export default async function AdminInvitationsPage() {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      redirect("/signin?next=/admin/invitations")
    }
    redirect("/")
  }

  const invitations = await listInvitations()

  return (
    <div className="container mx-auto max-w-4xl space-y-8 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Invitations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate single-use links to invite new users to this Lumos instance.
          </p>
        </div>
        <GenerateInvitationDialog />
      </header>

      <InvitationsTable invitations={invitations} />
    </div>
  )
}
