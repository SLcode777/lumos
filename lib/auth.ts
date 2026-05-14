import { APIError, betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "./prisma"
import { checkRegistrationAllowed, getRegistrationMode } from "./registration"
import { createAuthMiddleware } from "better-auth/api"
import { isEmailDisabled } from "./users"
import { consumeInvitationToken } from "./invitations"

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh the session if older than 1 day
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false, // security: users can NOT set their own role via the sign-up payload
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const token = ctx.body?.token as string | undefined
        const email = ctx.body?.email as string | undefined
        const result = await checkRegistrationAllowed(token, email)
        if (!result.allowed) {
          throw new APIError("FORBIDDEN", {
            message: `Registration not allowed (${result.reason})`,
          })
        }
      }

      if (ctx.path === "/sign-in/email") {
        const email = ctx.body?.email as string | undefined
        if (email && (await isEmailDisabled(email))) {
          throw new APIError("FORBIDDEN", {
            message: "Invalid credentials", // security: blurred error so the user can't enum users
          })
        }
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          // Consume the invitation token atomically with user creation.
          //
          // Order of checks Better Auth runs before this hook:
          //   1. hooks.before middleware (checkRegistrationAllowed) — token validated, email matched.
          //   2. email format / password length / unique-email checks.
          //
          // So by the time we get here, all preconditions are satisfied. We
          // consume the token now: if a concurrent sign-up just consumed the
          // same token between step 1 and now, consumeInvitationToken returns
          // null and we abort — no user gets created.
          //
          // First-user bootstrap is exempt: the very first sign-up never
          // carries a token. We also skip when REGISTRATION_MODE=open, where
          // tokens are not used at all.
          const userCount = await prisma.user.count()
          const mode = getRegistrationMode()
          const isFirstUser = userCount === 0
          const requiresToken = !isFirstUser && mode === "invite-only"

          if (requiresToken) {
            const token = ctx?.body?.token as string | undefined
            if (!token) {
              // Defensive: hooks.before should have already rejected. Belt and suspenders.
              throw new APIError("FORBIDDEN", { message: "Invitation token required" })
            }
            const consumed = await consumeInvitationToken(token)
            if (!consumed) {
              throw new APIError("FORBIDDEN", {
                message: "Invitation link is invalid, expired, or has already been used",
              })
            }
          }

          // Count existing users. If this is the very first one, promote to admin.
          // First-signup race accepted for MVP: self-hosted instances are
          // bootstrapped by a single deployer, so concurrent first-signups
          // don't happen in practice. Tighten with pg_advisory_xact_lock if
          // the deployment model ever changes.

          if (isFirstUser) {
            return {
              data: {
                ...user,
                role: "admin",
              },
            }
          }

          // Otherwise, let the default ("user") apply.
          return { data: user }
        },
      },
    },
  },
})
