import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { AccessError, assertConnectionAccess } from "@/lib/access"
import { prisma } from "@/lib/prisma"

let ownerId: string
let viewerId: string
let strangerId: string
let connectionId: string

beforeAll(async () => {
  // Three users: owner, viewer (shared with), stranger (no access).
  const owner = await prisma.user.upsert({
    where: { email: "test-access-owner@lumos.local" },
    update: {},
    create: { email: "test-access-owner@lumos.local" },
  })
  const viewer = await prisma.user.upsert({
    where: { email: "test-access-viewer@lumos.local" },
    update: {},
    create: { email: "test-access-viewer@lumos.local" },
  })
  const stranger = await prisma.user.upsert({
    where: { email: "test-access-stranger@lumos.local" },
    update: {},
    create: { email: "test-access-stranger@lumos.local" },
  })
  ownerId = owner.id
  viewerId = viewer.id
  strangerId = stranger.id

  // One connection owned by `owner`, shared with `viewer`. The encrypted
  // payload is filler — these tests never decrypt, just check access.
  const connection = await prisma.connection.create({
    data: {
      name: "Access test DB",
      encryptedConnString: "fake-ciphertext",
      iv: "fake-iv",
      authTag: "fake-authtag",
      sslEnabled: true,
      isReadOnly: true,
      userId: owner.id,
      sharedAccess: {
        create: { userId: viewer.id, sharedById: owner.id, role: "viewer" },
      },
    },
  })
  connectionId = connection.id
})

afterAll(async () => {
  // Cascade deletes: deleting the connection drops its sharedAccess rows.
  // Then drop the three users.
  await prisma.connection.deleteMany({ where: { id: connectionId } })
  await prisma.user.deleteMany({
    where: {
      id: { in: [ownerId, viewerId, strangerId] },
    },
  })
})

describe("assertConnectionAccess — default mode (owner OR viewer)", () => {
  it("grants the owner with role=owner", async () => {
    const conn = await assertConnectionAccess(connectionId, ownerId)
    expect(conn.id).toBe(connectionId)
    expect(conn.role).toBe("owner")
    expect(conn.ownerId).toBe(ownerId)
    expect(conn.encryptedConnString).toBe("fake-ciphertext")
  })

  it("grants the viewer with role=viewer", async () => {
    const conn = await assertConnectionAccess(connectionId, viewerId)
    expect(conn.role).toBe("viewer")
    expect(conn.ownerId).toBe(ownerId)
  })

  it("denies a stranger", async () => {
    await expect(assertConnectionAccess(connectionId, strangerId)).rejects.toBeInstanceOf(AccessError)
  })

  it("denies a non-existent connection (same error class)", async () => {
    await expect(assertConnectionAccess("nonexistent-id", ownerId)).rejects.toBeInstanceOf(AccessError)
  })
})

describe("assertConnectionAccess — requiredRole='owner'", () => {
  it("grants the owner", async () => {
    const conn = await assertConnectionAccess(connectionId, ownerId, "owner")
    expect(conn.role).toBe("owner")
  })

  it("denies the viewer with the same error as a stranger", async () => {
    await expect(assertConnectionAccess(connectionId, viewerId, "owner")).rejects.toBeInstanceOf(AccessError)
  })

  it("denies a stranger", async () => {
    await expect(assertConnectionAccess(connectionId, strangerId, "owner")).rejects.toBeInstanceOf(AccessError)
  })

  it("denies a non-existent connection", async () => {
    await expect(assertConnectionAccess("nonexistent-id", ownerId, "owner")).rejects.toBeInstanceOf(AccessError)
  })
})
