import { randomBytes } from "node:crypto"

// Provide a fresh ENCRYPTION_KEY for every test run, so tests don't depend
// on Infisical or any external secret store.
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64")
}
