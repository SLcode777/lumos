import { describe, expect, it } from "vitest"
import { buildPanelCloseHref, buildPanelHref, parsePanelParams } from "@/lib/panel-href"

describe("parsePanelParams", () => {
  it("returns null when no panel param", () => {
    expect(parsePanelParams({})).toBeNull()
    expect(parsePanelParams({ panel: "" })).toBeNull()
    expect(parsePanelParams({ panel: ["row", "duplicate"] })).toBeNull()
  })

  it("parses row mode", () => {
    expect(parsePanelParams({ panel: "row", panelTable: "shops", panelRow: "abc-123" })).toEqual({
      mode: "row",
      panelTable: "shops",
      panelRow: "abc-123",
    })
  })

  it("returns null when row mode is missing panelRow", () => {
    expect(parsePanelParams({ panel: "row", panelTable: "shops" })).toBeNull()
  })

  it("parses related mode with all fields", () => {
    expect(
      parsePanelParams({
        panel: "related",
        panelTable: "order_items",
        panelFk: "product_id",
        panelParentPk: "497",
        panelSort: "created_at",
        panelOrder: "desc",
      })
    ).toEqual({
      mode: "related",
      panelTable: "order_items",
      panelFk: "product_id",
      panelParentPk: "497",
      panelSort: "created_at",
      panelOrder: "desc",
    })
  })

  it("ignores invalid panelOrder", () => {
    const parsed = parsePanelParams({
      panel: "related",
      panelTable: "t",
      panelFk: "fk",
      panelParentPk: "pk",
      panelOrder: "sideways",
    })
    expect(parsed).toEqual({
      mode: "related",
      panelTable: "t",
      panelFk: "fk",
      panelParentPk: "pk",
      panelSort: undefined,
      panelOrder: undefined,
    })
  })

  it("returns null for an unknown mode", () => {
    expect(parsePanelParams({ panel: "bogus", panelTable: "t" })).toBeNull()
  })
})

describe("buildPanelHref", () => {
  const base = "/dashboard/connections/X/products"
  const persistent = (entries: [string, string][]) => {
    const p = new URLSearchParams()
    for (const [k, v] of entries) p.append(k, v)
    return p
  }

  it("builds row-mode href and preserves persistent params", () => {
    const href = buildPanelHref(
      base,
      persistent([
        ["page", "2"],
        ["sort", "name"],
        ["order", "asc"],
      ]),
      { mode: "row", panelTable: "shops", panelRow: "abc-123" }
    )
    expect(href).toBe(`${base}?page=2&sort=name&order=asc&panel=row&panelTable=shops&panelRow=abc-123`)
  })

  it("strips pre-existing panel* params when rebuilding", () => {
    const params = persistent([
      ["panel", "related"],
      ["panelTable", "old"],
      ["panelFk", "x"],
      ["panelParentPk", "y"],
      ["page", "1"],
    ])
    const href = buildPanelHref(base, params, { mode: "row", panelTable: "shops", panelRow: "abc" })
    expect(href).not.toContain("panelFk")
    expect(href).not.toContain("panelParentPk")
    expect(href).toContain("panel=row")
    expect(href).toContain("panelTable=shops")
    expect(href).toContain("panelRow=abc")
    expect(href).toContain("page=1")
  })
})

describe("buildPanelCloseHref", () => {
  const base = "/x"
  it("strips all panel* and keeps persistent params", () => {
    const p = new URLSearchParams()
    p.set("page", "3")
    p.set("panel", "row")
    p.set("panelTable", "t")
    p.set("panelRow", "r")
    expect(buildPanelCloseHref(base, p)).toBe("/x?page=3")
  })

  it("returns the bare baseHref when nothing persists", () => {
    expect(buildPanelCloseHref(base, new URLSearchParams())).toBe("/x")
  })
})
