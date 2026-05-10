/**
 * Next.js instrumentation hook — runs once at server boot, before any request.
 *
 * Used here to fail-fast on misconfiguration: if ENCRYPTION_KEY is missing or
 * invalid, the server crashes at startup rather than 500-ing on the first
 * user action. The deployer sees the error in `docker compose logs app`
 * instead of a confused user reporting "I can't add a connection".
 *
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  // Skip on the edge runtime — node:crypto isn't available there and the
  // crypto module wouldn't load anyway.
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { assertCryptoConfigured } = await import("@/lib/crypto")
  assertCryptoConfigured()
}
