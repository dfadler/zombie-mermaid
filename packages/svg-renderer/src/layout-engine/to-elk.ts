/**
 * Graph conversion: MermaidGraph → ELK JSON.
 *
 * Split out of layout-engine.ts. This module only handles building ELK's
 * nested JSON input format from a parsed MermaidGraph — the reverse
 * direction (ELK result → PositionedGraph) lives in ./from-elk.ts.
 */

import type {
  ElkNode,
  ElkExtendedEdge,
  LayoutOptions,
} from '@zombie-mermaid/core'
import type {
  MermaidGraph,
  MermaidSubgraph,
  MermaidEdge,
  RenderOptions,
} from '@zombie-mermaid/core'
import { TILE } from '../architecture-icons.ts'
import type { FontSizes } from '../styles.ts'
import {
  ASYMMETRIC_NOTCH,
  FONT_WEIGHTS,
  GROUP_HEADER_CONTENT_PAD,
  NODE_PADDING,
} from '../styles.ts'
import {
  measureMultilineText,
  subgraphDirectionIsHonored,
} from '@zombie-mermaid/core'
import { DEFAULTS } from './constants.ts'
import {
  findBackEdgeIndexes,
  subgraphFeedbackEdges,
} from '@zombie-mermaid/core'
import {
  ELK_DIRECTION_FALLBACK,
  INLINE_CENTERED_EDGE_LABEL,
  baseElkLayoutOptions,
  buildElkEdge,
  buildElkLeafNode,
  directionToElk as sharedDirectionToElk,
  type ElkDirection,
  type ElkEdgeLabelStyle,
  type ElkPaddingSides,
} from './elk-graph-builder.ts'

/**
 * ELK layer constraint for a top-level `[*]` marker: the start marker is
 * pinned to the first layer so a back-edge can't drag it into the middle
 * (#1240). The end marker is deliberately left unconstrained: it settles in
 * the layer right after the state(s) that transition into it, instead of a
 * layer of its own after every other node (`LAST_SEPARATE`), which drew
 * `Closed --> [*]` as a long line down the page edge when `Closed` is near
 * the top. Keyed by node shape.
 */
const STATE_MARKER_LAYER_CONSTRAINT: Partial<Record<string, string>> = {
  'state-start': 'FIRST',
}

/**
 * Root-graph ELK options applied to state diagrams only (flowcharts keep
 * their tuned defaults).
 *
 * Flowcharts deliberately do not get `MODEL_ORDER` cycle breaking (#1307).
 * They already break cycles the way mermaid.js does, by reversing the
 * depth-first back edges before ELK runs (`edgesReversedForLayout`), so ELK
 * has no cycle left to break; adding `MODEL_ORDER` on top only moved nodes
 * away from mermaid.js. Measured against mermaid 11.17.2 (relative placement
 * of every node pair, `scripts/layout-oracle.ts` style): applied to every
 * flowchart it changed 5 of the 26 gallery samples and 49 of 104 doc/test
 * flowcharts, closer for 0 and 2, further for 4 and 41; applied only to
 * graphs with a subgraph direction override (the one case where the
 * pre-reversal is skipped) it changed 1 and 7, closer for 0 and 2, further
 * for 1 and 5.
 *
 * - `cycleBreaking: MODEL_ORDER` reverses the edge that points *against*
 *   declaration order instead of whichever edge ELK's greedy heuristic picks.
 *   The greedy default reversed the main chain of `[*] --> Idle`,
 *   `Idle --> Active`, `Active --> Idle`, drawing it bottom-to-top with the
 *   start marker beside a state.
 * - `postCompaction: NONE`: LEFT_RIGHT_CONSTRAINT_LOCKING compaction slides
 *   nodes sideways after edges are routed, which leaves state edges ending
 *   in a horizontal run along the target's top border (arrowhead sideways).
 */
const STATE_LAYOUT_OPTIONS: LayoutOptions = {
  'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
  'elk.layered.compaction.postCompaction.strategy': 'NONE',
}

/**
 * Whether `graph` is a `stateDiagram` (it has `[*]` markers, the only thing
 * that distinguishes a state graph from a flowchart here). Composite states
 * are included: their compound nodes are placed among their siblings at
 * first-mention position (see `firstMentionRank`), so `MODEL_ORDER` reads
 * them in source order instead of after every leaf (#1287).
 */
export function isStateGraph(graph: MermaidGraph): boolean {
  for (const node of graph.nodes.values()) {
    if (node.shape === 'state-start' || node.shape === 'state-end') return true
  }
  return false
}

/**
 * Room a subgraph's box leaves around its contents, in px. The top is the
 * title bar (28) plus a gap (16) to match the bottom. Shared with the compound
 * layout, which draws the boxes itself.
 */
/** mermaid@12.3.0 state diagrams: 40px between ranks, 24px inside a composite, 24px side/bottom padding and 25px below the 26px title band. */
export const STATE_LAYER_SPACING = 40
export const STATE_COMPOSITE_LAYER_SPACING = 24
export const STATE_COMPOSITE_PADDING = {
  top: 51,
  left: 24,
  bottom: 24,
  right: 24,
}

/**
 * mermaid@12.3.0 subgraph: 24px on every side, plus the title strip on top
 * (24px label + 3px) so the title never overlaps the first node.
 */
export const MERMAID_SUBGRAPH_PADDING = {
  top: 51,
  left: 24,
  bottom: 24,
  right: 24,
}

export const SUBGRAPH_PADDING = { top: 44, left: 16, bottom: 16, right: 16 }

/** Padding for an untitled concurrency region (no header band). */
export const REGION_PADDING = { top: 24, left: 24, bottom: 24, right: 24 }

/**
 * Whether three or more labelled edges join the same source and target. With
 * the 12px edge spacing the target sat under the source; mermaid 12.1.0 and
 * 12.2.0 offset it by about 25px. Raising `elk.spacing.edgeEdge` to 40px
 * spreads the parallel runs enough to match (Five Cluster Exit Siblings, #1943;
 * measured on every flowchart sample, 36px is marginal and 30px has no effect).
 * Only for these graphs: at 40px on every graph it pushed edge runs onto
 * subgraph borders (CJK Labels, System Architecture).
 */
