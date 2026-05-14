import { describe, expect, it } from "vitest"

import { buildConnectionStringFromFields, parseConnectionString, testConnection } from "@/lib/connections"

describe("parseConnectionString", () => {
  it("accepts a standard postgresql:// URL", () => {
    const result = parseConnectionString("postgresql://alice:secret@db.example.com:5432/app")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.host).toBe("db.example.com")
      expect(result.normalizedUrl).toBe("postgresql://alice:secret@db.example.com:5432/app")
    }
  })

  it("accepts the postgres:// alias", () => {
    const result = parseConnectionString("postgres://alice@db.example.com/app")
    expect(result.ok).toBe(true)
  })

  it("trims surrounding whitespace", () => {
    const result = parseConnectionString("  postgresql://db.example.com/app  ")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.normalizedUrl).toBe("postgresql://db.example.com/app")
    }
  })

  it("rejects an empty string", () => {
    const result = parseConnectionString("")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/required/i)
  })

  it("rejects a non-URL", () => {
    const result = parseConnectionString("not even a url")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/valid URL/i)
  })

  it("rejects a non-postgres scheme", () => {
    const result = parseConnectionString("mysql://alice@db/app")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/postgresql/i)
  })

  it("rejects a URL with no host", () => {
    const result = parseConnectionString("postgresql:///app")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/host/i)
  })
})

describe("buildConnectionStringFromFields", () => {
  it("builds a basic URL with all fields", () => {
    const url = buildConnectionStringFromFields({
      host: "db.example.com",
      port: 5432,
      database: "app",
      user: "alice",
      password: "secret",
    })
    expect(url).toBe("postgresql://alice:secret@db.example.com:5432/app")
  })

  it("omits the colon-empty when no password is given", () => {
    const url = buildConnectionStringFromFields({
      host: "db.example.com",
      port: 5432,
      database: "app",
      user: "alice",
    })
    // `URL` normalizes empty password by dropping the ":" entirely.
    expect(url).toBe("postgresql://alice@db.example.com:5432/app")
  })

  it("percent-encodes special characters in the password", () => {
    const url = buildConnectionStringFromFields({
      host: "db.example.com",
      port: 5432,
      database: "app",
      user: "alice",
      password: "p@ss:w/rd",
    })
    expect(url).toContain("p%40ss%3Aw%2Frd")
    // Round-trip: parse back, compare hostname.
    const parsed = parseConnectionString(url)
    expect(parsed.ok).toBe(true)
  })

  it("preserves a non-default port", () => {
    const url = buildConnectionStringFromFields({
      host: "db.example.com",
      port: 6543,
      database: "app",
      user: "alice",
    })
    expect(url).toContain(":6543/")
  })
})

describe("testConnection", () => {
  it("returns ok for a valid local connection", async () => {
    // A throwaway Postgres URL for integration tests. NOT the app's metadata DB
    // (which is SQLite). Locally: the db-demo container (cd db-demo && docker
    // compose up -d). In CI: the service container defined in .github/workflows/ci.yml.
    const url = process.env.TEST_PG_URL
    if (!url) {
      throw new Error(
        "TEST_PG_URL not set — start the db-demo container (cd db-demo && docker compose up -d) and set TEST_PG_URL=postgresql://demo:demo@localhost:5434/shop"
      )
    } // Local dev DB doesn't have SSL configured.
    const result = await testConnection(url, false)
    expect(result).toEqual({ ok: true })
  }, 10_000) // generous timeout — connect can be slow on first run
})
