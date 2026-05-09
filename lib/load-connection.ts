import { cache } from "react"

import { assertConnectionAccess } from "@/lib/access"

/**
 * Per-request cached wrapper around `assertConnectionAccess`.
 *
 * The `[id]/layout.tsx` and `[id]/page.tsx` both need the same connection
 * record; `cache()` from React deduplicates them so only one DB round-trip
 * happens per request.
 *
 * The cache scope is **per request only** — there's no cross-request leak.
 */
export const loadConnection = cache(async (id: string, userId: string) => {
  return await assertConnectionAccess(id, userId)
})