function hasLabelledParallelRun(graph: MermaidGraph): boolean {
  const counts = new Map<string, number>()
  for (const e of graph.edges) {
    if (!e.label) continue
    const key = `${e.source}\0${e.target}`
    const n = (counts.get(key) ?? 0) + 1
    if (n >= 3) return true
    counts.set(key, n)
  }
  return false
}

/** Subgraph-free graphs the ASCII layout provider lays out; see `keepLegacyPipeline`. */
const legacyPipelineGraphs = new WeakSet<MermaidGraph>()

/**
 * Keep a subgraph-free flowchart on the settings from before #2672 so the
 * ASCII hints taken from its layout do not move (ASCII follows in #2933).
 */
export function keepLegacyPipeline(graph: MermaidGraph): void {
  legacyPipelineGraphs.add(graph)
}

/**
 * Flowcharts are laid out the way mermaid@12.3.0 does it: one ELK pass over
 * the whole hierarchy (`INCLUDE_CHILDREN`) with ELK's own `DEPTH_FIRST` cycle
 * breaking. State diagrams keep the settings tuned for them.
 */
export function usesMermaidElkPipeline(graph: MermaidGraph): boolean {
  return (
    !isStateGraph(graph) &&
    (graph.subgraphs.length > 0 || !legacyPipelineGraphs.has(graph))
  )
}

/** The spacing mermaid@12.3.0 gives ELK for every subgraph. */
const MERMAID_SUBGRAPH_SPACING: LayoutOptions = {
  'spacing.baseValue': '24',
  'elk.spacing.nodeNode': '50',
  'elk.layered.spacing.edgeNodeBetweenLayers': '30',
  'elk.spacing.edgeEdge': '20',
}

/**
 * Spacing mermaid@12.3.0 gives ELK, replacing the fork's explicit values when
 * the caller left `nodeSpacing`/`layerSpacing` at their defaults: the root sets
 * only `spacing.baseValue` (ELK derives node, layer and edge gaps from it);
 * a subgraph sets its own base value plus three gaps.
 */
function mermaidSpacing(
  graph: MermaidGraph,
  opts: { nodeSpacing: number; layerSpacing: number },
  level: 'root' | 'subgraph',
): LayoutOptions | undefined {
  if (
    !usesMermaidElkPipeline(graph) ||
    opts.nodeSpacing !== DEFAULTS.nodeSpacing ||
    opts.layerSpacing !== DEFAULTS.layerSpacing
  ) {
    return undefined
  }
  return level === 'root'
    ? { 'spacing.baseValue': '40' }
    : MERMAID_SUBGRAPH_SPACING
}

/** Layout option keys that `mermaidSpacing` replaces. */
const FORK_SPACING_KEYS = [
  'elk.spacing.nodeNode',
  'elk.layered.spacing.nodeNodeBetweenLayers',
  'elk.spacing.edgeEdge',
  'elk.layered.spacing.edgeEdgeBetweenLayers',
  'elk.layered.spacing.edgeNodeBetweenLayers',
  'elk.contentAlignment',
]

function withMermaidSpacing(
  options: LayoutOptions,
  spacing: LayoutOptions | undefined,
): LayoutOptions {
  if (!spacing) return options
  const out = { ...options }
  for (const key of FORK_SPACING_KEYS) delete out[key]
  return { ...out, ...spacing }
}

/**
 * Edge order mermaid@12.3.0 hands ELK (`orderNestedEdgeEnds`): an edge whose
 * end lies inside the node an earlier edge shares with it moves in front of
 * that edge. Returns indices into `graph.edges`.
 */
function mermaidEdgeOrder(graph: MermaidGraph): number[] {
  const parent = new Map<string, string>()
  const walk = (subgraphs: MermaidSubgraph[], up?: string): void => {
    for (const sg of subgraphs) {
      if (up) parent.set(sg.id, up)
      for (const id of sg.nodeIds) parent.set(id, sg.id)
      walk(sg.children, sg.id)
    }
  }
  walk(graph.subgraphs)
  const inside = (id: string, ancestor: string): boolean => {
    for (let c = parent.get(id); c !== undefined; c = parent.get(c)) {
      if (c === ancestor) return true
    }
    return false
  }
  const edges = graph.edges
  const order = edges.map((_, i) => i)
  edges.forEach(({ source, target }, index) => {
    const from = order.indexOf(index)
    const to = order.findIndex((o, pos) => {
      const e = edges[o]!
      return (
        pos < from &&
        ((e.target === target && inside(source, e.source)) ||
          (e.source === source && inside(target, e.target)))
      )
    })
    if (to !== -1) {
      order.splice(from, 1)
      order.splice(to, 0, index)
    }
  })
  return order
}

const PORTS_SURROUNDING = '[top=12,left=12,bottom=12,right=12]'

const reversedCache = new WeakMap<MermaidGraph, Set<number>>()

/**
 * Indices of the edges handed to ELK reversed, so the layout breaks cycles the
 * way mermaid.js (dagre) does: see `findBackEdgeIndexes`. `elkToPositioned`
 * flips each one's points back so they still run source to target.
 *
 * Flowcharts only. State diagrams have their own cycle breaking (above), and a
 * graph with a subgraph direction override goes through hop edges and ports
 * that this does not rewrite.
 */
export function edgesReversedForLayout(graph: MermaidGraph): Set<number> {
  // Worked out once per graph object, by whichever of `mermaidToElk` and
  // `elkToPositioned` asks first.
  let set = reversedCache.get(graph)
  if (!set) {
    set = hasAnyDirectionOverride(graph.subgraphs)
      ? new Set()
      : usesMermaidElkPipeline(graph)
        ? // mermaid@12.3.0 only swaps the edges that close a cycle between
          // subgraphs; ELK's DEPTH_FIRST cycle breaking handles the rest.
          subgraphFeedbackEdges(graph)
        : findBackEdgeIndexes(graph, undefined, subgraphFeedbackEdges(graph))
    reversedCache.set(graph, set)
  }
  return set
}

/**
 * Source position of a root-level state or composite: the index of the first
 * edge that names it. A composite no edge names itself falls back to the first
 * edge naming a state inside it. Items no edge mentions rank last, keeping
 * their relative order.
 */
