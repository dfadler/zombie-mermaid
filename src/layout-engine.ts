/**
 * Layout engine for zombie-mermaid (ELK.js based).
 *
 * Converts MermaidGraph to ELK's JSON format, runs layout, and converts
 * the result back to PositionedGraph. This is the core layout engine used
 * by all graph-based diagram types (flowcharts, state, ER, class).
 *
 * ELK (Eclipse Layout Kernel) features:
 *   - Native orthogonal edge routing (no post-processing needed)
 *   - Proper handling of compound nodes (subgraphs)
 *   - Support for disconnected graphs
 *   - Direction overrides per subgraph
 *   - Sophisticated algorithms for complex graphs
 *
 * Uses elk.bundled.js (pure synchronous JS, no WASM/Workers).
 * Safe for Electron, Node, and browser environments.
 *
 * This file is the public entry point (layoutGraphSync, convertToElkFormat).
 * The implementation is split across src/layout-engine/ by pipeline stage:
 *   - to-elk.ts          MermaidGraph → ELK JSON input
 *   - from-elk.ts         ELK result → PositionedGraph, plus shape clipping
 *   - layer-alignment.ts  post-process: snap same-layer nodes to a uniform position
 *   - edge-bundling.ts    post-process: merge fan-out/fan-in edges into shared trunks
 * See src/layout-engine/constants.ts for the shared DEFAULTS used across stages.
 */

import type { ElkNode } from 'elkjs'
import type { MermaidGraph, PositionedGraph, RenderOptions } from './types.ts'
import { elkLayoutSync } from './elk-instance.ts'
import { resolveFontSizes } from './styles.ts'
import { DEFAULTS } from './layout-engine/constants.ts'
import { mermaidToElk } from './layout-engine/to-elk.ts'
import { elkToPositioned } from './layout-engine/from-elk.ts'

// ============================================================================
// Public API
// ============================================================================

/**
 * Lay out a parsed MermaidGraph using ELK.js (synchronous).
 * Returns a fully positioned graph ready for rendering.
 */
export function layoutGraphSync(
  graph: MermaidGraph,
  options: RenderOptions = {},
): PositionedGraph {
  const opts = {
    ...DEFAULTS,
    ...options,
    fontSizes: resolveFontSizes(options.fontSizes),
  }
  const elkGraph = mermaidToElk(graph, opts)
  const result = elkLayoutSync(elkGraph, options.layoutCache)
  return elkToPositioned(result, graph, opts.mergeEdges)
}

/**
 * Convert MermaidGraph to ELK format (for benchmarking conversion overhead).
 */
export function convertToElkFormat(
  graph: MermaidGraph,
  options: RenderOptions = {},
): ElkNode {
  const opts = {
    ...DEFAULTS,
    ...options,
    fontSizes: resolveFontSizes(options.fontSizes),
  }
  return mermaidToElk(graph, opts)
}
