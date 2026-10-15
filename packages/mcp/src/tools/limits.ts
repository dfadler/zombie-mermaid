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

/**
 * Wall-clock budget for one render in the worker (#1856). Renders at the caps
 * above take ~2-6 s; past this the worker is terminated and the call returns
 * an error result. A constant, not user config.
 */
export const RENDER_TIMEOUT_MS = 15_000

/** Worker V8 old-generation cap; 48 MB OOMs on legit inputs, 512 MB does not. */
export const RENDER_MAX_OLD_GENERATION_MB = 512