function firstMentionRank(graph: MermaidGraph, ids: Set<string>): number {
  for (let i = 0; i < graph.edges.length; i++) {
    const e = graph.edges[i]!
    if (ids.has(e.source) || ids.has(e.target)) return i
  }
  return Number.POSITIVE_INFINITY
}

/**
 * Convert a Mermaid direction to an ELK direction, flowchart/state-style
 * (no direction at all → `DOWN`; see `ELK_DIRECTION_FALLBACK`).
 *
 * `MermaidGraph.direction` is required, so the fallback is unreachable
 * from this path in practice — it exists so every `Direction` maps through
 * the one shared table.
 */
function directionToElk(dir: MermaidGraph['direction']): ElkDirection {
  return sharedDirectionToElk(dir, ELK_DIRECTION_FALLBACK.flowchart)
}

/**
 * The `elk.*` options the root graph and every subgraph container share.
 * Both add `elk.direction`, `elk.padding` and their own extras on top.
 */
function containerLayoutOptions(spec: {
  direction: ElkDirection
  nodeSpacing: number
  layerSpacing: number
  padding: number | ElkPaddingSides
}): LayoutOptions {
  return {
    ...baseElkLayoutOptions(spec),
    'elk.spacing.edgeEdge': '12',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
    'elk.layered.spacing.edgeNodeBetweenLayers': '12',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    'elk.contentAlignment': 'H_CENTER V_CENTER',
  }
}

/**
 * How flowchart/state edge labels are measured and placed: at the resolved
 * edge-label font size, inline and centered on the edge.
 */
function edgeLabelStyle(opts: { fontSizes: FontSizes }): ElkEdgeLabelStyle {
  return {
    fontSize: opts.fontSizes.edgeLabel,
    layoutOptions: INLINE_CENTERED_EDGE_LABEL,
  }
}

// ============================================================================
// Node sizing
// ============================================================================

const STATE_MIN_WIDTH = 136

/**
 * Mermaid's flowchart label box is never narrower than `flowchart.minNodeWidth`
 * (120px; `labelHelper` sets `minLabelWidth = node.minWidth`), so a short label
 * still gets a 120px box and every shape is sized around that box (#2717).
 * Circles and double circles are the exception: they size to the label's text.
 */
const FLOWCHART_MIN_LABEL_WIDTH = 120

/**
 * Node width minus the label box, for each shape, measured on mermaid@12.3.0
 * (mermaid@12.2.0 gives the same) with a one-line label. Diamonds, triangles,
 * clouds and tagged rectangles depend on the label height and are computed in
 * `estimateNodeSize`.
 */
const FLOWCHART_SHAPE_EXTRA_WIDTH: Partial<Record<string, number>> = {
  rectangle: 32,
  rounded: 30,
  stadium: 52,
  subroutine: 44,
  cylinder: 24,
  'horizontal-cylinder': 28.8,
  hexagon: 85.7,
  asymmetric: 54,
  parallelogram: 69,
  'parallelogram-alt': 69,
  trapezoid: 69,
  'trapezoid-alt': 114,
  document: 32,
  'stacked-document': 52,
  'stacked-process': 52,
  card: 56,
  'lined-process': 40,
  'divided-process': 16,
  'window-pane': 42,
  flag: 32,
  'bow-tie-rectangle': 37.6,
  'half-rounded-rectangle': 38.4,
  brace: 31.8,
  'brace-right': 46,
  braces: 48.5,
  'notched-pentagon': 32,
  'sloped-rectangle': 32,
  text: 15,
}
const STATE_MIN_HEIGHT = 40

export function estimateNodeSize(
  id: string,
  label: string,
  shape: string,
  nodeLabelFontSize: number,
  icon?: string,
  direction?: string,
  stateDiagram = false,
  legacyNodeSizes = false,
): { width: number; height: number } {
  // An architecture icon tile is Mermaid's fixed 80px square; its label hangs below.
  if (icon !== undefined) return { width: TILE, height: TILE }
  const metrics = measureMultilineText(
    label,
    nodeLabelFontSize,
    FONT_WEIGHTS.nodeLabel,
  )

  // mermaid@12.3.0 flowchart labels take a 1.5 line height (24px at 16px) and
  // 12px of vertical padding, so a one-line rect is 48px (#2931).
  const mermaidBox = !stateDiagram && !legacyNodeSizes
  if (mermaidBox)
    metrics.height = metrics.lines.length * nodeLabelFontSize * 1.5
  let width = metrics.width + NODE_PADDING.horizontal * 2
  let height = metrics.height + (mermaidBox ? 24 : NODE_PADDING.vertical * 2)

  if (shape === 'diamond') {
    const side = Math.max(width, height) + NODE_PADDING.diamondExtra
    width = side
    height = side
  }

  if (shape === 'circle' || shape === 'doublecircle') {
    const diameter = Math.ceil(Math.sqrt(width * width + height * height)) + 8
    width = shape === 'doublecircle' ? diameter + 12 : diameter
    height = width
  }

  if (shape === 'hexagon') {
    width += NODE_PADDING.horizontal
  }

  if (
    shape === 'trapezoid' ||
    shape === 'trapezoid-alt' ||
    shape === 'parallelogram' ||
    shape === 'parallelogram-alt'
  ) {
    // Sloped sides eat horizontal room at the label's baseline, so widen to
    // keep the label inside the polygon.
    width += NODE_PADDING.horizontal
  }

  if (shape === 'asymmetric') {
    width += ASYMMETRIC_NOTCH
  }

  if (shape === 'cylinder') {
    height += 14
  }

  // mermaid@12.3.0's horizontal cylinder pads the label box by 12, so a
  // one-line node is 36px tall, not the rectangle's 48 (#2850).
  if (shape === 'horizontal-cylinder' && mermaidBox)
    height = metrics.height + 12

  // Mermaid's cloud path spans 1.25w by h + 0.48w, for a label box w by h
  // (w kept at least 2.5h so the bumps stay inside that span).
  if (shape === 'cloud') {
    // mermaid@12.3.0 pads the cloud's label box by 15 (`halfPadding * 2`), not
    // the 24 a rectangle gets, in both directions (#2850).
    if (mermaidBox) height = metrics.height + 15
    const w =
      stateDiagram || legacyNodeSizes
        ? Math.max(width, height * 2.5)
        : Math.max(metrics.width, FLOWCHART_MIN_LABEL_WIDTH) + 15
    return { width: w * 1.25, height: height + w * 0.48 }
  }

  // Mermaid's small circle is a fixed 14px dot.
  if (shape === 'small-circle') return { width: 14, height: 14 }

  // A flowchart fork/join bar lies across the flow: 70x10, upright when flowing LR/RL.
  if (shape === 'fork-bar') {
    return direction === 'LR' || direction === 'RL'
      ? { width: 10, height: 70 }
      : { width: 70, height: 10 }
  }

  // mermaid@12.3.0 draws the start and end pseudostates as 14px circles.
  if (shape === 'state-start' || shape === 'state-end') {
    return { width: 14, height: 14 }
  }

  // Architecture junction: a join point, so edges meet with no gap.
  if (shape === 'junction') return { width: 2, height: 2 }

  // Unlabeled state pseudo-states (`<<choice>>`, `<<fork>>`/`<<join>>`), at
  // mermaid.js's sizes: a 28px diamond and a 70x10 bar.
  if (label === '' && shape === 'diamond') return { width: 28, height: 28 }
  if (label === '' && shape === 'fork-join') return { width: 70, height: 10 }

  if (!stateDiagram && !legacyNodeSizes) {
    const labelWidth = Math.max(metrics.width, FLOWCHART_MIN_LABEL_WIDTH)
    const extra = FLOWCHART_SHAPE_EXTRA_WIDTH[shape]
    if (extra !== undefined) width = labelWidth + extra
    else if (shape === 'tagged-rectangle')
      width = labelWidth + 32 + 0.2 * height
    else if (
      shape === 'diamond' ||
      shape === 'triangle' ||
      shape === 'flipped-triangle'
    ) {
      width = labelWidth + metrics.height + 30
      height = width
    }
  }

  // mermaid@12.3.0's state boxes are never narrower than 136px nor shorter
  // than 40px.
  width = Math.max(width, stateDiagram ? STATE_MIN_WIDTH : 60)
  height = Math.max(height, stateDiagram ? STATE_MIN_HEIGHT : 36)

  return { width, height }
}

