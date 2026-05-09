import { createHash, randomBytes } from "node:crypto"

import { prisma } from "@/lib/prisma"

const DEFAULT_TTL_DAYS = 7
const TOKEN_BYTES = 32

/**
 * Hash a plaintext invitation token with SHA-256.
 * No salt: the token has 256 bits of entropy, dictionary attacks are not a concern.
 */
function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex")
}

function getTtlDays(): number {
  const raw = process.env.INVITATION_TTL_DAYS
  if (!raw) return DEFAULT_TTL_DAYS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid INVITATION_TTL_DAYS: "${raw}". Must be a positive integer.`)
  }
  return parsed
}

export type CreatedInvitation = {
  /** The plaintext token. ONLY available at creation time — never persisted in clear. */
  plaintextToken: string
  /** The DB row that was just inserted. */
  invitation: {
    id: string
    email: string | null
    expiresAt: Date
    createdAt: Date
  }
}

/**
 * Create a new invitation. Returns the plaintext token (to be displayed once)
 * and the persisted row (without the hash).
 */
export async function createInvitation(params: {
  invitedById: string
  email?: string
  ttlDays?: number
}): Promise<CreatedInvitation> {
    const normalizedEmail = params.email?.trim().toLocaleLowerCase() || null

    // Check if email is already registered
    if (normalizedEmail) {
      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      })
      if (existing) {
        throw new Error("A user with this email is already registered.")
      }
    }

  const plaintextToken = randomBytes(TOKEN_BYTES).toString("base64url")
  const tokenHash = hashToken(plaintextToken)

  const ttlDays = params.ttlDays ?? getTtlDays()
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)

  const invitation = await prisma.invitation.create({
    data: {
      tokenHash,
      email: normalizedEmail,
      invitedById: params.invitedById,
      expiresAt,
    },
    select: { id: true, email: true, expiresAt: true, createdAt: true },
  })

  return { plaintextToken, invitation }
}

export type VerifiedInvitation = {
  id: string
  email: string | null
  expiresAt: Date
}

/**
 * Read-only check that a plaintext token corresponds to a valid, unconsumed,
 * unexpired invitation. Does NOT consume the token.
 *
 * Used by `lib/registration.ts` for the invite-only registration gate, and by
 * `/signup?token=...` (#12) to decide whether to render the form.
 */
export async function verifyInvitationToken(plaintextToken: string): Promise<VerifiedInvitation | null> {
  if (!plaintextToken) return null

  const tokenHash = hashToken(plaintextToken)
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    select: { id: true, email: true, expiresAt: true, consumedAt: true },
  })

  if (!invitation) return null
  if (invitation.consumedAt !== null) return null
  if (invitation.expiresAt <= new Date()) return null

  return {
    id: invitation.id,
    email: invitation.email,
    expiresAt: invitation.expiresAt,
  }
}

/**
 * Atomically consume a plaintext token. Returns the invitation if it was
 * still valid and just got marked consumed; null otherwise.
 *
 * Race-safe: if two requests try to consume the same token concurrently,
 * exactly one will get the row back, the other will get null.
 *
 * Wired into the signup transaction in #12.
 */
export async function consumeInvitationToken(plaintextToken: string): Promise<VerifiedInvitation | null> {
  if (!plaintextToken) return null

  const tokenHash = hashToken(plaintextToken)

  // updateMany lets us add the "consumedAt is null" guard atomically.
  // It returns count=1 if we got the row, count=0 otherwise.
  const result = await prisma.invitation.updateMany({
    where: {
      tokenHash,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  })

  if (result.count === 0) return null

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    select: { id: true, email: true, expiresAt: true },
  })
  return invitation
}

export type InvitationStatus = "pending" | "consumed" | "expired"

export type InvitationListItem = {
  id: string
  email: string | null
  createdAt: Date
  expiresAt: Date
  consumedAt: Date | null
  status: InvitationStatus
  invitedByEmail: string
}

function statusOf(row: { consumedAt: Date | null; expiresAt: Date }): InvitationStatus {
  if (row.consumedAt !== null) return "consumed"
  if (row.expiresAt <= new Date()) return "expired"
  return "pending"
}

/**
 * List invitations on this instance, most recent first.
 * Pending ones first, then consumed/expired.
 */
export async function listInvitations(): Promise<InvitationListItem[]> {
  const rows = await prisma.invitation.findMany({
    orderBy: [{ consumedAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      createdAt: true,
      expiresAt: true,
      consumedAt: true,
      invitedBy: { select: { email: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt,
    status: statusOf(row),
    invitedByEmail: row.invitedBy.email,
  }))
}

/**
 * Hard-delete a pending invitation. Refuses to revoke a consumed one
 * (audit trail must be preserved per PRD §6).
 */
export async function revokeInvitation(id: string): Promise<void> {
  const invitation = await prisma.invitation.findUnique({
    where: { id },
    select: { consumedAt: true },
  })
  if (!invitation) {
    throw new Error("Invitation not found")
  }
  if (invitation.consumedAt !== null) {
    throw new Error("Cannot revoke an already-consumed invitation")
  }
  await prisma.invitation.delete({ where: { id } })
}
