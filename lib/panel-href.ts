/**
 * URL state for the side panel — orthogonal to the route. The route is the
 * user's "browsing context" (which table is in the background); these params
 * describe what the panel is showing.
 *
 * `mode === "row"`     : single-row detail view (this issue).
 * `mode === "related"` : list of related records (reserved for #33).
 *
 * Always serialized via `buildPanelHref` / parsed via `parsePanelParams` so
 * the shape stays consistent across server and client.
 */
export type PanelState =
  | { mode: "row"; panelTable: string; panelRow: string }
  | {
      mode: "related"
      panelTable: string
      panelFk: string
      panelParentPk: string
      panelSort?: string
      panelOrder?: "asc" | "desc"
    }

type RawSearchParams = { [key: string]: string | string[] | undefined }

/**
 * Read & validate panel state from raw searchParams. Returns null when:
 *   - no `panel=` param
 *   - `panel=` is not one of the known modes
 *   - required complementary params are missing for the declared mode
 *
 * Callers DO NOT need to check param presence themselves — null = "no panel".
 */
export function parsePanelParams(sp: RawSearchParams): PanelState | null {
  const panel = stringOrNull(sp.panel)
  if (panel === null) return null

  const panelTable = stringOrNull(sp.panelTable)
  if (panelTable === null) return null

  if (panel === "row") {
    const panelRow = stringOrNull(sp.panelRow)
    if (panelRow === null) return null
    return { mode: "row", panelTable, panelRow }
  }

  if (panel === "related") {
    const panelFk = stringOrNull(sp.panelFk)
    const panelParentPk = stringOrNull(sp.panelParentPk)
    if (panelFk === null || panelParentPk === null) return null
    const panelSort = stringOrNull(sp.panelSort) ?? undefined
    const rawOrder = stringOrNull(sp.panelOrder)
    const panelOrder = rawOrder === "asc" || rawOrder === "desc" ? rawOrder : undefined
    return { mode: "related", panelTable, panelFk, panelParentPk, panelSort, panelOrder }
  }

  return null
}

/**
 * Build an href that toggles the panel ON in the given state, preserving the
 * caller's "persistent" params (page, pageSize, sort, order) and the route.
 *
 * Removes any pre-existing `panel*` params so the URL never accumulates stale
 * panel state — every panel open replaces whatever was there.
 */
export function buildPanelHref(baseHref: string, persistentParams: URLSearchParams, state: PanelState): string {
  const params = new URLSearchParams(persistentParams)
  clearPanelParams(params)
  params.set("panel", state.mode)
  params.set("panelTable", state.panelTable)

  if (state.mode === "row") {
    params.set("panelRow", state.panelRow)
  } else {
    params.set("panelFk", state.panelFk)
    params.set("panelParentPk", state.panelParentPk)
    if (state.panelSort) params.set("panelSort", state.panelSort)
    if (state.panelOrder) params.set("panelOrder", state.panelOrder)
  }

  return `${baseHref}?${params.toString()}`
}

/**
 * Build the close URL: route + persistent params, with every `panel*` stripped.
 * Caller passes the already-computed `persistentParams` (page, pageSize, sort).
 */
export function buildPanelCloseHref(baseHref: string, persistentParams: URLSearchParams): string {
  const params = new URLSearchParams(persistentParams)
  clearPanelParams(params)
  const qs = params.toString()
  return qs ? `${baseHref}?${qs}` : baseHref
}

// ─── Internal ───────────────────────────────────────────────────────────────

const PANEL_PARAM_NAMES = [
  "panel",
  "panelTable",
  "panelRow",
  "panelFk",
  "panelParentPk",
  "panelSort",
  "panelOrder",
] as const

function clearPanelParams(params: URLSearchParams): void {
  for (const name of PANEL_PARAM_NAMES) params.delete(name)
}

function stringOrNull(v: string | string[] | undefined): string | null {
  if (typeof v !== "string") return null
  if (v.length === 0) return null
  return v
}
