/**
 * Layer alignment — snap same-layer nodes to a uniform position.
 * Split out of layout-engine.ts as a self-contained post-processing pass
 * over a PositionedGraph's nodes/edges.
 */

import type {
  PositionedNode,
  PositionedEdge,
  PositionedGroup,
  Direction,
} from '@zombie-mermaid/core'
import { DEFAULTS } from './constants.ts'

/**
 * ELK's orthogonal edge routing staggers nodes within the same layer to create
 * space for edge bends. This post-processing step groups nodes into layers and
 * snaps them to the same flow-axis coordinate (Y for TD/TB, X for LR/RL).
 *
 * Grouping uses proximity along the flow axis: within a layer, ELK's stagger
 * is always less than layerSpacing (bounded by edge routing channels), while
 * adjacent layers are separated by at least layerSpacing + nodeHeight.
 * A threshold of 0.75 * layerSpacing cleanly separates these cases.
 *
 * Directly connected nodes (sharing an edge) are never merged into the same
 * layer group as an additional safety check.
 *
 * Edge endpoints connected to shifted nodes are adjusted proportionally.
 * Intermediate bend points are left unchanged — edge bundling or clipping
 * will recalculate them afterwards.
 */
// Audited for issue #100 (non-null assertions): every `!` in this file is
// a bounds-checked array access, each backed by an explicit check earlier
// in the same scope — `sorted[0]!` and the `sorted[i]!`/`sorted[i - 1]!`
// loop-index accesses below are guaranteed by the `nodes.length === 0`
// early return plus the `for (let i = 1; i < sorted.length; ...)` loop
// bound; `edge.points[0]!`, `edge.points[1]!`, and the
// `edge.points[edge.points.length - 1]!` / `[edge.points.length - 2]!`
// pairs are guaranteed by the `edge.points.length < 2` early `continue`
// (and, redundantly, the `edge.points.length > 1` checks right above each
// access). This is the same idiom already accepted as justified elsewhere
// in this codebase (see src/parser.ts, PR #158, and this directory's
// edge-bundling.ts/from-elk.ts audit, PR #150, which didn't reach this
// file). `noUncheckedIndexedAccess` can't see any of these guarantees,
// but removing the `!` would only replace a proven-safe assertion with an
// unreachable guard. Left as-is; no behavior change.
export function alignLayerNodes(
  nodes: PositionedNode[],
  edges: PositionedEdge[],
  direction: Direction,
): void {
  if (nodes.length === 0) return

  const isHorizontal = direction === 'LR' || direction === 'RL'

  // Build set of directly-connected node pairs.
  // Nodes connected by an edge must not be merged into the same layer.
  const connectedPairs = new Set<string>()
  for (const edge of edges) {
    connectedPairs.add(`${edge.source}:${edge.target}`)
    connectedPairs.add(`${edge.target}:${edge.source}`)
  }

  // ELK's stagger creates small gaps between adjacent nodes in the same layer
  // (typically edgeEdge spacing = 12px per routing channel). Adjacent layers
  // are separated by at least layerSpacing (48px). We use single-linkage
  // clustering: a node joins the current layer if the gap from the previous
  // node (in sorted order) is within threshold, AND it has no direct edge to
  // any node already in the layer.
  const THRESHOLD = DEFAULTS.layerSpacing * 0.6

  // Sort nodes by flow-axis position
  const sorted = [...nodes].sort((a, b) =>
    isHorizontal ? a.x - b.x : a.y - b.y,
  )

  const layers: PositionedNode[][] = []
  let currentLayer: PositionedNode[] = [sorted[0]!]

  for (let i = 1; i < sorted.length; i++) {
    const pos = isHorizontal ? sorted[i]!.x : sorted[i]!.y
    const prevPos = isHorizontal ? sorted[i - 1]!.x : sorted[i - 1]!.y
    // Single-linkage: compare with previous node, not layer start
    const gap = pos - prevPos
    // Check if this node is connected to any node already in the current layer
    const hasEdgeToLayer = currentLayer.some((n) =>
      connectedPairs.has(`${n.id}:${sorted[i]!.id}`),
    )
    if (gap <= THRESHOLD && !hasEdgeToLayer) {
      currentLayer.push(sorted[i]!)
    } else {
      layers.push(currentLayer)
      currentLayer = [sorted[i]!]
    }
  }
  layers.push(currentLayer)

  // Snap each layer's nodes to the layer's center position
  const deltas = new Map<string, number>() // nodeId → shift amount

  for (const layer of layers) {
    if (layer.length <= 1) continue

    const positions = layer.map((n) => (isHorizontal ? n.x : n.y))
    const min = Math.min(...positions)
    const max = Math.max(...positions)
    if (max - min <= 1) continue // Already aligned

    // Use the center of the range as the snap target
    const target = (min + max) / 2

    for (const node of layer) {
      const oldPos = isHorizontal ? node.x : node.y
      const delta = target - oldPos
      if (Math.abs(delta) > 0.5) {
        if (isHorizontal) {
          node.x = target
        } else {
          node.y = target
        }
        deltas.set(node.id, delta)
      }
    }
  }

  shiftEdgeEnds(edges, deltas, isHorizontal)
}

