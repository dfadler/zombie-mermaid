/**
 * Graph conversion: MermaidGraph → ELK JSON.
 *
 * Split out of layout-engine.ts. This module only handles building ELK's
 * nested JSON input format from a parsed MermaidGraph — the reverse
 * direction (ELK result → PositionedGraph) lives in ./from-elk.ts.
 */

import type { ElkNode, ElkExtendedEdge, LayoutOptions } from 'elkjs'
import type {
  MermaidGraph,
  MermaidSubgraph,
  MermaidEdge,
  RenderOptions,
} from '../types.ts'
import type { FontSizes } from '../styles.ts'
import { FONT_WEIGHTS, NODE_PADDING } from '../styles.ts'
import { measureMultilineText } from '../text-metrics.ts'
import { DEFAULTS } from './constants.ts'

/** Convert Mermaid direction to ELK direction */
function directionToElk(dir: MermaidGraph['direction']): string {
  switch (dir) {
    case 'LR':
      return 'RIGHT'
    case 'RL':
      return 'LEFT'
    case 'BT':
      return 'UP'
    case 'TD':
    case 'TB':
    default:
      return 'DOWN'
  }
}

// ============================================================================
// Node sizing
// ============================================================================

function estimateNodeSize(
  id: string,
  label: string,
  shape: string,
  nodeLabelFontSize: number,
): { width: number; height: number } {
  const metrics = measureMultilineText(
    label,
    nodeLabelFontSize,
    FONT_WEIGHTS.nodeLabel,
  )

  let width = metrics.width + NODE_PADDING.horizontal * 2
  let height = metrics.height + NODE_PADDING.vertical * 2

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
    width += 12
  }

  if (shape === 'cylinder') {
    height += 14
  }

  if (shape === 'state-start' || shape === 'state-end') {
    return { width: 28, height: 28 }
  }

  width = Math.max(width, 60)
  height = Math.max(height, 36)

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
function hasAnyDirectionOverride(subgraphs: MermaidSubgraph[]): boolean {
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
 * Real mermaid.js ignores a subgraph's own `direction` override once any of
 * its member nodes (including nested descendants) has an edge to something
 * outside the subgraph — the subgraph then inherits its parent's direction
 * instead. Per the docs: "If any of a subgraph's nodes are linked to the
 * outside, subgraph direction will be ignored. Instead the subgraph will
 * inherit the direction of the parent graph."
 * https://mermaid.js.org/syntax/flowchart.html
 *
 * Verified against real mermaid.js output for nested subgraphs with
 * `direction LR` and an edge crossing the boundary (e.g. `B --> X` where X
 * is inside the subgraph): the crossing-linked nodes render at the same
 * x-coordinate with increasing y — stacked per the parent's direction,
 * despite the subgraph's own `direction LR`. Mirrors the equivalent ASCII
 * fix in src/ascii/converter.ts (subgraphDirectionIsHonored, issue #445).
 */
function subgraphDirectionIsHonored(
  sg: MermaidSubgraph,
  graph: MermaidGraph,
): boolean {
  const memberIds = new Set<string>()
  collectAllMemberNodeIds(sg, memberIds)
  if (memberIds.size === 0) return true

  const isInside = (id: string): boolean => memberIds.has(id) || id === sg.id

  return !graph.edges.some((e) => isInside(e.source) !== isInside(e.target))
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
  opts: Required<
    Pick<RenderOptions, 'font' | 'padding' | 'nodeSpacing' | 'layerSpacing'>
  > & { fontSizes: FontSizes },
): ElkGraphNode {
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
    'elk.algorithm': 'layered',
    'elk.direction': directionToElk(graph.direction),
    'elk.spacing.nodeNode': String(opts.nodeSpacing),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.layerSpacing),
    'elk.spacing.edgeEdge': '12',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
    'elk.layered.spacing.edgeNodeBetweenLayers': '12',
    'elk.padding': `[top=${opts.padding},left=${opts.padding},bottom=${opts.padding},right=${opts.padding}]`,
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    'elk.contentAlignment': 'H_CENTER V_CENTER',
    'elk.layered.thoroughness': String(DEFAULTS.thoroughness),
    'elk.layered.highDegreeNodes.treatment': 'true',
    'elk.layered.highDegreeNodes.threshold': '8',
    'elk.layered.compaction.postCompaction.strategy':
      'LEFT_RIGHT_CONSTRAINT_LOCKING',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
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
      const bridgeEdge: ElkExtendedEdge = {
        id: `e${index}`,
        sources: [sourceRef],
        targets: [targetRef],
      }
      if (edge.label) {
        const metrics = measureMultilineText(
          edge.label,
          opts.fontSizes.edgeLabel,
          FONT_WEIGHTS.edgeLabel,
        )
        bridgeEdge.labels = [
          {
            text: edge.label,
            width: metrics.width + 8,
            height: metrics.height + 6,
            layoutOptions: {
              'elk.edgeLabels.inline': 'true',
              'elk.edgeLabels.placement': 'CENTER',
            },
          },
        ]
      }
      addHopEdge(bridgeContainer, bridgeEdge)
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
      )
      rootChildren.push({
        id,
        width: size.width,
        height: size.height,
        labels: [{ text: node.label }],
      })
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
  // ahead of top-level leaf nodes changed which edge in a cycle ELK treats
  // as a feedback edge for a sample mixing top-level leaves and a
  // subgraph in a cyclic flow (e.g. "CI/CD Pipeline"), reordering the
  // entire rank structure rather than just left-right sibling position —
  // a much bigger, unreviewed blast radius than the reported bug needs.
  for (const sg of [...graph.subgraphs].reverse()) {
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

  // Add root-level edges
  for (const { index, edge } of edgesBySubgraph.get(null)!) {
    const elkEdge: ElkExtendedEdge = {
      id: `e${index}`,
      sources: [edge.source],
      targets: [edge.target],
    }
    if (edge.label) {
      const metrics = measureMultilineText(
        edge.label,
        opts.fontSizes.edgeLabel,
        FONT_WEIGHTS.edgeLabel,
      )
      elkEdge.labels = [
        {
          text: edge.label,
          width: metrics.width + 8,
          height: metrics.height + 6,
          layoutOptions: {
            'elk.edgeLabels.inline': 'true',
            'elk.edgeLabels.placement': 'CENTER',
          },
        },
      ]
    }
    rootEdges.push(elkEdge)
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
    for (const { index, edge } of crossHierarchyEdges) {
      const elkEdge: ElkExtendedEdge = {
        id: `e${index}`,
        sources: [edge.source],
        targets: [edge.target],
      }
      if (edge.label) {
        const metrics = measureMultilineText(
          edge.label,
          opts.fontSizes.edgeLabel,
          FONT_WEIGHTS.edgeLabel,
        )
        elkEdge.labels = [
          {
            text: edge.label,
            width: metrics.width + 8,
            height: metrics.height + 6,
            layoutOptions: {
              'elk.edgeLabels.inline': 'true',
              'elk.edgeLabels.placement': 'CENTER',
            },
          },
        ]
      }
      rootEdges.push(elkEdge)
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
  > & { fontSizes: FontSizes },
  edgesBySubgraph: Map<
    string | null,
    Array<{ index: number; edge: MermaidEdge }>
  >,
  portsBySubgraph: Map<string, Set<string>>,
  hopEdgesByContainer: Map<string, ElkExtendedEdge[]>,
  inheritedDirection: MermaidGraph['direction'],
): ElkGraphNode {
  const layoutOptions: LayoutOptions = {
    'elk.algorithm': 'layered',
    'elk.padding': '[top=44,left=16,bottom=16,right=16]', // Top = headerHeight(28) + gap(16) to match bottom padding
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.contentAlignment': 'H_CENTER V_CENTER',
    'elk.spacing.edgeEdge': '12',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
    'elk.layered.spacing.edgeNodeBetweenLayers': '12',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.layerSpacing),
    'elk.spacing.nodeNode': String(opts.nodeSpacing),
  }

  // Apply this subgraph's own direction override only if it's actually
  // honored (no member node has an edge crossing the boundary); otherwise
  // fall back to the inherited (parent) direction, per mermaid.js's
  // documented precedence rule.
  const effectiveDirection =
    sg.direction !== undefined && subgraphDirectionIsHonored(sg, graph)
      ? sg.direction
      : inheritedDirection
  layoutOptions['elk.direction'] = directionToElk(effectiveDirection)

  // Ports, built before children/edges since they don't depend on them.
  let elkPorts: ElkNode['ports']
  const ports = portsBySubgraph.get(sg.id)
  if (ports && ports.size > 0) {
    elkPorts = [...ports].map((portId) => ({
      id: portId,
      // Port side is determined by ELK based on edge direction
    }))
  }

  // Add direct child (leaf) nodes, in forward declaration order.
  const children: ElkGraphNode[] = []
  for (const nodeId of sg.nodeIds) {
    const node = graph.nodes.get(nodeId)
    if (node) {
      const size = estimateNodeSize(
        nodeId,
        node.label,
        node.shape,
        opts.fontSizes.nodeLabel,
      )
      children.push({
        id: nodeId,
        width: size.width,
        height: size.height,
        labels: [{ text: node.label }],
      })
    }
  }

  // Add nested subgraphs recursively, in reverse declaration order relative
  // to *each other* only (their position as a group, before or after the
  // leaf nodes above, is left as-is — see the matching comment and
  // rationale in `mermaidToElk`) — matching real mermaid.js's own sibling-
  // subgraph order (issue #444).
  for (const child of [...sg.children].reverse()) {
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

  // Add internal edges (edges where both endpoints are in this subgraph)
  const edges: ElkExtendedEdge[] = []
  const internalEdges = edgesBySubgraph.get(sg.id) ?? []
  for (const { index, edge } of internalEdges) {
    const elkEdge: ElkExtendedEdge = {
      id: `e${index}`,
      sources: [edge.source],
      targets: [edge.target],
    }
    if (edge.label) {
      const metrics = measureMultilineText(
        edge.label,
        opts.fontSizes.edgeLabel,
        FONT_WEIGHTS.edgeLabel,
      )
      elkEdge.labels = [
        {
          text: edge.label,
          width: metrics.width + 8,
          height: metrics.height + 6,
          layoutOptions: {
            'elk.edgeLabels.inline': 'true',
            'elk.edgeLabels.placement': 'CENTER',
          },
        },
      ]
    }
    edges.push(elkEdge)
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