// ============================================================================
// Graph conversion: MermaidGraph → ELK JSON
// ============================================================================

export interface ElkGraphNode extends ElkNode {
  children?: ElkGraphNode[]
  edges?: ElkExtendedEdge[]
}

/** Sentinel container key for hop/bridge edges that belong at the root level. */
const ROOT_CONTAINER = ' root'

/**
 * Recursively check whether any subgraph (at any nesting depth) has a
 * direction override. The previous implementation only scanned top-level
 * subgraphs, silently missing overrides on nested subgraphs — which meant
 * `hierarchyHandling` stayed at `INCLUDE_CHILDREN` (where ELK ignores a
 * compound node's own `elk.direction`) for exactly the diagrams that need
 * `SEPARATE` the most.
 */
export function hasAnyDirectionOverride(subgraphs: MermaidSubgraph[]): boolean {
  for (const sg of subgraphs) {
    if (sg.direction !== undefined) return true
    if (hasAnyDirectionOverride(sg.children)) return true
  }
  return false
}

/** Recursively collect every node ID that is a member of `sg`, including nested descendants. */
function collectAllMemberNodeIds(sg: MermaidSubgraph, out: Set<string>): void {
  for (const id of sg.nodeIds) out.add(id)
  for (const child of sg.children) collectAllMemberNodeIds(child, out)
}

/**
 * Build a map from subgraph ID to its full ancestor chain, outermost first,
 * ending with the subgraph itself (e.g. Inner nested in Outer → ["Outer", "Inner"]).
 */
function buildSubgraphChains(
  subgraphs: MermaidSubgraph[],
): Map<string, string[]> {
  const chains = new Map<string, string[]>()
  function walk(sg: MermaidSubgraph, ancestors: string[]): void {
    const chain = [...ancestors, sg.id]
    chains.set(sg.id, chain)
    for (const child of sg.children) walk(child, chain)
  }
  for (const sg of subgraphs) walk(sg, [])
  return chains
}

/** Length of the shared prefix of two ancestor chains. */
function commonPrefixLength(a: string[], b: string[]): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

/**
 * Convert a MermaidGraph to ELK's nested JSON input format.
 *
 * Uses SEPARATE hierarchy handling for proper subgraph direction override support.
 * Cross-hierarchy edges use hierarchical ports to connect external and internal sections.
 */
