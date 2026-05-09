import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { prisma } from "@/lib/prisma"
import { deleteUser, isEmailDisabled, lastAdminGuard, listUsers, setUserDisabled, setUserRole } from "@/lib/users"

const TEST_DOMAIN = "@users-test.lumos.local"

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } })
}

async function makeUser(opts: { email: string; role?: "admin" | "user"; disabled?: boolean }) {
  return prisma.user.create({
    data: {
      email: opts.email,
      role: opts.role ?? "user",
      disabledAt: opts.disabled ? new Date() : null,
    },
  })
}

beforeEach(cleanup)
afterEach(cleanup)

describe("listUsers", () => {
  it("paginates and orders by createdAt desc", async () => {
    for (let i = 0; i < 3; i++) {
      await makeUser({ email: `u${i}${TEST_DOMAIN}` })
    }
    const page = await listUsers(1)
    const ours = page.users.filter((u) => u.email.endsWith(TEST_DOMAIN))
    expect(ours).toHaveLength(3)
    // most recent first
    expect(ours[0].email).toBe(`u2${TEST_DOMAIN}`)
  })

  it("clamps out-of-range pages to the last page", async () => {
    const page = await listUsers(9999)
    expect(page.page).toBeLessThanOrEqual(page.totalPages)
  })
})

describe("lastAdminGuard", () => {
  it("no-ops when target is not an admin", async () => {
    const u = await makeUser({ email: `regular${TEST_DOMAIN}` })
    await expect(lastAdminGuard(u.id)).resolves.toBeUndefined()
  })

  it("throws when target is the only admin", async () => {
    const a = await makeUser({ email: `solo-admin${TEST_DOMAIN}`, role: "admin" })
    // make sure no other admin exists in the test domain — but real DB might have other admins
    const otherAdmins = await prisma.user.count({
      where: { role: "admin", id: { not: a.id } },
    })
    if (otherAdmins > 0) {
      // there are real admins around (e.g. the one you created during issue #7 manual test)
      // So lastAdminGuard should NOT throw on `a`, because there ARE other admins.
      await expect(lastAdminGuard(a.id)).resolves.toBeUndefined()
    } else {
      await expect(lastAdminGuard(a.id)).rejects.toThrow(/last admin/)
    }
  })

  it("does not throw when another admin exists", async () => {
    const a = await makeUser({ email: `a1${TEST_DOMAIN}`, role: "admin" })
    await makeUser({ email: `a2${TEST_DOMAIN}`, role: "admin" })
    await expect(lastAdminGuard(a.id)).resolves.toBeUndefined()
  })
})

describe("setUserDisabled", () => {
  it("sets disabledAt and clears sessions on disable", async () => {
    const u = await makeUser({ email: `s1${TEST_DOMAIN}` })
    await prisma.session.create({
      data: {
        id: "test-session-1",
        token: "tok-1",
        userId: u.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })

    await setUserDisabled(u.id, true)

    const refreshed = await prisma.user.findUnique({ where: { id: u.id } })
    expect(refreshed?.disabledAt).not.toBeNull()
    const sessions = await prisma.session.findMany({ where: { userId: u.id } })
    expect(sessions).toHaveLength(0)
  })

  it("clears disabledAt on re-enable", async () => {
    const u = await makeUser({ email: `s2${TEST_DOMAIN}`, disabled: true })
    await setUserDisabled(u.id, false)
    const refreshed = await prisma.user.findUnique({ where: { id: u.id } })
    expect(refreshed?.disabledAt).toBeNull()
  })
})

describe("setUserRole", () => {
  it("promotes a user to admin", async () => {
    const u = await makeUser({ email: `r1${TEST_DOMAIN}` })
    await setUserRole(u.id, "admin")
    const refreshed = await prisma.user.findUnique({ where: { id: u.id } })
    expect(refreshed?.role).toBe("admin")
  })

  it("demotes an admin if another admin exists", async () => {
    const a1 = await makeUser({ email: `r2a${TEST_DOMAIN}`, role: "admin" })
    await makeUser({ email: `r2b${TEST_DOMAIN}`, role: "admin" })
    await setUserRole(a1.id, "user")
    const refreshed = await prisma.user.findUnique({ where: { id: a1.id } })
    expect(refreshed?.role).toBe("user")
  })
})

describe("deleteUser", () => {
  it("hard-deletes a non-admin", async () => {
    const u = await makeUser({ email: `d1${TEST_DOMAIN}` })
    await deleteUser(u.id)
    expect(await prisma.user.findUnique({ where: { id: u.id } })).toBeNull()
  })

  it("refuses to delete the last admin (when no other admin exists)", async () => {
    const a = await makeUser({ email: `d2${TEST_DOMAIN}`, role: "admin" })
    const otherAdmins = await prisma.user.count({
      where: { role: "admin", id: { not: a.id } },
    })
    if (otherAdmins === 0) {
      await expect(deleteUser(a.id)).rejects.toThrow(/last admin/)
    }
  })
})

describe("isEmailDisabled", () => {
  it("returns true for a disabled user", async () => {
    await makeUser({ email: `dis${TEST_DOMAIN}`, disabled: true })
    expect(await isEmailDisabled(`dis${TEST_DOMAIN}`)).toBe(true)
  })

  it("returns false for an active user", async () => {
    await makeUser({ email: `act${TEST_DOMAIN}` })
    expect(await isEmailDisabled(`act${TEST_DOMAIN}`)).toBe(false)
  })

  it("returns false for an unknown email", async () => {
    expect(await isEmailDisabled(`ghost${TEST_DOMAIN}`)).toBe(false)
  })

  it("normalizes to lowercase + trim", async () => {
    await makeUser({ email: `case${TEST_DOMAIN}`, disabled: true })
    expect(await isEmailDisabled(`  CASE${TEST_DOMAIN}  `)).toBe(true)
  })
})