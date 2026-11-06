/**
 * Result conversion: ELK output → PositionedGraph.
 *
 * Split out of layout-engine.ts. This module handles turning ELK's layout
 * result back into our PositionedGraph format, including the post-processing
 * passes (layer alignment, edge bundling, shape-aware clipping) that clean
 * up ELK's raw output.
 */

import type { ElkNode, ElkExtendedEdge } from '@zombie-mermaid/core'
import type {
  MermaidGraph,
  MermaidSubgraph,
  PositionedGraph,
  PositionedNode,
  PositionedEdge,
  PositionedGroup,
  Point,
} from '@zombie-mermaid/core'
import { ARROW_HEAD, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'
import { clipEdgeToShape } from '../shape-clipping.ts'
import { DEFAULTS } from './constants.ts'
import { alignLayerNodes } from './layer-alignment.ts'
import { bundleEdgePaths } from './edge-bundling.ts'
import { straightenTinyJogs } from './jog-straightening.ts'
import { edgesReversedForLayout } from './to-elk.ts'
import {
  extractEdgePoints,
  extractEdgeLabelPosition,
} from './elk-adapter-utils.ts'
import {
  dropInvalidColors,
  groupStyle,
  measureMultilineText,
  resolveNodeStyle,
} from '@zombie-mermaid/core'

/** Margin routing info for cross-hierarchy edges */
interface MarginInfo {
  leftX: number
  rightX: number
}

// ============================================================================
// Self-loop synthesis
//
// ELK has no native self-loop layout — to-elk.ts excludes edges where
// `source === target` from the graph it hands to ELK entirely (see the
// comments in `mermaidToElk`/`subgraphToElk`), so they never reach
// ELK's own edge routing. Once node positions are final, this module
// synthesizes the loop the way mermaid@12.3.0 draws it (#2740): a squared-off
// bulge on the node's LEFT face in TD/BT and its TOP face in LR/RL, never on
// the face the flow leaves through. Measured against mermaid@12.3.0:
//   - the bulge reaches 20px past the face;
//   - for the node's n loops, loop k (0-based, innermost first) attaches at
//     `centre ± g/2` along the face with `g = (faceLength - 24) / (2n + 1) *
//     (2k + 1)`;
//   - a labelled loop pushes the next one out by the label's extent plus 4px,
//     and its label sits 4px outside the apex, centred along the face;
//   - TD/RL loops run start-side to end-side in reading order, BT/RL reversed
//     (TD: top to bottom, BT: bottom to top, LR: left to right, RL: right to
//     left).
// ============================================================================

/** How far past the face the first loop bulges, and the step between loops, in px. */
const SELF_LOOP_REACH = 20
/** Gap between a loop's apex and its label, in px. */
const SELF_LOOP_LABEL_GAP = 4
/** Face length mermaid subtracts before dividing the attach points between loops, in px. */
const SELF_LOOP_FACE_INSET = 24
/** Padding added around a self-loop label's text, matching `simple-layout.ts`. */
const SELF_LOOP_LABEL_PAD = { width: 8, height: 6 }

/**
 * Build the routed points and label position for every self-loop on `node`.
 * `labels[k]` is the size of loop k's label box (undefined when unlabelled).
 */
function buildSelfLoopGeometries(
  node: PositionedNode,
  direction: MermaidGraph['direction'],
  labels: ({ width: number; height: number } | undefined)[],
): { points: Point[]; labelPosition: Point; minX: number; minY: number }[] {
  const vertical =
    direction === 'TD' || direction === 'TB' || direction === 'BT'
  const reversed = direction === 'BT' || direction === 'RL'
  const n = labels.length
  const faceLength = vertical ? node.height : node.width
  const centre = vertical ? node.y + node.height / 2 : node.x + node.width / 2
  const face = vertical ? node.x : node.y
  const unit = Math.max(faceLength - SELF_LOOP_FACE_INSET, 8) / (2 * n + 1)

  let out = 0
  return labels.map((label, k) => {
    out += SELF_LOOP_REACH
    const apex = face - out
    const half = (unit * (2 * k + 1)) / 2
    const [from, to] = reversed
      ? [centre + half, centre - half]
      : [centre - half, centre + half]
    // (across the face, along it) -> (x, y)
    const at = (across: number, along: number): Point =>
      vertical ? { x: across, y: along } : { x: along, y: across }
    // For the shapes `clipEdgeToShape` trims, the legs start at the node's
    // centre line so the clip lands on the real outline (a diamond's loop then
    // reaches its slanted edge, as in mermaid); the rest attach at the face.
    const inside =
      node.shape === 'diamond' || node.shape === 'asymmetric'
        ? face + (vertical ? node.width : node.height) / 2
        : face
    const points = [
      at(inside, from),
      at(apex, from),
      at(apex, to),
      at(inside, to),
    ]
    let labelPosition = at(apex, centre)
    let reach = apex
    if (label) {
      const extent = vertical ? label.width : label.height
      labelPosition = at(apex - SELF_LOOP_LABEL_GAP - extent / 2, centre)
      reach = apex - SELF_LOOP_LABEL_GAP - extent
      out += extent + SELF_LOOP_LABEL_GAP
    }
    // The label's half-size along the face can poke past the node as well.
    const half2 = label ? (vertical ? label.height : label.width) / 2 : 0
    const lo = Math.min(from, to, centre - half2)
    return {
      points,
      labelPosition,
      minX: vertical ? reach : lo,
      minY: vertical ? lo : reach,
    }
  })
}

/**
 * Append a synthesized `PositionedEdge` for every self-loop
 * (`edge.source === edge.target`) in `graph.edges` onto `edges`.
 *
 * Must run after node positions are final (i.e. after `alignLayerNodes`) —
 * the loop geometry is derived directly from the node's laid-out
 * x/y/width/height, so computing it any earlier would have it drift out of
 * sync with a node that layer-alignment later shifts.
 */
export function synthesizeSelfLoopEdges(
  graph: MermaidGraph,
  nodeMap: Map<string, PositionedNode>,
  edges: PositionedEdge[],
  edgeLabelFontSize: number = FONT_SIZES.edgeLabel,
): { minX: number; minY: number } {
  let minX = Infinity
  let minY = Infinity
  const loopsByNode = new Map<string, number[]>()
  graph.edges.forEach((edge, index) => {
    if (edge.source !== edge.target || !nodeMap.has(edge.source)) return
    loopsByNode.set(edge.source, [
      ...(loopsByNode.get(edge.source) ?? []),
      index,
    ])
  })

  for (const [id, indices] of loopsByNode) {
    const node = nodeMap.get(id)!
    const geometries = buildSelfLoopGeometries(
      node,
      graph.direction,
      indices.map((i) => {
        const text = graph.edges[i]!.label
        if (!text) return undefined
        const m = measureMultilineText(
          text,
          edgeLabelFontSize,
          FONT_WEIGHTS.edgeLabel,
        )
        return {
          width: m.width + SELF_LOOP_LABEL_PAD.width,
          height: m.height + SELF_LOOP_LABEL_PAD.height,
        }
      }),
    )
    indices.forEach((index, k) => {
      const edge = graph.edges[index]!
      const { points, labelPosition, ...reach } = geometries[k]!
      minX = Math.min(minX, reach.minX)
      minY = Math.min(minY, reach.minY)
      edges.push({
        source: edge.source,
        target: edge.target,
        label: edge.label,
        style: edge.style,
        hasArrowStart: edge.hasArrowStart,
        hasArrowEnd: edge.hasArrowEnd,
        points,
        labelPosition: edge.label ? labelPosition : undefined,
        inlineStyle: resolveEdgeStyle(index, graph),
        headColor: resolveHeadColor(graph),
        id: edge.id,
        animate: edge.animate,
        startMarker: edge.startMarker,
        endMarker: edge.endMarker,
      })
    })
  }
  return { minX, minY }
}

/** Shift a positioned layout by (dx, dy). */
function shiftLayout(
  nodes: PositionedNode[],
  edges: PositionedEdge[],
  groups: PositionedGroup[],
  dx: number,
  dy: number,
): void {
  const move = (p: Point): void => {
    p.x += dx
    p.y += dy
  }
  for (const n of nodes) move(n)
  for (const e of edges) {
    e.points.forEach(move)
    if (e.labelPosition) move(e.labelPosition)
  }
  const walk = (gs: PositionedGroup[]): void => {
    for (const g of gs) {
      move(g)
      walk(g.children)
    }
  }
  walk(groups)
}

/** Recursively flatten all group bounding boxes (including nested children) */
function flattenGroupBounds(
  groups: PositionedGroup[],
): Array<{ x: number; y: number; right: number; bottom: number }> {
  const bounds: Array<{ x: number; y: number; right: number; bottom: number }> =
    []
  for (const g of groups) {
    bounds.push({
      x: g.x,
      y: g.y,
      right: g.x + g.width,
      bottom: g.y + g.height,
    })
    bounds.push(...flattenGroupBounds(g.children))
  }
  return bounds
}

/**
 * Convert ELK layout result to our PositionedGraph format.
 */
export function elkToPositioned(
  elkResult: ElkNode,
  graph: MermaidGraph,
  mergeEdges: boolean = false,
  edgeLabelFontSize?: number,
): PositionedGraph {
  const nodes: PositionedNode[] = []
  const edges: PositionedEdge[] = []
  const groups: PositionedGroup[] = []

  // Build set of subgraph IDs for distinguishing compound nodes from leaf nodes
  const subgraphIds = new Set<string>()
  for (const sg of graph.subgraphs) {
    collectAllSubgraphIds(sg, subgraphIds)
  }

  // Extract nodes and groups recursively
  extractNodesAndGroups(elkResult, graph, subgraphIds, nodes, groups, 0, 0)

  // Compute margin positions for cross-hierarchy edge routing.
  // Margins sit outside all group bounding boxes so edges don't cross through subgraphs.
  const allBounds = flattenGroupBounds(groups)
  const margins: MarginInfo | undefined =
    allBounds.length > 0
      ? {
          leftX: Math.min(...allBounds.map((b) => b.x)) - 20,
          rightX: Math.max(...allBounds.map((b) => b.right)) + 20,
        }
      : undefined

  // Extract edges recursively from all levels (root and subgraphs)
  // Edges are distributed to subgraphs for direction override to work,
  // so we need to collect them from all children with proper offsets
  extractEdgesRecursively(elkResult, graph, edges, 0, 0, margins)

  // Snap same-layer nodes to the same position along the flow axis.
  // ELK's orthogonal routing staggers nodes within a layer to create room for
  // edge bends, but this looks bad. We fix it by aligning layers, then let
  // edge bundling and clipping recalculate edge paths from corrected positions.
  alignLayerNodes(nodes, edges, graph.direction)

  // Synthesize self-loop edges now that node positions are final. These
  // were excluded from the graph handed to ELK (see to-elk.ts) since ELK
  // has no native self-loop layout; must run after alignLayerNodes so the
  // loop geometry is derived from each node's final, not pre-alignment,
  // position.
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const loopReach = synthesizeSelfLoopEdges(
    graph,
    nodeMap,
    edges,
    edgeLabelFontSize,
  )
  // Loops sit on the left/top face (#2740), which ELK did not reserve room for
  // on the canvas edge: slide the layout over so none is clipped.
  const shiftX = Math.max(0, DEFAULTS.padding - loopReach.minX)
  const shiftY = Math.max(0, DEFAULTS.padding - loopReach.minY)
  if (shiftX > 0 || shiftY > 0) {
    shiftLayout(nodes, edges, groups, shiftX, shiftY)
  }
  // Bundle fan-out/fan-in edge paths into shared trunks when mergeEdges is enabled
  if (mergeEdges) {
    bundleEdgePaths(edges, nodes, groups, graph.direction)
  }

  // Apply shape-aware edge clipping for non-rectangular shapes.
  // ELK treats all nodes as rectangles, so we need to clip edge endpoints
  // to the actual shape boundaries (e.g., diamond vertices).
  for (const edge of edges) {
    edge.points = straightenTinyJogs(edge.points)
    const sourceNode = nodeMap.get(edge.source)
    const targetNode = nodeMap.get(edge.target)

    if (sourceNode) {
      edge.points = clipEdgeToShape(edge.points, sourceNode, true)
    }
    if (targetNode) {
      edge.points = clipEdgeToShape(edge.points, targetNode, false)
    }
  }

  // Calculate final bounds including all edge points
  // ELK should include edges in its dimensions, but we verify and expand if needed
  let width = (elkResult.width ?? 800) + shiftX
  let height = (elkResult.height ?? 600) + shiftY
  const arrowMargin = ARROW_HEAD.width
  const padding = DEFAULTS.padding
  for (const edge of edges) {
    for (const p of edge.points) {
      width = Math.max(width, p.x + arrowMargin + padding)
      height = Math.max(height, p.y + arrowMargin + padding)
    }
    if (edge.labelPosition) {
      width = Math.max(width, edge.labelPosition.x + 60 + padding)
      height = Math.max(height, edge.labelPosition.y + 20 + padding)
    }
  }

  return {
    width,
    height,
    nodes,
    edges,
    groups,
  }
}

/**
 * Recursively extract positioned nodes and groups from ELK result.
 */
function extractNodesAndGroups(
  elkNode: ElkNode,
  graph: MermaidGraph,
  subgraphIds: Set<string>,
  nodes: PositionedNode[],
  groups: PositionedGroup[],
  offsetX: number,
  offsetY: number,
): void {
  if (!elkNode.children) return

  for (const child of elkNode.children) {
    const x = (child.x ?? 0) + offsetX
    const y = (child.y ?? 0) + offsetY
    const width = child.width ?? 0
    const height = child.height ?? 0

    if (subgraphIds.has(child.id)) {
      // This is a subgraph/group
      const childGroups: PositionedGroup[] = []

      // Recursively process children
      extractNodesAndGroups(child, graph, subgraphIds, nodes, childGroups, x, y)

      const mermaidSg = findSubgraph(graph.subgraphs, child.id)
      groups.push({
        id: child.id,
        label: mermaidSg?.label ?? '',
        x,
        y,
        width,
        height,
        children: childGroups,
        ...groupStyle(child.id, graph),
        ...(mermaidSg?.region ? { region: true } : {}),
        ...(mermaidSg?.icon ? { icon: mermaidSg.icon } : {}),
      })
    } else {
      // This is a leaf node
      const mNode = graph.nodes.get(child.id)
      if (mNode) {
        // Resolve inline styles from nodeStyles map and classDefs
        const inlineStyle = resolveNodeStyle(child.id, graph)
        // Custom class name from `class A className` or `:::className` —
        // tracked separately from inlineStyle so it's still emitted onto the
        // rendered element even when the class has no matching classDef.
        const className = graph.classAssignments.get(child.id)

        nodes.push({
          id: child.id,
          label: mNode.label,
          shape: mNode.icon === undefined ? mNode.shape : 'rectangle',
          icon: mNode.icon,
          x,
          y,
          width,
          height,
          inlineStyle,
          className,
          interaction: graph.interactions.get(child.id),
        })
      }

      // Also check for nested children (shouldn't happen for leaf nodes, but be safe)
      if (child.children && child.children.length > 0) {
        extractNodesAndGroups(child, graph, subgraphIds, nodes, groups, x, y)
      }
    }
  }
}

/**
 * Edge segment extracted from ELK result.
 * Used to combine the bridge and hop segments of a decomposed
 * cross-hierarchy edge back into one continuous path.
 */
interface EdgeSegment {
  edgeIndex: number
  points: Point[]
  labelPosition?: Point
}

/**
 * All segments belonging to one original edge, keyed by role:
 *  - `bridge`: the sub-edge at the lowest common ancestor of source/target
 *    (id `e{index}`) — the only segment for edges that don't cross a
 *    subgraph boundary at all.
 *  - `sourceHops`: source-side boundary crossings (id `e{index}_s{level}`),
 *    keyed by ancestor-chain level. Walking from the innermost level
 *    (closest to the source node) outward to the LCA.
 *  - `targetHops`: target-side boundary crossings (id `e{index}_t{level}`),
 *    keyed by ancestor-chain level. Walking from the LCA inward to the
 *    innermost level (closest to the target node).
 * See packages/svg-renderer/src/layout-engine/to-elk.ts (mermaidToElk) for how these are produced.
 */
interface EdgeSegmentGroup {
  bridge?: EdgeSegment
  sourceHops: Map<number, EdgeSegment>
  targetHops: Map<number, EdgeSegment>
}

/** Parses an ELK edge id produced by the cross-hierarchy decomposition in to-elk.ts. */
function parseHopEdgeId(
  id: string,
):
  | { edgeIndex: number; role: 'bridge' }
  | { edgeIndex: number; role: 'source' | 'target'; level: number }
  | undefined {
  const bridgeMatch = /^e(\d+)$/.exec(id)
  if (bridgeMatch) {
    return { edgeIndex: parseInt(bridgeMatch[1]!, 10), role: 'bridge' }
  }
  const hopMatch = /^e(\d+)_([st])(\d+)$/.exec(id)
  if (hopMatch) {
    return {
      edgeIndex: parseInt(hopMatch[1]!, 10),
      role: hopMatch[2] === 's' ? 'source' : 'target',
      level: parseInt(hopMatch[3]!, 10),
    }
  }
  return undefined
}

/**
 * Calculate the midpoint along a polyline path.
 * Walks the path to find the point at half the total length.
 */
function calculatePathMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]!

  // Calculate total length
  let totalLength = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x
    const dy = points[i]!.y - points[i - 1]!.y
    totalLength += Math.sqrt(dx * dx + dy * dy)
  }

  // Walk to halfway point
  let remaining = totalLength / 2
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x
    const dy = points[i]!.y - points[i - 1]!.y
    const segLen = Math.sqrt(dx * dx + dy * dy)
    if (remaining <= segLen) {
      const t = remaining / segLen
      return {
        x: points[i - 1]!.x + t * dx,
        y: points[i - 1]!.y + t * dy,
      }
    }
    remaining -= segLen
  }

  return points[points.length - 1]!
}

