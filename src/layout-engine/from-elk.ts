/**
 * Result conversion: ELK output → PositionedGraph.
 *
 * Split out of layout-engine.ts. This module handles turning ELK's layout
 * result back into our PositionedGraph format, including the post-processing
 * passes (layer alignment, edge bundling, shape-aware clipping) that clean
 * up ELK's raw output.
 */

import type { ElkNode } from 'elkjs'
import type {
  MermaidGraph,
  MermaidSubgraph,
  PositionedGraph,
  PositionedNode,
  PositionedEdge,
  PositionedGroup,
  Point,
} from '../types.ts'
import { ARROW_HEAD } from '../styles.ts'
import { clipEdgeToShape } from '../shape-clipping.ts'
import { DEFAULTS } from './constants.ts'
import { alignLayerNodes } from './layer-alignment.ts'
import { bundleEdgePaths } from './edge-bundling.ts'

/** Margin routing info for cross-hierarchy edges */
interface MarginInfo {
  leftX: number
  rightX: number
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

  // Bundle fan-out/fan-in edge paths into shared trunks when mergeEdges is enabled
  if (mergeEdges) {
    bundleEdgePaths(edges, nodes, groups, graph.direction)
  }

  // Apply shape-aware edge clipping for non-rectangular shapes.
  // ELK treats all nodes as rectangles, so we need to clip edge endpoints
  // to the actual shape boundaries (e.g., diamond vertices).
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  for (const edge of edges) {
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
  let width = elkResult.width ?? 800
  let height = elkResult.height ?? 600
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
          shape: mNode.shape,
          x,
          y,
          width,
          height,
          inlineStyle,
          className,
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
 * See src/layout-engine/to-elk.ts (mermaidToElk) for how these are produced.
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
  // First pass: collect all edge segments
  const segments = new Map<number, EdgeSegmentGroup>()
  collectEdgeSegments(elkNode, segments, 0, 0)

  // Track margin-routed edge count for spacing offsets
  let marginEdgeIndex = 0

  // Second pass: combine segments and create positioned edges
  for (const [edgeIndex, seg] of segments) {
    const originalEdge = graph.edges[edgeIndex]
    if (!originalEdge) continue

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
      points: orthogonalPoints,
      labelPosition,
      inlineStyle: resolveEdgeStyle(edgeIndex, graph),
    })
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
): void {
  if (elkNode.edges) {
    for (const elkEdge of elkNode.edges) {
      // Parse edge ID: "e{index}" (bridge), "e{index}_s{level}" (source-side
      // hop), or "e{index}_t{level}" (target-side hop) — see to-elk.ts.
      const parsed = parseHopEdgeId(elkEdge.id)
      if (!parsed) continue
      const { edgeIndex } = parsed

      // Extract points
      const points: Point[] = []
      if (elkEdge.sections && elkEdge.sections.length > 0) {
        const section = elkEdge.sections[0]!
        points.push({
          x: section.startPoint.x + offsetX,
          y: section.startPoint.y + offsetY,
        })
        if (section.bendPoints) {
          for (const bp of section.bendPoints) {
            points.push({ x: bp.x + offsetX, y: bp.y + offsetY })
          }
        }
        points.push({
          x: section.endPoint.x + offsetX,
          y: section.endPoint.y + offsetY,
        })
      }

      // Extract label position
      let labelPosition: Point | undefined
      if (elkEdge.labels && elkEdge.labels.length > 0) {
        const label = elkEdge.labels[0]!
        if (label.x != null && label.y != null) {
          labelPosition = {
            x: label.x + (label.width ?? 0) / 2 + offsetX,
            y: label.y + (label.height ?? 0) / 2 + offsetY,
          }
        }
      }

      // Store segment
      if (!segments.has(edgeIndex)) {
        segments.set(edgeIndex, {
          sourceHops: new Map(),
          targetHops: new Map(),
        })
      }
      const seg = segments.get(edgeIndex)!
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
 * Resolve inline styles for a node from classDefs and nodeStyles.
 * Class styles are applied first, then explicit style directives override.
 */
function resolveNodeStyle(
  nodeId: string,
  graph: MermaidGraph,
): Record<string, string> | undefined {
  let result: Record<string, string> | undefined

  // First, apply class styles (if node has a class assignment)
  const className = graph.classAssignments.get(nodeId)
  if (className) {
    const classDef = graph.classDefs.get(className)
    if (classDef) {
      result = { ...classDef }
    }
  }

  // Then, apply explicit style directives (override class styles)
  const nodeStyle = graph.nodeStyles.get(nodeId)
  if (nodeStyle) {
    result = result ? { ...result, ...nodeStyle } : { ...nodeStyle }
  }

  return result
}

/**
 * Resolve inline styles for an edge from linkStyles map.
 * Default link style is applied first, then index-specific overrides.
 */
function resolveEdgeStyle(
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

  return result
}
