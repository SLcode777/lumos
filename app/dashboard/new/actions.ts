"use server"

import { redirect } from "next/navigation"

import { encrypt } from "@/lib/crypto"
import { buildConnectionStringFromFields, parseConnectionString } from "@/lib/connections"
import { getSession } from "@/lib/get-session"
import { prisma } from "@/lib/prisma"

const MAX_NAME_LENGTH = 100

export type CreateConnectionState = {
  fieldErrors?: Partial<Record<"name" | "connectionString" | "host" | "port" | "database" | "user", string>>
  formError?: string
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

  // ── 1. Read shared fields ─────────────────────────────────────────
  const name = ((formData.get("name") as string | null) ?? "").trim()
  const mode = (formData.get("mode") as string | null) ?? "url"
  const sslEnabled = formData.get("sslEnabled") === "on"
  const isReadOnly = formData.get("isReadOnly") === "on"

  const fieldErrors: NonNullable<CreateConnectionState["fieldErrors"]> = {}

  if (!name) {
    fieldErrors.name = "Connection name is required"
  } else if (name.length > MAX_NAME_LENGTH) {
    fieldErrors.name = `Name must be ${MAX_NAME_LENGTH} characters or fewer`
  }

  // ── 2. Resolve connection string per mode ─────────────────────────
  let connectionString: string | null = null

  if (mode === "url") {
    const raw = (formData.get("connectionString") as string | null) ?? ""
    const parsed = parseConnectionString(raw)
    if (!parsed.ok) {
      fieldErrors.connectionString = parsed.error
    } else {
      connectionString = parsed.normalizedUrl
    }
  } else if (mode === "fields") {
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

    if (host && database && user && Number.isFinite(port) && port >= 1 && port <= 65535) {
      const built = buildConnectionStringFromFields({
        host,
        port,
        database,
        user,
        password: password || undefined,
      })
      // Defense in depth: re-parse what we just built.
      const parsed = parseConnectionString(built)
      if (!parsed.ok) {
        fieldErrors.host = parsed.error
      } else {
        connectionString = parsed.normalizedUrl
      }
    }
  } else {
    return { formError: "Invalid form mode" }
  }

  if (Object.keys(fieldErrors).length > 0 || connectionString === null) {
    return { fieldErrors }
  }

  // ── 3. Encrypt + persist ──────────────────────────────────────────
  try {
    const { ciphertext, iv, authTag } = encrypt(connectionString)
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
