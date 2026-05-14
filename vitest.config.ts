import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    setupFiles: ["./vitest.setup.ts"],
    environment: "node",
    // Run test files sequentially. Several suites (access, users, invitations,
    // registration) share the single SQLite app DB; running them in parallel
    // workers causes write-lock contention and intermittent Prisma timeouts.
    fileParallelism: false,
  },
})
