import { cache } from "react"
import type { Pool } from "pg"

import { introspectSchema } from "@/lib/introspect"

/**
 * Per-request cached wrapper around `introspectSchema`.
 *
 * The connection detail layout and the table view page both need the schema
 * to render. `cache()` from React deduplicates calls with the same `pool`
 * argument so only one DB round-trip happens per request.
 *
 * Cache key is the `pool` reference. `getConnectionPool(...)` returns the
 * same Pool instance for the same connectionId thanks to the pool-manager's
 * own cache, so the dedupe lines up.
 */
export const loadSchema = cache(async (pool: Pool) => introspectSchema(pool))
