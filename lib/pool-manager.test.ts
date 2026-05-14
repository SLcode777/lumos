import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { __resetPoolManagerForTests, getConnectionPool, invalidateConnectionPool } from "@/lib/pool-manager"

const DEV_URL = process.env.TEST_PG_URL ?? ""

beforeEach(async () => {
  await __resetPoolManagerForTests()
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2030-01-01T00:00:00Z"))
})

afterEach(async () => {
  vi.useRealTimers()
  await __resetPoolManagerForTests()
})

describe("getConnectionPool — caching", () => {
  it("returns the same Pool instance for two consecutive calls", () => {
    const a = getConnectionPool("conn-1", DEV_URL, false)
    const b = getConnectionPool("conn-1", DEV_URL, false)
    expect(a).toBe(b)
  })

  it("returns different Pools for different connectionIds", () => {
    const a = getConnectionPool("conn-1", DEV_URL, false)
    const b = getConnectionPool("conn-2", DEV_URL, false)
    expect(a).not.toBe(b)
  })

  it("evicts and recreates after the TTL elapses", () => {
    const a = getConnectionPool("conn-1", DEV_URL, false)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    const b = getConnectionPool("conn-1", DEV_URL, false)
    expect(a).not.toBe(b)
  })

  it("recreates when config signature changes for the same id", () => {
    const a = getConnectionPool("conn-1", DEV_URL, false)
    // Same id, but flip sslEnabled — should be a fresh pool.
    const b = getConnectionPool("conn-1", DEV_URL, true)
    expect(a).not.toBe(b)
  })

  it("treats every access as fresh (lastUsedAt updates)", () => {
    const a = getConnectionPool("conn-1", DEV_URL, false)
    vi.advanceTimersByTime(4 * 60 * 1000) // 4 min
    const b = getConnectionPool("conn-1", DEV_URL, false)
    expect(b).toBe(a) // still fresh
    vi.advanceTimersByTime(4 * 60 * 1000) // total 8 min from creation, but only 4 min from last use
    const c = getConnectionPool("conn-1", DEV_URL, false)
    expect(c).toBe(a) // still fresh because lastUsedAt was bumped at the 4-min mark
  })
})

describe("invalidateConnectionPool", () => {
  it("forces the next getConnectionPool to return a fresh instance", () => {
    const a = getConnectionPool("conn-1", DEV_URL, false)
    invalidateConnectionPool("conn-1")
    const b = getConnectionPool("conn-1", DEV_URL, false)
    expect(a).not.toBe(b)
  })

  it("is a no-op for unknown ids", () => {
    expect(() => invalidateConnectionPool("never-cached")).not.toThrow()
  })
})
