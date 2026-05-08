import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 12 // 96 bits — NIST-recommended for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits

// Parse and validate ENCRYPTION_KEY at module load time. Fails fast if missing
// or malformed, so a misconfigured deployment can't silently fall back to a
// weak default.
const KEY = parseEncryptionKey(process.env.ENCRYPTION_KEY)

function parseEncryptionKey(raw: string | undefined): Buffer {
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32")
  }

  const key = Buffer.from(raw, "base64")

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH} bytes (got ${key.length}). ` +
        "Generate a fresh key with: openssl rand -base64 32"
    )
  }

  return key
}

export type EncryptedPayload = {
  ciphertext: string // base64
  iv: string // base64
  authTag: string // base64
}

/**
 * Encrypts a plaintext string using AES-256-GCM with a fresh random IV.
 * Returns the ciphertext, IV, and authentication tag as base64 strings,
 * suitable for storage in three separate database columns.
 */
export function encrypt(plaintext: string): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])

  const authTag = cipher.getAuthTag()

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  }
}

/**
 * Decrypts a payload produced by `encrypt`.
 * Throws if the data has been tampered with (authTag mismatch), if the IV
 * doesn't match what was used at encryption time, or if the wrong key is in
 * use. This is the desired behaviour — never silently return garbage.
 */
export function decrypt(payload: EncryptedPayload): string {
  const ciphertext = Buffer.from(payload.ciphertext, "base64")
  const iv = Buffer.from(payload.iv, "base64")
  const authTag = Buffer.from(payload.authTag, "base64")

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`)
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid authTag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`)
  }

  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

  return decrypted.toString("utf8")
}

/**
 * Generates a fresh AES-256 key, base64-encoded.
 * Useful for tests, scripts, or for displaying a freshly-generated key
 * to a deployer setting up a new instance.
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString("base64")
}