/**
 * Recursively extract edges from ELK result including those inside subgraphs.
 * Edges are distributed to subgraphs for direction override to work,
 * so we need to collect them from all levels with proper coordinate offsets.
 *
 * For hierarchical edges (cross-hierarchy with ports), combines external and
 * internal segments into a single continuous edge path.
 */
function extractEdgesRecursively(
  elkNode: ElkNode,
  graph: MermaidGraph,
  edges: PositionedEdge[],
  offsetX: number,
  offsetY: number,
  margins?: MarginInfo,
): void {
  // First pass: collect all edge segments.
  //
  // Under `hierarchyHandling: INCLUDE_CHILDREN` (see to-elk.ts — used when no
  // subgraph has a direction override), ELK is free to leave a
  // cross-hierarchy edge in an *ancestor* node's `edges` array while
  // reporting its sections/labels in the coordinate space of the deeper
  // container named by the edge's own (untyped-in-elkjs) `container`
  // property. `collectEdgeSegments`'s tree walk assumes an edge's
  // coordinates match the array it was found in, which breaks for exactly
  // this case — the edge lands at the *ancestor's* offset instead of the
  // declared container's, shifting nested-subgraph edges/labels off their
  // node boundaries toward the root. Pre-computing every container's
  // accumulated root offset here lets `collectEdgeSegments` prefer the
  // edge's declared container when present, falling back to the owning
  // array's offset (the previous behavior) otherwise — see
  // zombie-mermaid#1145, ported from a fix by Galen Suen in
  // lukilabs/beautiful-mermaid#152.
  const containerOffsets = new Map<string, Point>()
  collectContainerOffsets(elkNode, containerOffsets, 0, 0)
  const segments = new Map<number, EdgeSegmentGroup>()
  collectEdgeSegments(elkNode, segments, 0, 0, containerOffsets)

  // Track margin-routed edge count for spacing offsets
  let marginEdgeIndex = 0

  // Second pass: combine segments and create positioned edges
  for (const [edgeIndex, seg] of segments) {
    const originalEdge = graph.edges[edgeIndex]
    if (!originalEdge) continue
    // A self-loop sent to ELK only to shape the layout; its loop is synthesized.
    if (originalEdge.source === originalEdge.target) continue

    // Combine points from all segments in path order:
    //   source-side hops (innermost → outermost, i.e. descending level)
    //   → bridge (the sub-edge at the lowest common ancestor)
    //   → target-side hops (outermost → innermost, i.e. ascending level)
    // Edges that don't cross any subgraph boundary have only a bridge
    // segment. Edges crossing exactly one boundary have a bridge plus a
    // single hop on one side — this is the shape the previous single-hop
    // implementation always produced. Deeper nesting simply adds more hops
    // on either side, each joined at the shared boundary point.
    const allPoints: Point[] = []
    const appendSegment = (segment: EdgeSegment | undefined): void => {
      if (!segment || segment.points.length === 0) return
      if (allPoints.length > 0) {
        // Skip first point to avoid duplicating the shared boundary point.
        allPoints.push(...segment.points.slice(1))
      } else {
        allPoints.push(...segment.points)
      }
    }

    const sourceLevels = [...seg.sourceHops.keys()].sort((a, b) => b - a)
    for (const level of sourceLevels) appendSegment(seg.sourceHops.get(level))
    appendSegment(seg.bridge)
    const targetLevels = [...seg.targetHops.keys()].sort((a, b) => a - b)
    for (const level of targetLevels) appendSegment(seg.targetHops.get(level))

    // Label position: use ELK's inline label position (on-edge with collision avoidance)
    // Fall back to midpoint for hierarchical edges or when ELK position unavailable
    let labelPosition: Point | undefined
    if (originalEdge.label && allPoints.length >= 2) {
      const elkLabelPos = seg.bridge?.labelPosition
      labelPosition = elkLabelPos ?? calculatePathMidpoint(allPoints)
    }

    // Ensure all edge segments are orthogonal (horizontal or vertical only).
    // In SEPARATE hierarchy mode, ELK may produce diagonal segments for
    // cross-hierarchy edges where it only returns start/end points without
    // proper orthogonal bend points.
    // When margins are available, route through the diagram margins instead
    // of Z-paths through the middle (which cross through subgraphs).
    const orthogonalPoints = orthogonalizeEdgePoints(
      allPoints,
      margins,
      marginEdgeIndex,
    )
    if (orthogonalPoints !== allPoints) {
      marginEdgeIndex++
    }

    // Recalculate label position for margin-routed edges
    if (
      originalEdge.label &&
      orthogonalPoints !== allPoints &&
      orthogonalPoints.length >= 2
    ) {
      labelPosition = calculatePathMidpoint(orthogonalPoints)
    }

    edges.push({
      source: originalEdge.source,
      target: originalEdge.target,
      label: originalEdge.label,
      style: originalEdge.style,
      hasArrowStart: originalEdge.hasArrowStart,
      hasArrowEnd: originalEdge.hasArrowEnd,
      // An edge laid out reversed (see `edgesReversedForLayout`) comes back
      // running target to source; flip it so it runs source to target again.
      points: edgesReversedForLayout(graph).has(edgeIndex)
        ? [...orthogonalPoints].reverse()
        : orthogonalPoints,
      labelPosition,
      inlineStyle: resolveEdgeStyle(edgeIndex, graph),
      headColor: resolveHeadColor(graph),
      id: originalEdge.id,
      animate: originalEdge.animate,
      startMarker: originalEdge.startMarker,
      endMarker: originalEdge.endMarker,
    })
  }
}

