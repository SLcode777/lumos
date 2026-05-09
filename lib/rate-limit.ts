type Bucket = { count: number; resetAt: number }

// Module-scoped: persists across requests within the same Node process.
// On a self-hosted single-process Lumos instance, that's all we need.
// Resets at server restart (acceptable — not a DDoS shield).
const buckets = new Map<string, Bucket>()

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number }

/**
 * Fixed-window rate limit. `key` should be sufficiently scoped (e.g.
 * `"test-conn:<userId>"`) so different action types don't share buckets.
 *
 * Returns `{ allowed: true }` if the call is under quota AND increments
 * the counter; otherwise returns the time until the window resets.
 */
export function checkRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (existing.count >= max) {
    return { allowed: false, retryAfterMs: existing.resetAt - now }
  }

  existing.count += 1
  return { allowed: true }
}

/**
 * Test-only: clear all buckets. Don't call this from app code.
 */
export function __resetRateLimitsForTests(): void {
  buckets.clear()
}
