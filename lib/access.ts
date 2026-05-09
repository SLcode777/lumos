import { prisma } from "@/lib/prisma"

export type ConnectionRole = "owner" | "viewer"

/**
 * What `assertConnectionAccess` returns when access is granted.
 *
 * Includes the encrypted connection blob (ciphertext / iv / authTag) so
 * callers that need to decrypt don't have to re-query. The blob is useless
 * without `ENCRYPTION_KEY`, so returning it from a server-side helper is
 * not extra surface.
 */
export type ConnectionAccess = {
  id: string
  name: string
  ownerId: string
  encryptedConnString: string
  iv: string
  authTag: string
  sslEnabled: boolean
  isReadOnly: boolean
  createdAt: Date
  updatedAt: Date
  /** Role of the *requesting* user, computed from the row. */
  role: ConnectionRole
}

/**
 * Single error type for "connection doesn't exist" AND "you have no access
 * to it". Collapsing the two cases prevents enumeration: an attacker can't
 * tell whether the id was wrong or just out of reach.
 *
 * Map this to HTTP 404 (or Next.js `notFound()`) at the call site.
 */
export class AccessError extends Error {
  constructor() {
    super("Connection not found or access denied")
    this.name = "AccessError"
  }
}

/**
 * Verifies that `userId` is allowed to access connection `connectionId`.
 *
 * - Default: allows owner OR viewer access.
 * - With `requiredRole: "owner"`: only the owner passes.
 *
 * Throws `AccessError` if the connection doesn't exist OR the user has no
 * (sufficient) access — same error class for both, by design.
 *
 * Single Prisma round-trip in all branches.
 */
export async function assertConnectionAccess(
  connectionId: string,
  userId: string,
  requiredRole?: ConnectionRole
): Promise<ConnectionAccess> {
  // Build the access predicate as part of the query: owner-only or owner-OR-viewer.
  // Doing it in the WHERE keeps the role gate atomic with the existence check —
  // there's no window where we'd reveal "exists but you can't access" via timing.
  const where =
    requiredRole === "owner"
      ? { id: connectionId, userId }
      : {
          id: connectionId,
          OR: [
            { userId }, //                                    owner
            { sharedAccess: { some: { userId } } }, //        viewer
          ],
        }

  const row = await prisma.connection.findFirst({
    where,
    select: {
      id: true,
      name: true,
      userId: true,
      encryptedConnString: true,
      iv: true,
      authTag: true,
      sslEnabled: true,
      isReadOnly: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!row) {
    throw new AccessError()
  }

  return {
    id: row.id,
    name: row.name,
    ownerId: row.userId,
    encryptedConnString: row.encryptedConnString,
    iv: row.iv,
    authTag: row.authTag,
    sslEnabled: row.sslEnabled,
    isReadOnly: row.isReadOnly,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    role: row.userId === userId ? "owner" : "viewer",
  }
}