/**
 * Build a map from every ELK node's own id to its accumulated root-relative
 * offset, by walking the same `elkNode.children` tree `collectEdgeSegments`
 * walks. Used to resolve a cross-hierarchy edge's declared `container`
 * (an ELK output property not modeled in elkjs's types) to the offset of
 * the container ELK actually reported its coordinates in, rather than the
 * offset of whichever ancestor array the edge object happened to be left
 * in — see the comment on `extractEdgesRecursively`'s call site.
 */
function collectContainerOffsets(
  elkNode: ElkNode,
  offsets: Map<string, Point>,
  offsetX: number,
  offsetY: number,
): void {
  offsets.set(elkNode.id, { x: offsetX, y: offsetY })
  for (const child of elkNode.children ?? []) {
    // `x`/`y` are optional in elkjs's types, but ELK always assigns both to
    // every laid-out child node — the `?? 0` fallback mirrors the same
    // defensive pattern already used for this walk in `collectEdgeSegments`
    // below, and is equally unreachable from real ELK output.
    /* v8 ignore next */
    const childX = child.x ?? 0
    /* v8 ignore next */
    const childY = child.y ?? 0
    collectContainerOffsets(child, offsets, offsetX + childX, offsetY + childY)
  }
}

/**
 * Post-process edge points to ensure all segments are purely orthogonal.
 *
 * When ELK uses SEPARATE hierarchy handling (required for subgraph direction
 * overrides), cross-hierarchy edges may only get start/end coordinates without
 * intermediate bend points, producing diagonal lines.
 *
 * When margins are provided, routes diagonal segments through the left or right
 * margin of the diagram (outside all subgraphs). Alternates sides and adds
 * spacing offsets to prevent overlapping parallel edges.
 *
 * Without margins, falls back to Z-path through the vertical midpoint.
 *
 * Returns the original array reference (identity) if no changes were needed,
 * so callers can detect whether routing was applied.
 */
