import { prisma } from "@/lib/prisma"
import { verifyInvitationToken } from "./invitations"

const VALID_MODES = ["open", "invite-only", "closed"] as const

export type RegistrationMode = (typeof VALID_MODES)[number]

// Validate REGISTRATION_MODE at module load time. Throws loudly if invalid,
// so a misconfigured deployment fails fast instead of behaving unpredictably.
const REGISTRATION_MODE: RegistrationMode = (() => {
  const raw = process.env.REGISTRATION_MODE ?? "invite-only"
  if (!VALID_MODES.includes(raw as RegistrationMode)) {
    throw new Error(`Invalid REGISTRATION_MODE: "${raw}". Must be one of: ${VALID_MODES.join(", ")}.`)
  }
  return raw as RegistrationMode
})()

export function getRegistrationMode(): RegistrationMode {
  return REGISTRATION_MODE
}

export type RegistrationCheckResult =
  | { allowed: true; reason: "first-user" | "open" }
  | { allowed: true; reason: "valid-token"; invitationEmail: string | null }
  | {
      allowed: false
      reason: "closed" | "invite-only-no-token" | "invite-only-invalid-token" | "invite-only-email-mismatch"
    }

/**
 * Decides whether a sign-up should be allowed right now, given the current
 * REGISTRATION_MODE and the optional invitation token from the request.
 *
 * Rules:
 *   - The very first user (count=0) can always sign up — required for instance bootstrap.
 *   - Otherwise, the result depends on REGISTRATION_MODE:
 *     - "open"        → always allowed
 *     - "closed"      → never allowed
 *     - "invite-only" → allowed only with a valid invitation token (validation lives in #10/#12)
 */
export async function checkRegistrationAllowed(token?: string, signupEmail?: string): Promise<RegistrationCheckResult> {
  // Bootstrap: the first user signing up on a fresh instance always passes.
  const userCount = await prisma.user.count()
  if (userCount === 0) {
    return { allowed: true, reason: "first-user" }
  }

  const mode = getRegistrationMode()

  if (mode === "open") {
    return { allowed: true, reason: "open" }
  }

  if (mode === "closed") {
    return { allowed: false, reason: "closed" }
  }

  // invite-only
  if (!token) {
    return { allowed: false, reason: "invite-only-no-token" }
  }

  const invitation = await verifyInvitationToken(token)
  if (!invitation) {
    return { allowed: false, reason: "invite-only-invalid-token" }
  }
  // Only enforce email lock-in when an actual sign-up email is provided
  // (i.e. at form submission via the Better Auth middleware). Page renders
  // pass `signupEmail === undefined` and only validate the token.
  if (signupEmail !== undefined && invitation.email && invitation.email !== signupEmail.trim().toLowerCase()) {
    return { allowed: false, reason: "invite-only-email-mismatch" }
  }

  return { allowed: true, reason: "valid-token", invitationEmail: invitation.email }
}
