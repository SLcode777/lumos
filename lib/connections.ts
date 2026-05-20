import { Client as PgClient } from "pg"

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

// ─────────────────────────────────────────────────────────────────────────────
// Connection form state types + FormData → connection string resolver.
// Pure helpers, no IO. Live here (not in a "use server" file) so they can be
// exported as sync functions and consumed by both server actions and the
// shared <ConnectionForm> component.
// ─────────────────────────────────────────────────────────────────────────────

export type ConnectionFormState = {
  fieldErrors?: Partial<Record<"name" | "connectionString" | "host" | "port" | "database" | "user", string>>
  formError?: string
}

export type FieldErrors = NonNullable<ConnectionFormState["fieldErrors"]>

export type ResolvedConnectionString =
  | { ok: true; connectionString: string }
  | { ok: false; fieldErrors: FieldErrors }

/**
 * Reads `mode` + the per-mode fields from the FormData and produces a
 * connection string. Used by createConnectionAction (for save),
 * updateConnectionAction (for rotate-credentials), and testConnectionAction
 * (for the test-before-save button). NEVER logs the resolved string.
 */
export function resolveConnectionStringFromFormData(formData: FormData): ResolvedConnectionString {
  const mode = (formData.get("mode") as string | null) ?? "url"
  const fieldErrors: FieldErrors = {}

  if (mode === "url") {
    const raw = (formData.get("connectionString") as string | null) ?? ""
    const parsed = parseConnectionString(raw)
    if (!parsed.ok) {
      fieldErrors.connectionString = parsed.error
      return { ok: false, fieldErrors }
    }
    return { ok: true, connectionString: parsed.normalizedUrl }
  }

  if (mode === "fields") {
    const host = ((formData.get("host") as string | null) ?? "").trim()
    const portRaw = ((formData.get("port") as string | null) ?? "5432").trim()
    const database = ((formData.get("database") as string | null) ?? "").trim()
    const user = ((formData.get("user") as string | null) ?? "").trim()
    const password = (formData.get("password") as string | null) ?? ""

    if (!host) fieldErrors.host = "Host is required"
    if (!database) fieldErrors.database = "Database name is required"
    if (!user) fieldErrors.user = "User is required"

    const port = Number.parseInt(portRaw, 10)
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      fieldErrors.port = "Port must be between 1 and 65535"
    }

    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, fieldErrors }
    }

    const built = buildConnectionStringFromFields({
      host,
      port,
      database,
      user,
      password: password || undefined,
    })
    const parsed = parseConnectionString(built)
    if (!parsed.ok) {
      fieldErrors.host = parsed.error
      return { ok: false, fieldErrors }
    }
    return { ok: true, connectionString: parsed.normalizedUrl }
  }

  return { ok: false, fieldErrors: { connectionString: "Invalid form mode" } }
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

// ─────────────────────────────────────────────────────────────────────────────
// testConnection — opens a one-shot pg.Client, runs SELECT 1, returns ok/ko.
// Sanitizes errors so no IPs, hostnames, usernames, or stack traces leak to
// the client. Used by #15 (test-connection action) and reusable elsewhere.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_TIMEOUT_MS = 5000
const HARD_TIMEOUT_MS = 5500

export type TestConnectionResult = { ok: true } | { ok: false; error: string }

/**
 * Tries to connect to the given Postgres URL and run `SELECT 1`. Always
 * resolves (never throws). On failure, returns a sanitized message safe to
 * show in the UI.
 *
 * NEVER logs the connection string in any branch.
 */
export async function testConnection(
  connectionString: string,
  sslEnabled: boolean
): Promise<TestConnectionResult> {
  const client = new PgClient({
    connectionString,
    connectionTimeoutMillis: TEST_TIMEOUT_MS,
    statement_timeout: TEST_TIMEOUT_MS,
    // For self-hosted DBs with self-signed certs. MITM protection is weak
    // here; a future issue can add an optional CA bundle per connection.
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  })

  try {
    await raceWithHardTimeout(
      (async () => {
        await client.connect()
        await client.query("SELECT 1")
      })(),
      HARD_TIMEOUT_MS
    )
    return { ok: true }
  } catch (err) {
    // Server-side log: error code/name only, NEVER the connection string.
    console.warn(
      "[testConnection] failed:",
      err instanceof Error ? `${err.name}/${(err as { code?: string }).code ?? "?"}: ${err.message}` : err
    )
    return { ok: false, error: sanitizeConnectionError(err) }
  } finally {
    // Best-effort cleanup. `end()` rejects if the client never connected,
    // which is fine — we ignore.
    try {
      await client.end()
    } catch {
      // ignore
    }
  }
}

function raceWithHardTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new HardTimeoutError()), ms)
    p.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

class HardTimeoutError extends Error {
  constructor() {
    super("Hard timeout")
    this.name = "HardTimeoutError"
  }
}

// SQLSTATE codes from the PostgreSQL protocol.
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_SQLSTATE_MESSAGES: Record<string, string> = {
  "28P01": "Authentication failed (wrong username or password)",
  "28000": "Authentication failed",
  "3D000": "Database does not exist",
  "08001": "Could not establish connection to the server",
  "08006": "Connection failure",
  "08004": "Server rejected the connection",
  "53300": "Server has too many connections",
  "57P03": "Server is starting up — try again in a moment",
}

// Node net/tls error codes. Avoid including err.address / err.port from the
// raw error — those leak topology.
const NODE_ERROR_MESSAGES: Record<string, string> = {
  ECONNREFUSED: "Connection refused — is the server running and reachable?",
  ENOTFOUND: "Host not found — check the hostname",
  ETIMEDOUT: "Connection timed out",
  EHOSTUNREACH: "Host unreachable",
  ENETUNREACH: "Network unreachable",
  ECONNRESET: "Connection reset by peer",
  EPIPE: "Connection closed unexpectedly",
  CERT_HAS_EXPIRED: "SSL certificate has expired",
  DEPTH_ZERO_SELF_SIGNED_CERT: "SSL certificate is self-signed",
  SELF_SIGNED_CERT_IN_CHAIN: "SSL certificate chain contains a self-signed certificate",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "Could not verify the SSL certificate",
}

function sanitizeConnectionError(err: unknown): string {
  if (err instanceof HardTimeoutError) {
    return "Connection timed out after 5 seconds"
  }
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code?: unknown }).code ?? "")
    if (code in PG_SQLSTATE_MESSAGES) return PG_SQLSTATE_MESSAGES[code]
    if (code in NODE_ERROR_MESSAGES) return NODE_ERROR_MESSAGES[code]
  }
  // Fallback: generic message, no detail. The server log has the real cause.
  return "Connection failed"
}