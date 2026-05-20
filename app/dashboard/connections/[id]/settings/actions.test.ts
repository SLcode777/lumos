import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { encrypt } from "@/lib/crypto"
import { prisma } from "@/lib/prisma"

// Mock the auth + access modules so we don't need a full session setup.
vi.mock("@/lib/get-session", () => ({
  getSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}))
vi.mock("@/lib/access", async () => {
  const actual = await vi.importActual<typeof import("@/lib/access")>("@/lib/access")
  return {
    ...actual,
    assertConnectionAccess: vi.fn(async () => ({ id: "conn-1", role: "owner" })),
  }
})
vi.mock("@/lib/pool-manager", () => ({
  invalidateConnectionPool: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT")
  }),
}))

const { updateConnectionAction } = await import("./actions")

describe("updateConnectionAction", () => {
  beforeEach(async () => {
    // Seed a user + connection in the app DB.
    await prisma.user.upsert({
      where: { id: "user-1" },
      update: {},
      create: { id: "user-1", email: "owner@test.local" },
    })
    const { ciphertext, iv, authTag } = encrypt("postgresql://old@host/db")
    await prisma.connection.upsert({
      where: { id: "conn-1" },
      update: {
        name: "Old name",
        encryptedConnString: ciphertext,
        iv,
        authTag,
        sslEnabled: true,
        isReadOnly: true,
        userId: "user-1",
      },
      create: {
        id: "conn-1",
        name: "Old name",
        encryptedConnString: ciphertext,
        iv,
        authTag,
        sslEnabled: true,
        isReadOnly: true,
        userId: "user-1",
      },
    })
  })

  afterEach(async () => {
    await prisma.connection.deleteMany({ where: { id: "conn-1" } })
    await prisma.user.deleteMany({ where: { id: "user-1" } })
  })

  it("rejects an empty connectionString with a field error", async () => {
    const before = await prisma.connection.findUniqueOrThrow({ where: { id: "conn-1" } })

    const fd = new FormData()
    fd.set("mode", "url")
    fd.set("name", "Renamed")
    fd.set("connectionString", "")
    fd.set("sslEnabled", "off")
    fd.set("isReadOnly", "on")

    const result = await updateConnectionAction("conn-1", null, fd)
    expect(result.fieldErrors?.connectionString).toBe("Connection string is required")

    // Row unchanged — validation rejected the save before any DB write.
    const after = await prisma.connection.findUniqueOrThrow({ where: { id: "conn-1" } })
    expect(after.name).toBe(before.name)
    expect(after.encryptedConnString).toBe(before.encryptedConnString)
    expect(after.iv).toBe(before.iv)
    expect(after.authTag).toBe(before.authTag)
  })

  it("rotates the IV even when the same connectionString is re-submitted", async () => {
    const before = await prisma.connection.findUniqueOrThrow({ where: { id: "conn-1" } })

    const fd = new FormData()
    fd.set("mode", "url")
    fd.set("name", "Old name")
    fd.set("connectionString", "postgresql://old@host/db") // identical to what's saved
    fd.set("sslEnabled", "on")
    fd.set("isReadOnly", "on")

    // updateConnectionAction calls redirect() on success which throws —
    // catch it so the assertion below can run.
    await expect(updateConnectionAction("conn-1", null, fd)).rejects.toThrow("NEXT_REDIRECT")

    const after = await prisma.connection.findUniqueOrThrow({ where: { id: "conn-1" } })
    // The action always re-encrypts on save: even with the same plaintext,
    // a fresh IV must be generated (AES-GCM correctness).
    expect(after.iv).not.toBe(before.iv)
    expect(after.authTag).not.toBe(before.authTag)
    expect(after.encryptedConnString).not.toBe(before.encryptedConnString)
  })

  it("rotates the crypto blob when connectionString is non-empty", async () => {
    const before = await prisma.connection.findUniqueOrThrow({ where: { id: "conn-1" } })

    const fd = new FormData()
    fd.set("mode", "url")
    fd.set("name", "Old name")
    fd.set("connectionString", "postgresql://new@host/db")
    fd.set("sslEnabled", "on")
    fd.set("isReadOnly", "on")

    await expect(updateConnectionAction("conn-1", null, fd)).rejects.toThrow("NEXT_REDIRECT")

    const after = await prisma.connection.findUniqueOrThrow({ where: { id: "conn-1" } })
    expect(after.encryptedConnString).not.toBe(before.encryptedConnString)
    expect(after.iv).not.toBe(before.iv) // fresh IV — non-negotiable for AES-GCM
    expect(after.authTag).not.toBe(before.authTag)
  })
})
