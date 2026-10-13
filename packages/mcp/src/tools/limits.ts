import type { RenderLimits } from '@zombie-mermaid/core'

/**
 * Tighter than the library defaults: an MCP render runs in the one stdio
 * server process shared by every tool call, so an out-of-memory abort kills
 * the whole session. 150 nodes / 300 edges lays out in under ~6 s (#1854).
 */
export const MCP_LIMITS: RenderLimits = {
  maxInputLength: 50_000,
  maxNodes: 150,
  maxEdges: 300,
  maxCanvasCells: 1_000_000,
}
