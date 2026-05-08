import { describe, expect, it } from "vitest"

import { decrypt, encrypt, generateEncryptionKey } from "./crypto"

describe("encrypt / decrypt", () => {
  it("roundtrips an ASCII string", () => {
    const plaintext = "postgresql://user:pass@localhost:5432/db"
    const encrypted = encrypt(plaintext)
    expect(decrypt(encrypted)).toBe(plaintext)
  })

  it("roundtrips an empty string", () => {
    const encrypted = encrypt("")
    expect(decrypt(encrypted)).toBe("")
  })

  it("roundtrips unicode and special characters", () => {
    const plaintext = "🎉 café — naïve résumé · 漢字 · π = 3.14159"
    const encrypted = encrypt(plaintext)
    expect(decrypt(encrypted)).toBe(plaintext)
  })

  it("roundtrips a long string (10 KB)", () => {
    const plaintext = "a".repeat(10_000)
    const encrypted = encrypt(plaintext)
    expect(decrypt(encrypted)).toBe(plaintext)
  })

  it("produces a different IV on every call (non-deterministic)", () => {
    const a = encrypt("same plaintext")
    const b = encrypt("same plaintext")
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext) // different IV → different ciphertext
  })

  it("produces base64-encoded outputs of the expected sizes", () => {
    const { ciphertext, iv, authTag } = encrypt("hello")

    // base64 IV: 12 bytes → 16 chars
    expect(iv).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(Buffer.from(iv, "base64").length).toBe(12)

    // base64 authTag: 16 bytes → 24 chars
    expect(authTag).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(Buffer.from(authTag, "base64").length).toBe(16)

    // Ciphertext for "hello" (5 bytes) → 5 bytes ciphertext (GCM doesn't pad)
    expect(Buffer.from(ciphertext, "base64").length).toBe(5)
  })
})

describe("decrypt — tamper detection", () => {
  it("throws when the ciphertext has been modified", () => {
    const encrypted = encrypt("important secret")
    const tampered = {
      ...encrypted,
      ciphertext: flipFirstByte(encrypted.ciphertext),
    }
    expect(() => decrypt(tampered)).toThrow()
  })

  it("throws when the authTag has been modified", () => {
    const encrypted = encrypt("important secret")
    const tampered = {
      ...encrypted,
      authTag: flipFirstByte(encrypted.authTag),
    }
    expect(() => decrypt(tampered)).toThrow()
  })

  it("throws when the IV has been modified", () => {
    const encrypted = encrypt("important secret")
    const tampered = {
      ...encrypted,
      iv: flipFirstByte(encrypted.iv),
    }
    expect(() => decrypt(tampered)).toThrow()
  })

  it("throws when IV length is invalid", () => {
    const encrypted = encrypt("something")
    expect(() => decrypt({ ...encrypted, iv: Buffer.alloc(8).toString("base64") })).toThrow(/Invalid IV length/)
  })

  it("throws when authTag length is invalid", () => {
    const encrypted = encrypt("something")
    expect(() => decrypt({ ...encrypted, authTag: Buffer.alloc(8).toString("base64") })).toThrow(
      /Invalid authTag length/
    )
  })
})

describe("generateEncryptionKey", () => {
  it("returns a 32-byte (256-bit) base64 string", () => {
    const key = generateEncryptionKey()
    expect(Buffer.from(key, "base64").length).toBe(32)
  })

  it("returns a different key on every call", () => {
    expect(generateEncryptionKey()).not.toBe(generateEncryptionKey())
  })
})

function flipFirstByte(b64: string): string {
  const buf = Buffer.from(b64, "base64")
  buf[0] ^= 0x01 // flip a single bit
  return buf.toString("base64")
}
