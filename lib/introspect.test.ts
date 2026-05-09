import { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { introspectSchema, type DatabaseSchema } from "@/lib/introspect"

let pool: Pool
let schema: DatabaseSchema

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set — run via `pnpm test`")
  }
  pool = new Pool({ connectionString: process.env.DATABASE_URL })
  schema = await introspectSchema(pool)
}, 15_000)

afterAll(async () => {
  await pool.end()
})

describe("introspectSchema", () => {
  it("filters out system schemas", () => {
    for (const t of schema.tables) {
      expect(t.schema).not.toMatch(/^pg_/)
      expect(t.schema).not.toBe("information_schema")
    }
  })

  it("returns the lumos app tables", () => {
    const names = schema.tables.map((t) => t.name)
    // Better Auth lowercased the User model to "user" via @@map. Same for
    // session/account/verification.
    expect(names).toContain("user")
    expect(names).toContain("Connection")
    expect(names).toContain("ConnectionAccess")
    expect(names).toContain("Invitation")
  })

  it("detects the User primary key", () => {
    const userTable = schema.tables.find((t) => t.name === "user")
    expect(userTable?.primaryKey).toEqual(["id"])
  })

  it("detects the Connection.userId → user.id foreign key", () => {
    const fk = schema.foreignKeys.find((f) => f.fromTable === "Connection" && f.fromColumns.includes("userId"))
    expect(fk).toBeDefined()
    expect(fk?.toTable).toBe("user")
    expect(fk?.toColumns).toEqual(["id"])
  })

  it("returns columns ordered by ordinal_position", () => {
    const userTable = schema.tables.find((t) => t.name === "user")
    expect(userTable).toBeDefined()
    if (!userTable) return
    for (let i = 1; i < userTable.columns.length; i++) {
      expect(userTable.columns[i].ordinalPosition).toBeGreaterThan(userTable.columns[i - 1].ordinalPosition)
    }
  })

  it("returns row count estimates as numbers >= 0 (or -1 if missing)", () => {
    for (const t of schema.tables) {
      expect(typeof t.rowCountEstimate).toBe("number")
      expect(t.rowCountEstimate).toBeGreaterThanOrEqual(-1)
    }
  })

  it("captures column metadata: nullability, defaults, types", () => {
    const invitationTable = schema.tables.find((t) => t.name === "Invitation")
    expect(invitationTable).toBeDefined()
    if (!invitationTable) return
    const tokenHash = invitationTable.columns.find((c) => c.name === "tokenHash")
    expect(tokenHash?.dataType).toBe("text") // Prisma maps String to text
    expect(tokenHash?.isNullable).toBe(false)
  })
})
