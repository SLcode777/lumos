"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/admin"
import { createInvitation, listInvitations, revokeInvitation, type InvitationListItem } from "@/lib/invitations"

export type GenerateInvitationResult = { ok: true; signupUrl: string; expiresAt: string } | { ok: false; error: string }

export async function generateInvitationAction(formData: FormData): Promise<GenerateInvitationResult> {
  const admin = await requireAdmin()

  const email = (formData.get("email") as string | null)?.trim() || undefined
  const ttlRaw = formData.get("ttlDays") as string | null
  const ttlDays = ttlRaw ? Number.parseInt(ttlRaw, 10) : undefined

  if (ttlDays !== undefined && (!Number.isFinite(ttlDays) || ttlDays <= 0)) {
    return { ok: false, error: "TTL must be a positive integer" }
  }

  const baseUrl = process.env.BETTER_AUTH_URL
  if (!baseUrl) {
    return { ok: false, error: "BETTER_AUTH_URL is not configured" }
  }

  try {
    const { plaintextToken, invitation } = await createInvitation({
      invitedById: admin.userId,
      email,
      ttlDays,
    })

    revalidatePath("/admin/invitations")
    return {
      ok: true,
      signupUrl: `${baseUrl}/signup?token=${plaintextToken}`,
      expiresAt: invitation.expiresAt.toISOString(),
    }
  } catch (err) {
    console.error("[generateInvitationAction]", err)
    return { ok: false, error: err instanceof Error ? err.message : "Failed to generate invitation" }
  }
}

export async function listInvitationsAction(): Promise<InvitationListItem[]> {
  await requireAdmin()
  return listInvitations()
}

export async function revokeInvitationAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const id = formData.get("id") as string | null
  if (!id) return { ok: false, error: "Missing id" }

  try {
    await revokeInvitation(id)
    revalidatePath("/admin/invitations")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to revoke" }
  }
}
