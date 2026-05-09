import { decrypt } from "@/lib/crypto"
import { prisma } from "@/lib/prisma"

// ─────────────────────────────────────────────────────────────────────────────
// Connection string parsing & building (pure helpers, no DB).
// Used by the new-connection form (#14). Will also feed the test-connection
// endpoint (#15) once it lands.
// ─────────────────────────────────────────────────────────────────────────────

export type ParsedConnectionString =
  | { ok: true; normalizedUrl: string; host: string }
  | { ok: false; error: string }

/**
 * Validates that a string looks like a usable PostgreSQL connection URL.
 * Accepts the `postgresql://` and `postgres://` schemes (both are standard).
 * Does NOT attempt to connect — that's #15's job.
 */
export function parseConnectionString(input: string): ParsedConnectionString {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, error: "Connection string is required" }
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return {
      ok: false,
      error: "Not a valid URL — expected postgresql://user:password@host:port/database",
    }
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    return {
      ok: false,
      error: `Unsupported protocol "${url.protocol.replace(":", "")}" — expected postgresql:// or postgres://`,
    }
  }

  if (!url.hostname) {
    return { ok: false, error: "Missing host in connection string" }
  }

  return { ok: true, normalizedUrl: trimmed, host: url.hostname }
}

/**
 * Builds a `postgresql://` URL from separate fields. WHATWG `URL` setters
 * percent-encode `username` and `password` automatically, so the caller can
 * pass raw values (including `@`, `:`, `/`, etc. in the password).
 */
export function buildConnectionStringFromFields(fields: {
  host: string
  port: number
  database: string
  user: string
  password?: string
}): string {
  // Start from a syntactically-valid placeholder, then override every part.
  // We don't use a template literal directly because user-controlled host/db
  // strings would skip URL's encoding pass.
  const url = new URL("postgresql://placeholder")
  url.hostname = fields.host
  url.port = String(fields.port)
  url.pathname = `/${fields.database}`
  url.username = fields.user
  url.password = fields.password ?? ""
  return url.toString()
}


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
 * the owner's nameemail to render "shared by …" badges without a second
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
