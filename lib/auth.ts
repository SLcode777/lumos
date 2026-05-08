import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "./prisma"
import { checkRegistrationAllowed } from "./registration"

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
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
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // First-line defense against bypass attempts (e.g. OAuth callbacks
          // hitting the user-create path without going through /signup).
          // The page-level check in /signup already enforces this for
          // email/password. This hook covers any other code path.
          //
          // Note: the OAuth invitation-token plumbing (passing the token
          // through the OAuth state) is implemented in #5/#6/#12.
          const result = await checkRegistrationAllowed(undefined)
          if (!result.allowed) {
            throw new Error(`Registration not allowed (${result.reason})`)
          }

          // Count existing users. If this is the very first one, promote to admin.
          // First-signup race accepted for MVP: self-hosted instances are
          // bootstrapped by a single deployer, so concurrent first-signups
          // don't happen in practice. Tighten with pg_advisory_xact_lock if
          // the deployment model ever changes.
          const userCount = await prisma.user.count()

          if (userCount === 0) {
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
