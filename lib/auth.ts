import { APIError, betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "./prisma"
import { checkRegistrationAllowed } from "./registration"
import { createAuthMiddleware } from "better-auth/api"
import { isEmailDisabled } from "./users"

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
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const token = ctx.body?.token as string | undefined
        const result = await checkRegistrationAllowed(token)
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
        before: async (user) => {
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
