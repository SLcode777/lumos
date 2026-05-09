"use server"

import { redirect } from "next/navigation"

import { encrypt } from "@/lib/crypto"
import { buildConnectionStringFromFields, parseConnectionString, testConnection } from "@/lib/connections"
import { getSession } from "@/lib/get-session"
import { prisma } from "@/lib/prisma"
import { checkRateLimit } from "@/lib/rate-limit"

const MAX_NAME_LENGTH = 100
const TEST_RATE_LIMIT_PER_MIN = 10
const TEST_RATE_WINDOW_MS = 60_000

export type CreateConnectionState = {
  fieldErrors?: Partial<Record<"name" | "connectionString" | "host" | "port" | "database" | "user", string>>
  formError?: string
}

type FieldErrors = NonNullable<CreateConnectionState["fieldErrors"]>

type ResolvedConnectionString = { ok: true; connectionString: string } | { ok: false; fieldErrors: FieldErrors }

/**
 * Reads `mode`  the per-mode fields from the FormData and produces a
 * connection string. Used by createConnectionAction (for save) and
 * testConnectionAction (for the test-before-save button). NEVER logs the
 * resolved string.
 */
function resolveConnectionStringFromFormData(formData: FormData): ResolvedConnectionString {
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
 * Tries to open the connection described by the form, runs SELECT 1, returns
 * ok/ko. Does NOT save anything. Rate-limited per user.
 *
 * Returns a state shape compatible with React 19's `useActionState`. The
 * initial state in the form must be `null`.
 */
export type TestConnectionState = { ok: true } | { ok: false; error: string } | null

export async function testConnectionAction(
  _prev: TestConnectionState,
  formData: FormData
): Promise<TestConnectionState> {
  const session = await getSession()
  if (!session) {
    redirect("/signin?next=/dashboard/new")
  }

  const rate = checkRateLimit(`test-conn:${session.user.id}`, TEST_RATE_LIMIT_PER_MIN, TEST_RATE_WINDOW_MS)
  if (!rate.allowed) {
    const seconds = Math.ceil(rate.retryAfterMs / 1000)
    return {
      ok: false,
      error: `Too many test attempts — try again in ${seconds}s`,
    }
  }

  const sslEnabled = formData.get("sslEnabled") === "on"
  const resolved = resolveConnectionStringFromFormData(formData)
  if (!resolved.ok) {
    const firstError = Object.values(resolved.fieldErrors)[0] ?? "Invalid connection details"
    return { ok: false, error: firstError }
  }

  return await testConnection(resolved.connectionString, sslEnabled)
}

/**
 * Server action behind the new-connection form.
 *
 * On success: redirects to /dashboard (function does not return).
 * On failure: returns a state object the client repaints inline.
 *
 * NEVER logs the connection string (in any branch).
 */
export async function createConnectionAction(
  _prev: CreateConnectionState | null,
  formData: FormData
): Promise<CreateConnectionState> {
  const session = await getSession()
  if (!session) {
    redirect("/signin?next=/dashboard/new")
  }

  const name = ((formData.get("name") as string | null) ?? "").trim()
  const sslEnabled = formData.get("sslEnabled") === "on"
  const isReadOnly = formData.get("isReadOnly") === "on"

  const fieldErrors: FieldErrors = {}

  if (!name) {
    fieldErrors.name = "Connection name is required"
  } else if (name.length > MAX_NAME_LENGTH) {
    fieldErrors.name = `Name must be ${MAX_NAME_LENGTH} characters or fewer`
  }

  const resolved = resolveConnectionStringFromFormData(formData)
  if (!resolved.ok) {
    return { fieldErrors: { ...fieldErrors, ...resolved.fieldErrors } }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  try {
    const { ciphertext, iv, authTag } = encrypt(resolved.connectionString)
    await prisma.connection.create({
      data: {
        name,
        encryptedConnString: ciphertext,
        iv,
        authTag,
        sslEnabled,
        isReadOnly,
        userId: session.user.id,
      },
    })
  } catch (err) {
    // NEVER log connectionString — only the error class/message is safe.
    console.error("[createConnectionAction] persistence failed:", err instanceof Error ? err.message : err)
    return { formError: "Failed to save connection. Please try again." }
  }

  // Redirect throws; must NOT be inside the try/catch above (it would be
  // swallowed and turned into "Failed to save connection").
  redirect("/dashboard")
}
