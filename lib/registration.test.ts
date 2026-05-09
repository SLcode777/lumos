import { afterEach, beforeAll, describe, expect, it } from "vitest"

import { prisma } from "@/lib/prisma"
import { checkRegistrationAllowed } from "@/lib/registration"
import { createInvitation } from "@/lib/invitations"

let adminId: string

beforeAll(async () => {
  const admin = await prisma.user.upsert({
    where: { email: "test-admin-reg@lumos.local" },
    update: {},
    create: { email: "test-admin-reg@lumos.local", role: "admin" },
  })
  adminId = admin.id
})

afterEach(async () => {
  await prisma.invitation.deleteMany({ where: { invitedById: adminId } })
})

describe("checkRegistrationAllowed — invitation email lock-in", () => {
  it("returns invitationEmail=null for a token without email lock", async () => {
    const { plaintextToken } = await createInvitation({ invitedById: adminId })
    const result = await checkRegistrationAllowed(plaintextToken)
    expect(result.allowed).toBe(true)
    if (result.allowed && result.reason === "valid-token") {
      expect(result.invitationEmail).toBeNull()
    } else {
      throw new Error("Expected valid-token result")
    }
  })

  it("returns invitationEmail=<email> for a nominative invitation", async () => {
    const { plaintextToken } = await createInvitation({
      invitedById: adminId,
      email: "alice@example.com",
    })
    const result = await checkRegistrationAllowed(plaintextToken)
    expect(result.allowed).toBe(true)
    if (result.allowed && result.reason === "valid-token") {
      expect(result.invitationEmail).toBe("alice@example.com")
    } else {
      throw new Error("Expected valid-token result")
    }
  })

  it("rejects with email-mismatch when sign-up email differs from invitation", async () => {
    const { plaintextToken } = await createInvitation({
      invitedById: adminId,
      email: "alice@example.com",
    })
    const result = await checkRegistrationAllowed(plaintextToken, "bob@example.com")
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toBe("invite-only-email-mismatch")
    }
  })
})
