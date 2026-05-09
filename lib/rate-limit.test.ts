import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { __resetRateLimitsForTests, checkRateLimit } from "@/lib/rate-limit"

beforeEach(() => {
  __resetRateLimitsForTests()
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2030-01-01T00:00:00Z"))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("checkRateLimit", () => {
  it("allows up to `max` calls within the window", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("k", 5, 1000)).toEqual({ allowed: true })
    }
  })

  it("rejects the (max+1)th call within the window", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("k", 5, 1000)
    const result = checkRateLimit("k", 5, 1000)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it("resets after the window elapses", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("k", 5, 1000)
    vi.advanceTimersByTime(1001)
    expect(checkRateLimit("k", 5, 1000)).toEqual({ allowed: true })
  })

  it("isolates buckets per key", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("a", 5, 1000)
    expect(checkRateLimit("a", 5, 1000).allowed).toBe(false)
    expect(checkRateLimit("b", 5, 1000).allowed).toBe(true)
  })
})
