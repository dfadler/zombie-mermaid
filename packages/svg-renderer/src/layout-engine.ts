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
 * See packages/svg-renderer/src/layout-engine/constants.ts for the shared DEFAULTS used across stages.
 */

import type { ElkNode } from '@zombie-mermaid/core'
import type {
  MermaidGraph,
  PositionedGraph,
  FlowchartRenderOptions,
} from '@zombie-mermaid/core'
import { withoutOwnClusterEdges } from '@zombie-mermaid/core'
import { elkLayoutSync } from './elk-instance.ts'
import { resolveFontSizes } from './styles.ts'
import { DEFAULTS } from './layout-engine/constants.ts'
import {
  isStateGraph,
  mermaidToElk,
  usesMermaidElkPipeline,
} from './layout-engine/to-elk.ts'
import { elkToPositioned } from './layout-engine/from-elk.ts'
import {
  canLayOutFlat,
  layoutCompoundFlat,
} from './layout-engine/compound-flat.ts'
import type { LayoutHints } from './layout-engine/layout-hints.ts'
import { clampEdgeEnds } from './layout-engine/clamp-edge-ends.ts'
import { clearBorders } from './layout-engine/clear-borders.ts'
import { layoutSimple } from './layout-engine/simple-layout.ts'

// ============================================================================
// Public API
// ============================================================================

/**
 * Lay out a parsed MermaidGraph using ELK.js (synchronous).
 * Returns a fully positioned graph ready for rendering.
 */
export function layoutGraphSync(
  graph: MermaidGraph,
  options: FlowchartRenderOptions = {},
): PositionedGraph {
  return layoutWithHints(graph, options)
}

/** One layout run, with the hints the compound layout gives it. */
function layoutWithHints(
  graph: MermaidGraph,
  options: FlowchartRenderOptions,
  hints?: LayoutHints,
): PositionedGraph {
  const opts = {
    ...DEFAULTS,
    ...options,
    fontSizes: resolveFontSizes(options.fontSizes),
  }
  const elkGraph = mermaidToElk(graph, opts, hints)
  const result = elkLayoutSync(elkGraph, options.layoutCache)
  return elkToPositioned(result, graph, opts.mergeEdges)
}

/**
 * Lay out a flowchart, with its subgraphs arranged the way mermaid.js arranges
 * them (see `layout-engine/compound-flat.ts`). Anything that layout doesn't
 * handle, or can't make fit, is laid out by `layoutGraphSync`, so this is a
 * drop-in for it wherever the graph is a flowchart. Other diagram types that
 * share the engine (state, architecture) keep using `layoutGraphSync`.
 */
export function layoutFlowchartSync(
  rawGraph: MermaidGraph,
  options: FlowchartRenderOptions = {},
): PositionedGraph {
  const positioned = layoutFlowchartUnmarked(rawGraph, options)
  // mermaid@12.3.0 draws a flowchart subgraph with a centred title and no
  // header band, but a state composite with the band (#2636). Both share this
  // entry point, so mark the flowchart ones here, in one place, whichever
  // layout produced the groups.
  const composites = new Set<string>()
  const collect = (sgs: MermaidGraph['subgraphs']): void => {
    for (const sg of sgs) {
      if (sg.stateComposite) composites.add(sg.id)
      collect(sg.children)
    }
  }
  collect(rawGraph.subgraphs)
  const mark = (groups: PositionedGraph['groups']): void => {
    for (const g of groups) {
      if (!g.region && !composites.has(g.id)) g.bandless = true
      mark(g.children)
    }
  }
  mark(positioned.groups)
  return positioned
}

function layoutFlowchartUnmarked(
  rawGraph: MermaidGraph,
  options: FlowchartRenderOptions,
): PositionedGraph {
  // Real mermaid.js draws no line for an edge between a node and a subgraph
  // containing it (#1310), so it is not laid out or rendered here either.
  const graph = withoutOwnClusterEdges(rawGraph)
  // Opt-in built-in layout that needs no elkjs (#1685); never a fallback.
  // State diagrams share this entry point and still need ELK (see `isStateGraph`).
  if (options.layout === 'simple' && !isStateGraph(graph)) {
    return layoutSimple(graph, options)
  }
  if (
    options.layout !== undefined &&
    options.layout !== 'elk' &&
    options.layout !== 'simple'
  ) {
    throw new Error(
      `zombie-mermaid: unknown layout ${JSON.stringify(options.layout)}; use 'elk' or 'simple'.`,
    )
  }
  const laidOut = layoutGraphSync(graph, options)
  if (usesMermaidElkPipeline(graph)) {
    // ELK can run a trunk along a subgraph's side; keep it off the border.
    const groups = (
      list: PositionedGraph['groups'],
    ): PositionedGraph['groups'] =>
      list.flatMap((g) => [g, ...groups(g.children)])
    clearBorders(
      laidOut.edges,
      laidOut.nodes,
      groups(laidOut.groups),
      graph.direction,
    )
  }
  return laidOut
}

/**
 * Convert MermaidGraph to ELK format (for benchmarking conversion overhead).
 */
export function convertToElkFormat(
  graph: MermaidGraph,
  options: FlowchartRenderOptions = {},
): ElkNode {
  const opts = {
    ...DEFAULTS,
    ...options,
    fontSizes: resolveFontSizes(options.fontSizes),
  }
  return mermaidToElk(graph, opts)
}