export function mermaidToElk(
  graph: MermaidGraph,
  givenOpts: Required<
    Pick<RenderOptions, 'font' | 'padding' | 'nodeSpacing' | 'layerSpacing'>
  > & { fontSizes: FontSizes; legacyNodeSizes?: boolean },
): ElkGraphNode {
  const opts = givenOpts
  // Collect all node IDs that belong to subgraphs
  const subgraphNodeIds = new Set<string>()
  const subgraphIds = new Set<string>()
  for (const sg of graph.subgraphs) {
    subgraphIds.add(sg.id)
    collectSubgraphNodeIds(sg, subgraphNodeIds, subgraphIds)
  }

  // Build node-to-subgraph mapping for edge distribution
  const nodeToSubgraph = buildNodeToSubgraphMap(graph.subgraphs)

  // Full ancestor chain (outermost → innermost) for every subgraph, used to
  // decompose edges that cross more than one subgraph boundary.
  const subgraphChains = buildSubgraphChains(graph.subgraphs)
  const chainOf = (sgId: string | undefined): string[] =>
    sgId ? (subgraphChains.get(sgId) ?? []) : []

  // Classify edges into three categories:
  // 1. Internal edges (both endpoints in the same innermost subgraph)
  // 2. Root-level edges (neither endpoint in a subgraph)
  // 3. Cross-hierarchy edges (endpoints in different levels, possibly
  //    several subgraph boundaries apart)
  const edgesBySubgraph = new Map<
    string | null,
    Array<{ index: number; edge: (typeof graph.edges)[0] }>
  >()
  edgesBySubgraph.set(null, []) // Root-level edges

  // Cross-hierarchy edges carry the full ancestor chain for each endpoint so
  // we can decompose them into a chain of sub-edges (one per crossed
  // boundary) rather than assuming a single hop.
  const crossHierarchyEdges: Array<{
    index: number
    edge: (typeof graph.edges)[0]
    srcChain: string[]
    tgtChain: string[]
  }> = []

  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i]!
    const sourceSubgraph = nodeToSubgraph.get(edge.source)
    const targetSubgraph = nodeToSubgraph.get(edge.target)
    if (sourceSubgraph && sourceSubgraph === targetSubgraph) {
      // Internal edge: both endpoints in same innermost subgraph
      const internal = edgesBySubgraph.get(sourceSubgraph) ?? []
      edgesBySubgraph.set(sourceSubgraph, internal)
      internal.push({ index: i, edge })
    } else if (!sourceSubgraph && !targetSubgraph) {
      // Root-level edge: neither endpoint in a subgraph
      edgesBySubgraph.get(null)!.push({ index: i, edge })
    } else {
      // Cross-hierarchy edge: may cross one or more subgraph boundaries
      crossHierarchyEdges.push({
        index: i,
        edge,
        srcChain: chainOf(sourceSubgraph),
        tgtChain: chainOf(targetSubgraph),
      })
    }
  }

  // Determine if we need SEPARATE hierarchy handling.
  // We use SEPARATE when any subgraph — at any nesting depth — has a
  // direction override, since ELK's INCLUDE_CHILDREN mode ignores a nested
  // compound node's own `elk.direction`.
  const hasDirectionOverride = hasAnyDirectionOverride(graph.subgraphs)

  // Root ELK graph's children/edges — built up below across several loops,
  // then assembled into the elkGraph object literal at the very end so its
  // fields never need to be re-read through the (optional-in-the-library)
  // ElkNode.children/edges types.
  const rootChildren: ElkGraphNode[] = []
  const rootEdges: ElkExtendedEdge[] = []

  // Build the root ELK graph's layout options up front — the graph object
  // itself is assembled at the end, once rootChildren/rootEdges are full.
  const rootLayoutOptions: LayoutOptions = {
    ...withMermaidSpacing(
      containerLayoutOptions({
        direction: directionToElk(graph.direction),
        nodeSpacing: opts.nodeSpacing,
        layerSpacing:
          isStateGraph(graph) && opts.layerSpacing === DEFAULTS.layerSpacing
            ? STATE_LAYER_SPACING
            : opts.layerSpacing,
        padding: opts.padding,
      }),
      mermaidSpacing(graph, opts, 'root'),
    ),
    // mermaid@12.3.0 leaves thoroughness at ELK's default.
    ...(usesMermaidElkPipeline(graph)
      ? {}
      : { 'elk.layered.thoroughness': String(DEFAULTS.thoroughness) }),
    // Off (ELK's default): it counts parallel edges, so a node with six edges
    // to one target counted as high degree and the target dropped a layer
    // below its sibling (#2154). dagre has no such treatment.
    'elk.layered.highDegreeNodes.treatment': 'false',
    // Post-compaction slides a sink down the flow axis into the gap an inline
    // edge label leaves, one layer past its siblings (#1750); mermaid keeps
    // it beside them. Subgraph layouts that are not mermaid@12.3.0's (direction
    // overrides) keep it.
    'elk.layered.compaction.postCompaction.strategy':
      // A labelled parallel run widens the target's routing channel and
      // compaction then pulls its siblings up past it (#2154).
      graph.subgraphs.length === 0 ||
      hasLabelledParallelRun(graph) ||
      usesMermaidElkPipeline(graph)
        ? 'NONE'
        : 'LEFT_RIGHT_CONSTRAINT_LOCKING',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    ...(usesMermaidElkPipeline(graph)
      ? { 'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST' }
      : {}),
    // 70 under mermaid@12.3.0's pipeline (50 before nodes had the 120px minimum width, #2717): its wider edge-label boxes need more
    // room for the parallel runs than 12.2.0's did (Five, Six and Nine Cluster
    // Exit Siblings all match 12.3.0 at 70; 60 fails Five and Six).
    // Flowcharts without subgraphs need none of this once nodes have mermaid's
    // 120px minimum width (#2717): the target already sits ~14px off the source.
    ...(hasLabelledParallelRun(graph) &&
    ((usesMermaidElkPipeline(graph) && graph.subgraphs.length > 0) ||
      isStateGraph(graph) ||
      opts.legacyNodeSizes)
      ? {
          'elk.spacing.edgeEdge': usesMermaidElkPipeline(graph)
            ? opts.legacyNodeSizes
              ? '50'
              : '70'
            : '40',
        }
      : {}),
    ...(isStateGraph(graph) ? STATE_LAYOUT_OPTIONS : {}),
    'elk.layered.wrapping.strategy': 'OFF',
    // Use SEPARATE when subgraphs have direction overrides (enables proper direction handling)
    // Use INCLUDE_CHILDREN otherwise (simpler cross-hierarchy edge routing)
    'elk.hierarchyHandling': hasDirectionOverride
      ? 'SEPARATE'
      : 'INCLUDE_CHILDREN',
  }
  // Ports to declare on each subgraph's ELK node, keyed by subgraph ID.
  const portsBySubgraph = new Map<string, Set<string>>()
  // Hop/bridge edges to inject into each container's own `edges` array.
  // Keyed by subgraph ID, or ROOT_CONTAINER for the top-level graph.
  const hopEdgesByContainer = new Map<string, ElkExtendedEdge[]>()

  function addPort(sgId: string, portId: string): void {
    const ports = portsBySubgraph.get(sgId) ?? new Set<string>()
    portsBySubgraph.set(sgId, ports)
    ports.add(portId)
  }
  function addHopEdge(containerId: string, elkEdge: ElkExtendedEdge): void {
    const edges = hopEdgesByContainer.get(containerId) ?? []
    hopEdgesByContainer.set(containerId, edges)
    edges.push(elkEdge)
  }

  // Decompose each cross-hierarchy edge into a chain of sub-edges, one per
  // subgraph boundary crossed, joined at explicit ELK ports. This is
  // required under `hierarchyHandling: SEPARATE`: ELK only resolves an edge
  // automatically when both endpoints are visible from the edge's container
  // (a direct child, or a port owned by the container or a direct child of
  // it) — it does not search further down the hierarchy. A single-hop port
  // (as used previously) is therefore only correct when one endpoint is a
  // direct child of the other endpoint's subgraph; for deeper nesting ELK
  // silently fails to route the edge at all (no sections in the result).
  //
  // For each side that needs to cross N boundaries to reach the lowest
  // common ancestor (LCA) of the source and target subgraphs, we add one
  // port per boundary and chain sub-edges between them, walking outward
  // from the endpoint to the LCA. The final "bridge" sub-edge (still ID
  // `e{index}`, carrying the edge label) lives directly in the LCA's own
  // `edges` array (or at root, if the LCA is the root graph).
  if (hasDirectionOverride) {
    for (const { index, edge, srcChain, tgtChain } of crossHierarchyEdges) {
      const commonLen = commonPrefixLength(srcChain, tgtChain)

      let sourceRef = edge.source
      if (srcChain.length > commonLen) {
        for (let i = srcChain.length - 1; i >= commonLen; i--) {
          const sgId = srcChain[i]!
          const portId = `${sgId}_out_${index}`
          addPort(sgId, portId)
          const fromRef =
            i === srcChain.length - 1
              ? edge.source
              : `${srcChain[i + 1]}_out_${index}`
          addHopEdge(sgId, {
            id: `e${index}_s${i}`,
            sources: [fromRef],
            targets: [portId],
          })
        }
        sourceRef = `${srcChain[commonLen]}_out_${index}`
      }

      let targetRef = edge.target
      if (tgtChain.length > commonLen) {
        for (let i = commonLen; i <= tgtChain.length - 1; i++) {
          const sgId = tgtChain[i]!
          const portId = `${sgId}_in_${index}`
          addPort(sgId, portId)
          const toRef =
            i === tgtChain.length - 1
              ? edge.target
              : `${tgtChain[i + 1]}_in_${index}`
          addHopEdge(sgId, {
            id: `e${index}_t${i}`,
            sources: [portId],
            targets: [toRef],
          })
        }
        targetRef = `${tgtChain[commonLen]}_in_${index}`
      }

      const bridgeContainer =
        commonLen > 0 ? srcChain[commonLen - 1]! : ROOT_CONTAINER
      addHopEdge(
        bridgeContainer,
        buildElkEdge({
          id: `e${index}`,
          source: sourceRef,
          target: targetRef,
          label: edge.label,
          labelStyle: edgeLabelStyle(opts),
        }),
      )
    }
  }

  // Add top-level nodes (those not in any subgraph).
  for (const [id, node] of graph.nodes) {
    if (!subgraphNodeIds.has(id) && !subgraphIds.has(id)) {
      const size = estimateNodeSize(
        id,
        node.label,
        node.shape,
        opts.fontSizes.nodeLabel,
        node.icon,
        graph.direction,
        isStateGraph(graph),
        opts.legacyNodeSizes,
      )
      const leaf = buildElkLeafNode(id, size, node.label)
      // A top-level start `[*]` marks where reading starts: pin it to the
      // first layer so a back-edge can't drag it into the middle. The end
      // marker stays free (see STATE_MARKER_LAYER_CONSTRAINT).
      const pin = isStateGraph(graph)
        ? STATE_MARKER_LAYER_CONSTRAINT[node.shape]
        : undefined
      if (pin !== undefined) {
        leaf.layoutOptions = { 'elk.layered.layering.layerConstraint': pin }
      }
      rootChildren.push(leaf)
    }
  }

  // Add subgraphs as compound nodes with children and their internal
  // edges. Sibling subgraphs are appended in *reverse* declaration order
  // (only relative to each other — their position as a group, before or
  // after the top-level leaf nodes above, is left as-is) to match real
  // mermaid.js's own sibling-subgraph order, which is what ELK's
  // `considerModelOrder` uses as a tie-break during crossing minimization
  // and thus what ultimately decides left-right sibling order.
  //
  // Verified against mermaid@11.17.2's bundled flowDb.getData()
  // (node_modules/mermaid/dist/mermaid.min.js): it builds the node list fed
  // to the layout engine by iterating the parsed `subGraphs` array
  // *backwards* to emit cluster/subgraph nodes. Since a compound node's
  // `children()` order in the resulting graph is exactly the order its
  // child nodes were inserted, sibling subgraphs under the same parent end
  // up in reversed declaration order — see issue #444.
  //
  // Deliberately scoped to *only* the sibling-subgraph reversal, not a
  // wholesale "all clusters before all leaves" reordering (which mermaid's
  // own mechanism also does, globally): moving the whole subgraphs group
  // ahead of top-level leaf nodes changes which edge in a cycle ELK treats
  // as a feedback edge. Cycles in a flowchart are broken before ELK sees
  // them (`edgesReversedForLayout`), so this ordering no longer decides that.
  const stateGraph = isStateGraph(graph)
  const leafCount = rootChildren.length
  // State diagrams read in source order, so composites keep forward
  // declaration order and are interleaved with the leaves below.
  const subgraphOrder = stateGraph
    ? graph.subgraphs
    : [...graph.subgraphs].reverse()
  for (const sg of subgraphOrder) {
    rootChildren.push(
      subgraphToElk(
        sg,
        graph,
        opts,
        edgesBySubgraph,
        portsBySubgraph,
        hopEdgesByContainer,
        graph.direction,
      ),
    )
  }
  if (usesMermaidElkPipeline(graph)) {
    // mermaid@12.3.0 lists every subgraph before the plain nodes.
    rootChildren.unshift(...rootChildren.splice(leafCount))
  }
  if (stateGraph && graph.subgraphs.length > 0) {
    // ELK's MODEL_ORDER cycle breaking and crossing minimisation follow the
    // child order, so a composite must sit at its first-mention position
    // among its siblings rather than after every leaf (#1287). Array#sort is
    // stable, so equal ranks keep leaves-then-composites order.
    const rank = rootChildren.map((child, i) => {
      if (i < leafCount) return firstMentionRank(graph, new Set([child.id]))
      const sg = graph.subgraphs[i - leafCount]!
      const own = firstMentionRank(graph, new Set([sg.id]))
      if (own !== Number.POSITIVE_INFINITY) return own
      const members = new Set<string>()
      collectAllMemberNodeIds(sg, members)
      return firstMentionRank(graph, members)
    })
    const order = rootChildren
      .map((_, i) => i)
      .sort((a, b) => rank[a]! - rank[b]! || a - b)
    const sorted = order.map((i) => rootChildren[i]!)
    rootChildren.splice(0, rootChildren.length, ...sorted)
  }

  // Add root-level edges. Self-loops (edge.source === edge.target) are
  // excluded — ELK has no native self-loop layout and produces a degenerate
  // zero-length-span polyline for them; from-elk.ts synthesizes a proper
  // side loop for these once node positions are known instead.
  const reversed = edgesReversedForLayout(graph)
  const flatEdges = usesMermaidElkPipeline(graph) && !hasDirectionOverride
  const rootOrdered = edgesBySubgraph.get(null)!
  if (flatEdges) {
    // One pass over the whole hierarchy: every edge sits at the root with its
    // raw node ids, in mermaid@12.3.0's order.
    for (const index of mermaidEdgeOrder(graph)) {
      const edge = graph.edges[index]!
      // Self-loops stay in the graph under mermaid@12.3.0 (they shape the
      // layering); `elkToPositioned` replaces ELK's route with its own loop.
      rootEdges.push(
        buildElkEdge({
          id: `e${index}`,
          source: reversed.has(index) ? edge.target : edge.source,
          target: reversed.has(index) ? edge.source : edge.target,
          label: edge.label,
          labelStyle: edgeLabelStyle(opts),
        }),
      )
    }
  }
  for (const { index, edge } of flatEdges ? [] : rootOrdered) {
    if (edge.source === edge.target) continue
    rootEdges.push(
      buildElkEdge({
        id: `e${index}`,
        source: reversed.has(index) ? edge.target : edge.source,
        target: reversed.has(index) ? edge.source : edge.target,
        label: edge.label,
        labelStyle: edgeLabelStyle(opts),
      }),
    )
  }

  if (hasDirectionOverride) {
    // Cross-hierarchy edges were already decomposed into hop/bridge edges
    // above; the ones whose LCA is the root graph belong here.
    for (const elkEdge of hopEdgesByContainer.get(ROOT_CONTAINER) ?? []) {
      rootEdges.push(elkEdge)
    }
  } else {
    // No direction overrides anywhere: hierarchyHandling is INCLUDE_CHILDREN,
    // which lets ELK route cross-hierarchy edges automatically as long as
    // they're declared with their raw node IDs (no port decomposition
    // needed).
    for (const { index, edge } of flatEdges ? [] : crossHierarchyEdges) {
      rootEdges.push(
        buildElkEdge({
          id: `e${index}`,
          source: reversed.has(index) ? edge.target : edge.source,
          target: reversed.has(index) ? edge.source : edge.target,
          label: edge.label,
          labelStyle: edgeLabelStyle(opts),
        }),
      )
    }
  }

  return {
    id: 'root',
    layoutOptions: rootLayoutOptions,
    children: rootChildren,
    edges: rootEdges,
  }
}

