"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { AccessError } from "@/lib/access"
import { getSession } from "@/lib/get-session"
import { loadConnection } from "@/lib/load-connection"

/**
 * Forces a re-render of the connection detail layout, which re-runs
 * introspectSchema. Used by the Sidebar's Refresh button.
 *
 * Re-checks access (defense in depth) — same pattern as any mutating
 * action on a connection.
 */
export async function refreshSchemaAction(connectionId: string): Promise<void> {
  const session = await getSession()
  if (!session) redirect("/signin")

  // Don't re-throw AccessError to the client; the redirect/notFound dance is
  // handled at the route level. Here, just silently no-op if access is gone.
  try {
    await loadConnection(connectionId, session.user.id)
  } catch (err) {
    if (err instanceof AccessError) return
    throw err
  }

  revalidatePath(`/dashboard/connections/${connectionId}`, "layout")
}
