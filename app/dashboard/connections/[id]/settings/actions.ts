"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { AccessError, assertConnectionAccess } from "@/lib/access"
import {
  resolveConnectionStringFromFormData,
  type ConnectionFormState,
  type FieldErrors,
} from "@/lib/connections"
import { encrypt } from "@/lib/crypto"
import { getSession } from "@/lib/get-session"
import { invalidateConnectionPool } from "@/lib/pool-manager"
import { prisma } from "@/lib/prisma"

const MAX_NAME_LENGTH = 100

/**
 * Updates a saved connection.
 *
 * Owner-only. Viewers (and non-members) get the same AccessError → 404 path
 * as for any other unauthorized access.
 *
 * The form always carries a full connection string (the edit page pre-fills
 * it from the decrypted blob). We validate, re-encrypt with a fresh IV
 * (encrypt() generates one per call), update the row, and invalidate the
 * cached pool so the next request rebuilds it with fresh credentials.
 *
 * On success: redirects to /dashboard (throws — must stay outside the try/catch).
 * On failure: returns a state object the client repaints inline.
 *
 * NEVER logs the connection string (in any branch).
 */
export async function updateConnectionAction(
  connectionId: string,
  _prev: ConnectionFormState | null,
  formData: FormData
): Promise<ConnectionFormState> {
  const session = await getSession()
  if (!session) {
    redirect(`/signin?next=/dashboard/connections/${connectionId}/settings`)
  }

  // Owner-only access gate. Same AccessError thrown for "doesn't exist" and
  // "you're a viewer" — no enumeration.
  try {
    await assertConnectionAccess(connectionId, session.user.id, "owner")
  } catch (err) {
    if (err instanceof AccessError) {
      // Surfaced as a form error rather than a notFound() here, because the
      // user is actively interacting with the page. notFound() would replace
      // the entire route segment with the 404 page, which is jarring.
      return { formError: "You don't have permission to edit this connection." }
    }
    throw err
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
    // Always re-encrypt with a fresh IV (encrypt() generates one per call).
    // Even when the user only renames, the cost is negligible — a new IV +
    // authTag is fine.
    const { ciphertext, iv, authTag } = encrypt(resolved.connectionString)
    await prisma.connection.update({
      where: { id: connectionId },
      data: {
        name,
        encryptedConnString: ciphertext,
        iv,
        authTag,
        sslEnabled,
        isReadOnly,
      },
    })
  } catch (err) {
    // NEVER log connectionString — only the error class/message is safe.
    console.error("[updateConnectionAction] persistence failed:", err instanceof Error ? err.message : err)
    return { formError: "Failed to save changes. Please try again." }
  }

  // Drop the cached pg.Pool so the next request rebuilds with fresh creds
  // and SSL config. Cheap, best-effort, no-op if no pool was cached.
  invalidateConnectionPool(connectionId)

  // Make sure the dashboard list and the connection layout re-fetch their
  // metadata (name shown in the header, badges, etc.).
  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/connections/${connectionId}`, "layout")

  // Redirect throws; MUST stay outside the try/catch above (it would otherwise
  // be swallowed and turned into "Failed to save changes").
  redirect("/dashboard")
}

/**
 * Hard-deletes a connection. Owner-only.
 *
 * Cascades automatically to ConnectionAccess and TableLayout via
 * `onDelete: Cascade` in the Prisma schema.
 *
 * On success: redirects to /dashboard.
 * On failure: returns { error } so the client component can surface it
 * via a toast or inline message.
 */
export type DeleteConnectionResult = { ok: true } | { ok: false; error: string }

export async function deleteConnectionAction(connectionId: string): Promise<DeleteConnectionResult> {
  const session = await getSession()
  if (!session) {
    redirect(`/signin?next=/dashboard/connections/${connectionId}/settings`)
  }

  try {
    await assertConnectionAccess(connectionId, session.user.id, "owner")
  } catch (err) {
    if (err instanceof AccessError) {
      return { ok: false, error: "You don't have permission to delete this connection." }
    }
    throw err
  }

  // Close the cached pool BEFORE deleting the row, so we don't leave a pool
  // pointing at a connectionId that no longer exists. Best-effort — if this
  // throws (which it shouldn't, since invalidateConnectionPool swallows
  // its own errors), the delete still proceeds on the next attempt.
  invalidateConnectionPool(connectionId)

  try {
    await prisma.connection.delete({ where: { id: connectionId } })
  } catch (err) {
    console.error("[deleteConnectionAction] persistence failed:", err instanceof Error ? err.message : err)
    return { ok: false, error: "Failed to delete connection. Please try again." }
  }

  revalidatePath("/dashboard")
  // Don't revalidate the [id] layout — the connection no longer exists.
  // The redirect below sends the user away from any path that would 404.

  // Note: we *return* here instead of redirecting, because the client component
  // needs to show a "deleted" toast before navigating. The navigation happens
  // client-side via router.push after the toast fires.
  return { ok: true }
}