function orthogonalizeEdgePoints(
  points: Point[],
  margins?: MarginInfo,
  edgeIndex: number = 0,
): Point[] {
  if (points.length < 2) return points

  // Check if any segment needs orthogonalization
  let needsWork = false
  for (let i = 1; i < points.length; i++) {
    const dx = Math.abs(points[i]!.x - points[i - 1]!.x)
    const dy = Math.abs(points[i]!.y - points[i - 1]!.y)
    if (dx > 1 && dy > 1) {
      needsWork = true
      break
    }
  }
  if (!needsWork) return points

  const EDGE_SPACING = 12
  const result: Point[] = [points[0]!]

  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1]!
    const curr = points[i]!
    const dx = Math.abs(curr.x - prev.x)
    const dy = Math.abs(curr.y - prev.y)

    if (dx > 1 && dy > 1) {
      if (margins) {
        // Margin routing: exit horizontally → travel vertically along margin → enter horizontally
        // Alternate left/right margins and offset for parallel edge spacing
        const useRight = edgeIndex % 2 === 0
        const offset = Math.floor(edgeIndex / 2) * EDGE_SPACING
        const marginX = useRight
          ? margins.rightX + offset
          : margins.leftX - offset

        result.push({ x: marginX, y: prev.y })
        result.push({ x: marginX, y: curr.y })
      } else {
        // Fallback: Z-path through vertical midpoint
        const midY = (prev.y + curr.y) / 2
        result.push({ x: prev.x, y: midY })
        result.push({ x: curr.x, y: midY })
      }
    }

    result.push(curr)
  }

  return result
}

