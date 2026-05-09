import { headers } from "next/headers"

import { auth } from "@/lib/auth"

export type AdminSession = {
  userId: string
  email: string
}

/**
 * Server-side guard. Returns the session if the caller is an admin.
 * Throws otherwise.
 *
 * Use in Server Components (page.tsx) and Server Actions.
 * #11 will add a Next.js layout-level redirect on top of this.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    throw new Error("UNAUTHENTICATED")
  }
  if (session.user.role !== "admin") {
    throw new Error("FORBIDDEN")
  }

  return { userId: session.user.id, email: session.user.email }
}
