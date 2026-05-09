"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/admin"
import { deleteUser, setUserDisabled, setUserRole } from "@/lib/users"

export type UserActionResult = { ok: true } | { ok: false; error: string }

async function ensureNotSelf(
  adminUserId: string,
  targetUserId: string,
  action: string
): Promise<UserActionResult | null> {
  if (adminUserId === targetUserId) {
    return { ok: false, error: `You cannot ${action} your own account.` }
  }
  return null
}

export async function setUserDisabledAction(formData: FormData): Promise<UserActionResult> {
  const admin = await requireAdmin()
  const id = formData.get("id") as string | null
  const disabledRaw = formData.get("disabled") as string | null
  if (!id || (disabledRaw !== "true" && disabledRaw !== "false")) {
    return { ok: false, error: "Invalid input" }
  }
  const disabled = disabledRaw === "true"

  if (disabled) {
    const self = await ensureNotSelf(admin.userId, id, "disable")
    if (self) return self
  }

  try {
    await setUserDisabled(id, disabled)
    revalidatePath("/admin/users")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update user" }
  }
}

export async function setUserRoleAction(formData: FormData): Promise<UserActionResult> {
  await requireAdmin()
  const id = formData.get("id") as string | null
  const role = formData.get("role") as string | null
  if (!id || (role !== "admin" && role !== "user")) {
    return { ok: false, error: "Invalid input" }
  }

  try {
    await setUserRole(id, role)
    revalidatePath("/admin/users")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update role" }
  }
}

export async function deleteUserAction(formData: FormData): Promise<UserActionResult> {
  const admin = await requireAdmin()
  const id = formData.get("id") as string | null
  if (!id) return { ok: false, error: "Missing id" }

  const self = await ensureNotSelf(admin.userId, id, "delete")
  if (self) return self

  try {
    await deleteUser(id)
    revalidatePath("/admin/users")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to delete user" }
  }
}
