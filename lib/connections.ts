import { decrypt } from "@/lib/crypto"
import { prisma } from "@/lib/prisma"

/**
 * What the dashboard renders for each connection card. Carefully scoped:
 * NO ciphertext, NO iv, NO authTag, NO decrypted connection string. Only
 * metadata that's safe to ship to the client.
 */
export type ConnectionListItem = {
  id: string
  name: string
  host: string // extracted from connection string; "—" if parsing fails
  sslEnabled: boolean
  isReadOnly: boolean
  createdAt: Date
  // Present only on shared connections (not on owned ones).
  sharedBy: { name: string | null; email: string } | null
}

export type ConnectionsForUser = {
  owned: ConnectionListItem[]
  shared: ConnectionListItem[]
}

/**
 * Lists all connections accessible to a user, split into owned vs. shared.
 *
 * Single Prisma query with an `OR` between owned and shared, eager-loading
 * the owner's name+email to render "shared by …" badges without a second
 * round-trip.
 *
 * Decrypts each connection string ONLY to extract the host for display;
 * the decrypted string never escapes this function.
 */
export async function listConnectionsForUser(userId: string): Promise<ConnectionsForUser> {
  const rows = await prisma.connection.findMany({
    where: {
      OR: [{ userId }, { sharedAccess: { some: { userId } } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      encryptedConnString: true,
      iv: true,
      authTag: true,
      sslEnabled: true,
      isReadOnly: true,
      userId: true,
      createdAt: true,
      user: {
        select: { name: true, email: true },
      },
    },
  })

  const owned: ConnectionListItem[] = []
  const shared: ConnectionListItem[] = []

  for (const row of rows) {
    const host = safeExtractHost(row, userId)
    const item: ConnectionListItem = {
      id: row.id,
      name: row.name,
      host,
      sslEnabled: row.sslEnabled,
      isReadOnly: row.isReadOnly,
      createdAt: row.createdAt,
      sharedBy: row.userId === userId ? null : { name: row.user.name, email: row.user.email },
    }
    if (row.userId === userId) {
      owned.push(item)
    } else {
      shared.push(item)
    }
  }

  return { owned, shared }
}

/**
 * Decrypts a connection string and extracts only the hostname for display.
 * Returns "—" (and logs a warning) on any failure — a corrupted row should
 * not blow up the entire dashboard.
 */
function safeExtractHost(
  row: { id: string; encryptedConnString: string; iv: string; authTag: string },
  userId: string
): string {
  try {
    const connString = decrypt({
      ciphertext: row.encryptedConnString,
      iv: row.iv,
      authTag: row.authTag,
    })
    const url = new URL(connString)
    return url.hostname || "—"
  } catch (err) {
    // Don't leak details client-side; log enough server-side to debug.
    console.warn(
      `[connections] failed to extract host for connection ${row.id} (user ${userId}):`,
      err instanceof Error ? err.message : err
    )
    return "—"
  }
}