/**
 * Recursively collect edge segments from ELK result.
 */
function collectEdgeSegments(
  elkNode: ElkNode,
  segments: Map<number, EdgeSegmentGroup>,
  offsetX: number,
  offsetY: number,
  containerOffsets: Map<string, Point>,
): void {
  if (elkNode.edges) {
    for (const elkEdge of elkNode.edges) {
      // Parse edge ID: "e{index}" (bridge), "e{index}_s{level}" (source-side
      // hop), or "e{index}_t{level}" (target-side hop) — see to-elk.ts.
      const parsed = parseHopEdgeId(elkEdge.id)
      if (!parsed) continue
      const { edgeIndex } = parsed

      // Prefer the edge's declared container offset (see
      // `collectContainerOffsets`'s comment) over the owning array's
      // offset. `container` and `containerOffsets.get(container)` were
      // verified (by direct instrumentation against real elk.bundled.js
      // output, across both flat and multiply-nested subgraphs) to always
      // be defined in practice — ELK tags every edge with its container,
      // even at the root, and `collectContainerOffsets` walks the same
      // tree so every container id it can name is already in the map. The
      // `container?`/`?? offset{X,Y}` fallbacks below exist only because
      // `container` is untyped in elkjs and `Map.get` is typed to allow a
      // miss; kept as defensive narrowing rather than assumed impossible.
      const container = (elkEdge as ElkExtendedEdge & { container?: string })
        .container
      /* v8 ignore next */
      const containerOffset = container
        ? containerOffsets.get(container)
        : undefined
      /* v8 ignore next */
      const edgeOffsetX = containerOffset?.x ?? offsetX
      /* v8 ignore next */
      const edgeOffsetY = containerOffset?.y ?? offsetY

      // Extract points and label position
      const points = extractEdgePoints(elkEdge, edgeOffsetX, edgeOffsetY)
      const labelPosition = extractEdgeLabelPosition(
        elkEdge,
        edgeOffsetX,
        edgeOffsetY,
      )

      // Store segment
      const seg: EdgeSegmentGroup = segments.get(edgeIndex) ?? {
        sourceHops: new Map(),
        targetHops: new Map(),
      }
      segments.set(edgeIndex, seg)
      const segment: EdgeSegment = { edgeIndex, points, labelPosition }

      if (parsed.role === 'bridge') {
        seg.bridge = segment
      } else if (parsed.role === 'source') {
        seg.sourceHops.set(parsed.level, segment)
      } else {
        seg.targetHops.set(parsed.level, segment)
      }
    }
  }

  // Recurse into children with accumulated offset
  if (elkNode.children) {
    for (const child of elkNode.children) {
      collectEdgeSegments(
        child,
        segments,
        offsetX + (child.x ?? 0),
        offsetY + (child.y ?? 0),
        containerOffsets,
      )
    }
  }
}

