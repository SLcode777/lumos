import { Pool } from "pg"

const POOL_TTL_MS = 5 * 60 * 1000 // 5 minutes idle
const MAX_CLIENTS_PER_POOL = 5
const STATEMENT_TIMEOUT_MS = 30_000
const CONNECTION_TIMEOUT_MS = 5000

type CachedEntry = {
  pool: Pool
  lastUsedAt: number
  // Signature of the config used to build this pool. If the caller asks for a
  // pool with a different signature for the same connectionId, we throw away
  // the cached pool and create a fresh one — defense against stale credentials
  // when the maintainer updates a connection in the future.
  signature: string
}

const pools = new Map<string, CachedEntry>()

/**
 * Returns a `pg.Pool` for the given saved connection. Cached per `connectionId`,
 * with lazy TTL eviction (no background timer — the cache is checked on each
 * call). Calling this is cheap: `pg.Pool` does not connect at construction
 * time, only on the first `query()`.
 *
 * The decrypted connection string lives only in this function's frame and on
 * the `Pool` instance — never logged, never returned, never serialized.
 */
export function getConnectionPool(connectionId: string, connectionString: string, sslEnabled: boolean): Pool {
  const signature = makeSignature(connectionString, sslEnabled)
  const now = Date.now()
  const existing = pools.get(connectionId)

  if (existing) {
    const fresh = now - existing.lastUsedAt < POOL_TTL_MS
    if (fresh && existing.signature === signature) {
      existing.lastUsedAt = now
      return existing.pool
    }
    // Either expired or config changed: drop the old pool.
    void existing.pool.end()
    pools.delete(connectionId)
  }

  const pool = new Pool({
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    max: MAX_CLIENTS_PER_POOL,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    // Close idle clients after 30s. Pool itself stays in memory; only TCP
    // sockets are released. This is what lets us keep many cached pools
    // without holding many open DB connections.
    idleTimeoutMillis: 30_000,
  })

  pools.set(connectionId, { pool, lastUsedAt: now, signature })
  return pool
}

/**
 * Drop the cached pool for a given connection (e.g. after the user updates
 * the credentials). Best-effort `end()` on the way out.
 */
export function invalidateConnectionPool(connectionId: string): void {
  const existing = pools.get(connectionId)
  if (!existing) return
  void existing.pool.end()
  pools.delete(connectionId)
}

/**
 * Internal: cheap, non-cryptographic signature of (connectionString, sslEnabled).
 * Used to detect "config changed for the same connectionId" without storing
 * the connection string itself in the cache key. djb2.
 */
function makeSignature(connectionString: string, sslEnabled: boolean): string {
  const input = `${sslEnabled ? "1" : "0"}|${connectionString}`
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0
  }
  return hash.toString(36)
}

/**
 * Test-only: clear the cache (and end every pool). Don't call from app code.
 */
export async function __resetPoolManagerForTests(): Promise<void> {
  for (const entry of pools.values()) {
    await entry.pool.end()
  }
  pools.clear()
}