/**
 * Centre each node on the group it sits beside along the flow axis (#1699).
 * ELK bottom-aligns a small node (`X`) in a layer next to a taller flipped
 * group; mermaid.js centres it on the group's row of nodes (`center`).
 */
export function centerBesideGroups(
  nodes: PositionedNode[],
  edges: PositionedEdge[],
  groups: Array<{ group: PositionedGroup; center: number }>,
  direction: Direction,
): void {
  const isHorizontal = direction === 'LR' || direction === 'RL'
  const deltas = new Map<string, number>()
  for (const node of nodes) {
    const start = isHorizontal ? node.x : node.y
    const size = isHorizontal ? node.width : node.height
    for (const { group: g, center } of groups) {
      const gStart = isHorizontal ? g.x : g.y
      const gSize = isHorizontal ? g.width : g.height
      // Only a node whose whole band lies inside the group's band
      if (start < gStart - 0.5 || start + size > gStart + gSize + 0.5) continue
      const delta = center - (start + size / 2)
      if (Math.abs(delta) <= 0.5) break
      if (isHorizontal) node.x += delta
      else node.y += delta
      deltas.set(node.id, delta)
      break
    }
  }
  shiftEdgeEnds(edges, deltas, isHorizontal)
}

/** Move the endpoints of edges attached to nodes shifted by `deltas`. */
function shiftEdgeEnds(
  edges: PositionedEdge[],
  deltas: Map<string, number>,
  isHorizontal: boolean,
): void {
  if (deltas.size === 0) return
  for (const edge of edges) {
    if (edge.points.length < 2) continue

    const srcDelta = deltas.get(edge.source)
    const tgtDelta = deltas.get(edge.target)

    if (srcDelta != null) {
      // Shift first point and any subsequent points in the initial vertical/horizontal run
      const first = edge.points[0]!
      if (isHorizontal) {
        first.x += srcDelta
        // Shift second point if it's part of a straight vertical exit
        if (
          edge.points.length > 1 &&
          edge.points[1]!.x === first.x - srcDelta
        ) {
          edge.points[1]!.x += srcDelta
        }
      } else {
        first.y += srcDelta
        if (
          edge.points.length > 1 &&
          edge.points[1]!.y === first.y - srcDelta
        ) {
          edge.points[1]!.y += srcDelta
        }
      }
    }

    if (tgtDelta != null) {
      const last = edge.points[edge.points.length - 1]!
      if (isHorizontal) {
        last.x += tgtDelta
        if (edge.points.length > 1) {
          const prev = edge.points[edge.points.length - 2]!
          if (prev.x === last.x - tgtDelta) prev.x += tgtDelta
        }
      } else {
        last.y += tgtDelta
        if (edge.points.length > 1) {
          const prev = edge.points[edge.points.length - 2]!
          if (prev.y === last.y - tgtDelta) prev.y += tgtDelta
        }
      }
    }
  }
}