/**
 * Convert a MermaidSubgraph to an ELK compound node.
 * Includes internal edges (edges where both endpoints are in this subgraph)
 * so that the subgraph's direction override is respected by ELK.
 *
 * When using SEPARATE hierarchy handling (for direction override support),
 * also adds hierarchical ports for cross-hierarchy edges.
 *
 * `inheritedDirection` is the effective direction of the nearest ancestor
 * (a subgraph's own honored override, or ultimately the root graph's
 * direction) — used when this subgraph's own override is dropped per
 * `subgraphDirectionIsHonored`. Explicitly propagating it, rather than
 * leaving `elk.direction` unset and relying on ELK's own property
 * inheritance under `hierarchyHandling: SEPARATE`, keeps the "inherit the
 * parent's direction" behavior correct and independent of ELK's inheritance
 * semantics for that property.
 */
function subgraphToElk(
  sg: MermaidSubgraph,
  graph: MermaidGraph,
  opts: Required<
    Pick<RenderOptions, 'font' | 'padding' | 'nodeSpacing' | 'layerSpacing'>
  > & { fontSizes: FontSizes; legacyNodeSizes?: boolean },
  edgesBySubgraph: Map<
    string | null,
    Array<{ index: number; edge: MermaidEdge }>
  >,
  portsBySubgraph: Map<string, Set<string>>,
  hopEdgesByContainer: Map<string, ElkExtendedEdge[]>,
  inheritedDirection: MermaidGraph['direction'],
): ElkGraphNode {
  // Apply this subgraph's own direction override only if it's actually
  // honored (no member node has an edge crossing the boundary); otherwise
  // fall back to the inherited (parent) direction, per mermaid.js's
  // documented precedence rule.
  const effectiveDirection =
    sg.direction !== undefined && subgraphDirectionIsHonored(sg, graph)
      ? sg.direction
      : inheritedDirection

  const layoutOptions: LayoutOptions = withMermaidSpacing(
    containerLayoutOptions({
      direction: directionToElk(effectiveDirection),
      nodeSpacing: opts.nodeSpacing,
      layerSpacing:
        isStateGraph(graph) && opts.layerSpacing === DEFAULTS.layerSpacing
          ? STATE_COMPOSITE_LAYER_SPACING
          : opts.layerSpacing,
      // A region has no title bar to leave room for.
      padding: sg.region
        ? REGION_PADDING
        : isStateGraph(graph)
          ? STATE_COMPOSITE_PADDING
          : usesMermaidElkPipeline(graph)
            ? MERMAID_SUBGRAPH_PADDING
            : SUBGRAPH_PADDING,
    }),
    mermaidSpacing(graph, opts, 'subgraph'),
  )

  if (usesMermaidElkPipeline(graph) && !sg.region) {
    // The box must be wide enough for its title (mermaid@12.3.0 sets
    // `nodeSize.minimum` from the label width).
    const titleWidth =
      measureMultilineText(
        sg.label,
        opts.fontSizes.groupHeader,
        FONT_WEIGHTS.groupHeader,
      ).width +
      2 * GROUP_HEADER_CONTENT_PAD
    layoutOptions['elk.nodeSize.constraints'] = '[MINIMUM_SIZE]'
    // ELK applies the minimum in the layout's own (rotated) frame, so for a
    // top-down or bottom-up layout the width goes in the second slot.
    const vertical =
      effectiveDirection === 'TD' ||
      effectiveDirection === 'TB' ||
      effectiveDirection === 'BT'
    layoutOptions['elk.nodeSize.minimum'] = vertical
      ? `(0, ${titleWidth})`
      : `(${titleWidth}, 0)`
  }

  if (sg.region || sg.children.some((c) => c.region)) {
    // Concurrent regions: give ELK what mermaid@12.3.0 gives it (the region
    // container and each region are ordinary subgraphs with the subgraph
    // spacing); its own layered packing then yields mermaid's column/row shape
    // and order (#2962). A caller's own `nodeSpacing`/`layerSpacing` still wins,
    // as in `mermaidSpacing`; the hierarchy setting does not depend on it.
    if (
      opts.nodeSpacing === DEFAULTS.nodeSpacing &&
      opts.layerSpacing === DEFAULTS.layerSpacing
    ) {
      for (const key of FORK_SPACING_KEYS) delete layoutOptions[key]
      Object.assign(layoutOptions, MERMAID_SUBGRAPH_SPACING)
    }
    layoutOptions['elk.hierarchyHandling'] = 'SEPARATE_CHILDREN'
  }

  if (usesMermaidElkPipeline(graph)) {
    layoutOptions['elk.layered.cycleBreaking.strategy'] = 'DEPTH_FIRST'
    layoutOptions['elk.spacing.portsSurrounding'] = PORTS_SURROUNDING
  }

  // Ports, built before children/edges since they don't depend on them.
  let elkPorts: ElkNode['ports']
  const ports = portsBySubgraph.get(sg.id)
  if (ports && ports.size > 0) {
    elkPorts = [...ports].map((portId) => ({
      id: portId,
      // Port side is determined by ELK based on edge direction
    }))
  }

  // Add direct child (leaf) nodes, in forward declaration order (the order the
  // graph first mentions them under mermaid@12.3.0).
  const children: ElkGraphNode[] = []
  const pipeline = usesMermaidElkPipeline(graph)
  const leafIds = pipeline
    ? [...graph.nodes.keys()].filter((id) => sg.nodeIds.includes(id))
    : sg.nodeIds
  for (const nodeId of leafIds) {
    const node = graph.nodes.get(nodeId)
    if (node) {
      const size = estimateNodeSize(
        nodeId,
        node.label,
        node.shape,
        opts.fontSizes.nodeLabel,
        node.icon,
        graph.direction,
        isStateGraph(graph),
        opts.legacyNodeSizes,
      )
      const leaf = buildElkLeafNode(nodeId, size, node.label)
      children.push(leaf)
    }
  }

  // Add nested subgraphs recursively, in reverse declaration order relative
  // to *each other* only (their position as a group, before or after the
  // leaf nodes above, is left as-is — see the matching comment and
  // rationale in `mermaidToElk`) — matching real mermaid.js's own sibling-
  // subgraph order (issue #444).
  // Regions keep their written order (mermaid.js draws `--` sections left to
  // right), unlike sibling subgraphs.
  const orderedChildren = sg.children.some((c) => c.region)
    ? sg.children
    : [...sg.children].reverse()
  const leafCount = children.length
  for (const child of orderedChildren) {
    children.push(
      subgraphToElk(
        child,
        graph,
        opts,
        edgesBySubgraph,
        portsBySubgraph,
        hopEdgesByContainer,
        effectiveDirection,
      ),
    )
  }
  // mermaid@12.3.0 lists nested subgraphs before the plain nodes.
  if (pipeline) children.unshift(...children.splice(leafCount))

  // Add internal edges (edges where both endpoints are in this subgraph).
  // Self-loops are excluded — see the matching comment in mermaidToElk.
  const edges: ElkExtendedEdge[] = []
  const internalEdges = edgesBySubgraph.get(sg.id) ?? []
  const reversed = edgesReversedForLayout(graph)
  for (const { index, edge } of usesMermaidElkPipeline(graph) &&
  !hasAnyDirectionOverride(graph.subgraphs)
    ? []
    : internalEdges) {
    if (edge.source === edge.target) continue
    edges.push(
      buildElkEdge({
        id: `e${index}`,
        source: reversed.has(index) ? edge.target : edge.source,
        target: reversed.has(index) ? edge.source : edge.target,
        label: edge.label,
        labelStyle: edgeLabelStyle(opts),
      }),
    )
  }

  // Add hop/bridge edges whose lowest common ancestor is this subgraph.
  // These connect boundary ports to internal nodes (single-hop case), chain
  // ports between two nested levels (multi-hop case), or bridge two ports
  // belonging to direct children of this subgraph (the actual crossing
  // point between the source-side and target-side chains).
  for (const elkEdge of hopEdgesByContainer.get(sg.id) ?? []) {
    edges.push(elkEdge)
  }

  return {
    id: sg.id,
    layoutOptions,
    labels: sg.label ? [{ text: sg.label }] : undefined,
    ports: elkPorts,
    children,
    edges,
  }
}

/** Recursively collect all node IDs that belong to any subgraph */
function collectSubgraphNodeIds(
  sg: MermaidSubgraph,
  nodeIds: Set<string>,
  subgraphIds: Set<string>,
): void {
  for (const id of sg.nodeIds) {
    nodeIds.add(id)
  }
  for (const child of sg.children) {
    subgraphIds.add(child.id)
    collectSubgraphNodeIds(child, nodeIds, subgraphIds)
  }
}

/**
 * Build a mapping from node ID to its containing subgraph ID.
 * For nested subgraphs, maps to the innermost containing subgraph.
 * Nodes not in any subgraph are not included in the map.
 */
function buildNodeToSubgraphMap(
  subgraphs: MermaidSubgraph[],
): Map<string, string> {
  const map = new Map<string, string>()

  function traverse(sg: MermaidSubgraph): void {
    // Map all direct child nodes to this subgraph
    for (const nodeId of sg.nodeIds) {
      map.set(nodeId, sg.id)
    }
    // Recursively process nested subgraphs (they override parent mapping)
    for (const child of sg.children) {
      traverse(child)
    }
  }

  for (const sg of subgraphs) {
    traverse(sg)
  }

  return map
}
