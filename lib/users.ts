import { prisma } from "@/lib/prisma"

const PAGE_SIZE = 50

export type UserListItem = {
  id: string
  email: string
  name: string | null
  role: "admin" | "user"
  disabledAt: Date | null
  createdAt: Date
}

export type UsersPage = {
  users: UserListItem[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

/**
 * Paginated list of users on this instance, most recent first.
 * `page` is 1-indexed. Out-of-range pages clamp to the last page.
 */
export async function listUsers(page = 1): Promise<UsersPage> {
  const totalCount = await prisma.user.count()
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const skip = (safePage - 1) * PAGE_SIZE

  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabledAt: true,
      createdAt: true,
    },
  })

  return {
    users: rows.map((u) => ({
      ...u,
      role: u.role === "admin" ? "admin" : "user",
    })),
    page: safePage,
    pageSize: PAGE_SIZE,
    totalCount,
    totalPages,
  }
}

/**
 * Refuses to mutate (demote, delete, disable) the last remaining admin.
 * No-op if the target is not an admin: only relevant for "admin → user"-style transitions.
 *
 * NOT race-safe under concurrent admin mutations on a multi-process instance —
 * accepted trade-off for self-hosted MVP. Tighten with a serializable txn later if needed.
 */
export async function lastAdminGuard(targetUserId: string): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { role: true },
  })
  if (!target) {
    throw new Error("User not found")
  }
  if (target.role !== "admin") {
    return // demoting / disabling / deleting a non-admin: no risk
  }

  const adminCount = await prisma.user.count({ where: { role: "admin" } })
  if (adminCount <= 1) {
    throw new Error("Cannot remove or disable the last admin of this instance")
  }
}

/**
 * Disable an account: sets disabledAt, kills all sessions immediately.
 * Refuses to disable the last admin.
 */
export async function setUserDisabled(userId: string, disabled: boolean): Promise<void> {
  if (disabled) {
    await lastAdminGuard(userId)
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { disabledAt: disabled ? new Date() : null },
    })
    if (disabled) {
      // Kick the user out of any active session right now.
      await tx.session.deleteMany({ where: { userId } })
    }
  })
}

/**
 * Promote to admin or demote to user.
 * Refuses to demote the last admin.
 */
export async function setUserRole(userId: string, newRole: "admin" | "user"): Promise<void> {
  if (newRole === "user") {
    await lastAdminGuard(userId)
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  })
}

/**
 * Hard-delete a user. Cascades to connections, shares, layouts, sessions, accounts, invitations.
 * Refuses to delete the last admin.
 */
export async function deleteUser(userId: string): Promise<void> {
  await lastAdminGuard(userId)
  await prisma.user.delete({ where: { id: userId } })
}

/**
 * Lookup helper used by the sign-in middleware to short-circuit disabled accounts.
 * Returns true if the email belongs to a disabled user; false otherwise (including unknown email).
 */
export async function isEmailDisabled(email: string): Promise<boolean> {
  if (!email) return false
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { disabledAt: true },
  })
  return user?.disabledAt !== null && user?.disabledAt !== undefined
}