/** Find a subgraph by ID in a nested structure */
function findSubgraph(
  subgraphs: MermaidSubgraph[],
  id: string,
): MermaidSubgraph | undefined {
  for (const sg of subgraphs) {
    if (sg.id === id) return sg
    const found = findSubgraph(sg.children, id)
    if (found) return found
  }
  return undefined
}

/** Recursively collect all subgraph IDs */
function collectAllSubgraphIds(sg: MermaidSubgraph, out: Set<string>): void {
  out.add(sg.id)
  for (const child of sg.children) {
    collectAllSubgraphIds(child, out)
  }
}

/**
 * Resolve inline styles for an edge from linkStyles map.
 * Default link style is applied first, then index-specific overrides.
 * Invalid colours are dropped, as for nodes (#1918).
 */
/** Stroke of `linkStyle default`, the only colour mermaid gives arrowheads. */
export function resolveHeadColor(graph: MermaidGraph): string | undefined {
  return resolveEdgeStyle(-1, graph)?.stroke
}

export function resolveEdgeStyle(
  edgeIndex: number,
  graph: MermaidGraph,
): Record<string, string> | undefined {
  let result: Record<string, string> | undefined

  const defaultStyle = graph.linkStyles.get('default')
  if (defaultStyle) {
    result = { ...defaultStyle }
  }

  const indexStyle = graph.linkStyles.get(edgeIndex)
  if (indexStyle) {
    result = result ? { ...result, ...indexStyle } : { ...indexStyle }
  }

  return result && dropInvalidColors(result)
}
