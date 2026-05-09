import { afterEach, beforeAll, describe, expect, it } from "vitest"

import { prisma } from "@/lib/prisma"
import {
  consumeInvitationToken,
  createInvitation,
  listInvitations,
  revokeInvitation,
  verifyInvitationToken,
} from "@/lib/invitations"

let adminId: string

beforeAll(async () => {
  // Ensure we have a user to attribute invitations to.
  const admin = await prisma.user.upsert({
    where: { email: "test-admin@lumos.local" },
    update: {},
    create: { email: "test-admin@lumos.local", role: "admin" },
  })
  adminId = admin.id
})

afterEach(async () => {
  await prisma.invitation.deleteMany({ where: { invitedById: adminId } })
})

describe("createInvitation", () => {
  it("returns a plaintext token and a row without exposing the hash", async () => {
    const { plaintextToken, invitation } = await createInvitation({ invitedById: adminId })
    expect(plaintextToken).toMatch(/^[A-Za-z0-9_-]+$/) // base64url
    expect(plaintextToken.length).toBeGreaterThanOrEqual(43) // 32 bytes → 43 chars
    expect(invitation).not.toHaveProperty("tokenHash")
    expect(invitation.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it("normalizes the email to lowercase + trim", async () => {
    const { invitation } = await createInvitation({
      invitedById: adminId,
      email: "  Foo@Bar.COM  ",
    })
    expect(invitation.email).toBe("foo@bar.com")
  })

  it("treats empty email as null", async () => {
    const { invitation } = await createInvitation({ invitedById: adminId, email: "   " })
    expect(invitation.email).toBeNull()
  })

  it("refuses when the email matches an existing user", async () => {
    const user = await prisma.user.create({
      data: { email: "exists@lumos.local" },
    })
    try {
      await expect(createInvitation({ invitedById: adminId, email: "exists@lumos.local" })).rejects.toThrow(
        /already registered/
      )
    } finally {
      await prisma.user.delete({ where: { id: user.id } })
    }
  })

  it("matches case-insensitively after normalization", async () => {
    const user = await prisma.user.create({
      data: { email: "casing@lumos.local" },
    })
    try {
      await expect(createInvitation({ invitedById: adminId, email: "  CASING@lumos.local  " })).rejects.toThrow(
        /already registered/
      )
    } finally {
      await prisma.user.delete({ where: { id: user.id } })
    }
  })

  it("refuses for disabled users too", async () => {
    const user = await prisma.user.create({
      data: { email: "disabled@lumos.local", disabledAt: new Date() },
    })
    try {
      await expect(createInvitation({ invitedById: adminId, email: "disabled@lumos.local" })).rejects.toThrow(
        /already registered/
      )
    } finally {
      await prisma.user.delete({ where: { id: user.id } })
    }
  })
})

describe("verifyInvitationToken", () => {
  it("returns the invitation for a valid token", async () => {
    const { plaintextToken, invitation } = await createInvitation({ invitedById: adminId })
    const verified = await verifyInvitationToken(plaintextToken)
    expect(verified?.id).toBe(invitation.id)
  })

  it("rejects an unknown token", async () => {
    expect(await verifyInvitationToken("not-a-real-token")).toBeNull()
  })

  it("rejects a consumed token", async () => {
    const { plaintextToken } = await createInvitation({ invitedById: adminId })
    await consumeInvitationToken(plaintextToken)
    expect(await verifyInvitationToken(plaintextToken)).toBeNull()
  })

  it("rejects an expired token", async () => {
    const { plaintextToken } = await createInvitation({
      invitedById: adminId,
      ttlDays: 1,
    })
    // Manually expire it
    const tokenHash = (await import("node:crypto")).createHash("sha256").update(plaintextToken).digest("hex")
    await prisma.invitation.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    expect(await verifyInvitationToken(plaintextToken)).toBeNull()
  })
})

describe("consumeInvitationToken", () => {
  it("marks the token consumed exactly once under concurrent calls", async () => {
    const { plaintextToken } = await createInvitation({ invitedById: adminId })
    const [a, b] = await Promise.all([consumeInvitationToken(plaintextToken), consumeInvitationToken(plaintextToken)])
    const wins = [a, b].filter(Boolean)
    expect(wins).toHaveLength(1)
  })

  it("returns null for an already-consumed token", async () => {
    const { plaintextToken } = await createInvitation({ invitedById: adminId })
    await consumeInvitationToken(plaintextToken)
    expect(await consumeInvitationToken(plaintextToken)).toBeNull()
  })
})

describe("listInvitations / revokeInvitation", () => {
  it("lists with computed status", async () => {
    await createInvitation({ invitedById: adminId, email: "a@x.com" })
    const list = await listInvitations()
    const found = list.find((inv) => inv.email === "a@x.com")
    expect(found?.status).toBe("pending")
    expect(found?.invitedByEmail).toBe("test-admin@lumos.local")
  })

  it("revokes a pending invitation", async () => {
    const { invitation } = await createInvitation({ invitedById: adminId })
    await revokeInvitation(invitation.id)
    expect(await prisma.invitation.findUnique({ where: { id: invitation.id } })).toBeNull()
  })

  it("refuses to revoke a consumed invitation", async () => {
    const { plaintextToken, invitation } = await createInvitation({ invitedById: adminId })
    await consumeInvitationToken(plaintextToken)
    await expect(revokeInvitation(invitation.id)).rejects.toThrow(/already-consumed/)
  })
})
