// ============================================================================
// ASCII renderer — edge bundling for parallel links
//
// Analyzes edges to find parallel links (A & B --> C or A --> B & C) and
// groups them into bundles. Bundled edges share a visual junction point
// where they merge/split, creating cleaner diagrams.
//
// This module provides:
//   - analyzeEdgeBundles(): Finds and creates bundles from graph edges
//   - calculateJunctionPoint(): Computes optimal merge/split locations
//   - routeBundledEdges(): Routes edges through junction points
// ============================================================================

import type {
  AsciiGraph,
  AsciiNode,
  AsciiEdge,
  EdgeBundle,
  GridCoord,
  CardinalDirection,
} from './types.ts'
import {
  Up,
  Down,
  Left,
  Right,
  Middle,
  gridCoordDirection,
  requireCardinalDirection,
} from './types.ts'
import { getNodeSubgraph, requireGridCoord } from './grid.ts'
import { routeEdge } from './pathfinder.ts'

// ============================================================================
// Bundle analysis
// ============================================================================

/**
 * Analyze graph edges and create bundles for parallel links.
 *
 * Groups edges by:
 * - Fan-in: Multiple edges sharing the same target (A & B --> C)
 * - Fan-out: Multiple edges sharing the same source (A --> B & C)
 *
 * Only creates bundles when:
 * - Graph direction is TD (top-down) - LR routing handles merging naturally
 * - 2+ edges share the endpoint
 * - All edges have the same style (solid/dotted/thick)
 * - None of the edges have labels (labels would overlap at junction)
 * - Edges are not self-loops
 *
 * @returns Array of bundles. Each edge can belong to at most one bundle.
 */
export function analyzeEdgeBundles(graph: AsciiGraph): EdgeBundle[] {
  // Only bundle in TD direction - LR routing handles merging naturally at corners
  if (graph.config.graphDirection !== 'TD') {
    return []
  }
  const bundles: EdgeBundle[] = []
  const bundledEdges = new Set<AsciiEdge>()

  // Group edges by target (fan-in candidates)
  const edgesByTarget = new Map<AsciiNode, AsciiEdge[]>()
  for (const edge of graph.edges) {
    // Skip self-loops
    if (edge.from === edge.to) continue

    const existing = edgesByTarget.get(edge.to) ?? []
    existing.push(edge)
    edgesByTarget.set(edge.to, existing)
  }

  // Create fan-in bundles
  for (const [target, edges] of edgesByTarget) {
    if (edges.length < 2) continue
    if (!canBundle(edges, graph)) continue

    // Check if all edges are already bundled
    if (edges.some((e) => bundledEdges.has(e))) continue

    const bundle: EdgeBundle = {
      type: 'fan-in',
      edges: [...edges],
      sharedNode: target,
      otherNodes: edges.map((e) => e.from),
      junctionPoint: null,
      sharedPath: [],
      junctionDir: Middle,
      sharedNodeDir: Middle,
    }

    // Mark edges as bundled
    for (const edge of edges) {
      edge.bundle = bundle
      bundledEdges.add(edge)
    }

    bundles.push(bundle)
  }

  // Group edges by source (fan-out candidates)
  const edgesBySource = new Map<AsciiNode, AsciiEdge[]>()
  for (const edge of graph.edges) {
    // Skip self-loops and already bundled edges
    if (edge.from === edge.to) continue
    if (bundledEdges.has(edge)) continue

    const existing = edgesBySource.get(edge.from) ?? []
    existing.push(edge)
    edgesBySource.set(edge.from, existing)
  }

  // Create fan-out bundles
  for (const [source, edges] of edgesBySource) {
    if (edges.length < 2) continue
    if (!canBundle(edges, graph)) continue

    const bundle: EdgeBundle = {
      type: 'fan-out',
      edges: [...edges],
      sharedNode: source,
      otherNodes: edges.map((e) => e.to),
      junctionPoint: null,
      sharedPath: [],
      junctionDir: Middle,
      sharedNodeDir: Middle,
    }

    // Mark edges as bundled
    for (const edge of edges) {
      edge.bundle = bundle
      bundledEdges.add(edge)
    }

    bundles.push(bundle)
  }

  return bundles
}

/**
 * Check if a group of edges can be bundled together.
 * Returns false if edges have different styles, any have labels,
 * or if the edges span subgraph boundaries (which creates complex routing).
 */
function canBundle(edges: AsciiEdge[], graph: AsciiGraph): boolean {
  if (edges.length < 2) return false

  const firstStyle = edges[0]!.style
  const firstFromSg = getNodeSubgraph(graph, edges[0]!.from)
  const firstToSg = getNodeSubgraph(graph, edges[0]!.to)

  for (const edge of edges) {
    // Different styles can't be bundled (would look confusing)
    if (edge.style !== firstStyle) return false

    // Edges with labels can't be bundled (labels would overlap at junction)
    if (edge.text.length > 0) return false

    // Don't bundle if edges span different subgraph boundaries
    // (creates complex routing that doesn't look good)
    const fromSg = getNodeSubgraph(graph, edge.from)
    const toSg = getNodeSubgraph(graph, edge.to)
    if (fromSg !== firstFromSg || toSg !== firstToSg) return false

    // Don't bundle if source and target are in different subgraphs
    // (cross-boundary edges have special routing needs)
    if (fromSg !== toSg) return false
  }

  // A group formed by shared-target (fan-in) or shared-source (fan-out)
  // grouping can still contain two edges that ALSO share the other
  // endpoint — true parallel/multi-edges (e.g. two unlabeled `A --> B`
  // edges), not a genuine fan-in/fan-out. Folding those into one shared
  // trunk+junction would visually merge them into a single line (the same
  // "second edge silently wins" defect this bundling feature is supposed
  // to avoid — see #329), rather than the distinct offset lanes
  // assignParallelEdgeLanes (edge-routing.ts) already gives them. Detect it
  // generically: the group is fan-in (shared `.to`) or fan-out (shared
  // `.from`) by construction (see analyzeEdgeBundles' two call sites), so
  // checking whichever endpoint *isn't* uniformly shared for duplicates
  // catches both cases without the caller having to say which one it is.
  const sameTarget = edges.every((e) => e.to === edges[0]!.to)
  const otherEndpoints = sameTarget
    ? edges.map((e) => e.from)
    : edges.map((e) => e.to)
  if (new Set(otherEndpoints).size !== otherEndpoints.length) return false

  // Bundling assumes every source sits strictly before the shared target
  // along the graph-direction axis for fan-in (TD: above it; LR: left of
  // it), or every target sits strictly after the shared source for
  // fan-out — calculateJunctionPoint places the junction on that side of
  // the shared node and routeBundledEdges exits/enters it accordingly. The
  // grid layout can violate that: a node's rank gets pinned by whichever
  // incoming edge's source is placed first (placeReachableChildren in
  // grid.ts never revisits an already-placed node), so a "diamond" like
  // `Queue --> Worker` plus `Queue --> Retry --> Worker` can leave Worker
  // at the SAME rank as Retry instead of one rank after it (#454).
  // Bundling that pair would route Retry's edge through the same
  // trunk+arrowhead as Queue's, silently swallowing Retry's own arrowhead
  // into a line that looks like it belongs solely to Queue. Refuse to
  // bundle whenever any edge doesn't actually satisfy the "before the
  // target" / "after the source" assumption; routed independently instead,
  // it gets its own distinct, visible arrowhead into/out of the shared node.
  const axis: 'x' | 'y' = graph.config.graphDirection === 'LR' ? 'x' : 'y'
  const sharedNode = sameTarget ? edges[0]!.to : edges[0]!.from
  const sharedCoord = sharedNode.gridCoord
  if (!sharedCoord) return false
  for (const edge of edges) {
    const otherNode = sameTarget ? edge.from : edge.to
    const otherCoord = otherNode.gridCoord
    if (!otherCoord) return false
    if (sameTarget) {
      // fan-in: source must be strictly before the shared target
      if (otherCoord[axis] >= sharedCoord[axis]) return false
    } else {
      // fan-out: target must be strictly after the shared source
      if (otherCoord[axis] <= sharedCoord[axis]) return false
    }
  }

  return true
}

// ============================================================================
// Junction point calculation
// ============================================================================

/**
 * Calculate the optimal junction point for a bundle.
 *
 * For fan-in (A & B --> C):
 *   - Junction is placed between the sources and the target
 *   - In TD: above the target, horizontally centered between sources
 *   - In LR: left of the target, vertically centered between sources
 *
 * For fan-out (A --> B & C):
 *   - Junction is placed between the source and the targets
 *   - In TD: below the source, horizontally centered between targets
 *   - In LR: right of the source, vertically centered between targets
 */
export function calculateJunctionPoint(
  graph: AsciiGraph,
  bundle: EdgeBundle,
): GridCoord {
  const dir = graph.config.graphDirection
  const sharedCoord = requireGridCoord(bundle.sharedNode)

  if (bundle.type === 'fan-in') {
    // Junction is BEFORE the shared target
    // Calculate center of sources
    if (dir === 'TD') {
      // Junction above target, centered between sources
      // Place it one row above the target's entry point
      const junctionY = sharedCoord.y - 1
      // X is centered between sources, but clamped to shared node's X for alignment
      const junctionX = sharedCoord.x + 1 // Align with target's center

      return { x: junctionX, y: junctionY }
    } else {
      // LR: Junction left of target, centered between sources
      const junctionX = sharedCoord.x - 1
      const junctionY = sharedCoord.y + 1 // Align with target's center

      return { x: junctionX, y: junctionY }
    }
  } else {
    // fan-out: Junction is AFTER the shared source
    if (dir === 'TD') {
      // Junction below source, will then split to targets
      const junctionY = sharedCoord.y + 3 // Just below source's 3x3 block
      const junctionX = sharedCoord.x + 1 // Align with source's center

      return { x: junctionX, y: junctionY }
    } else {
      // LR: Junction right of source
      const junctionX = sharedCoord.x + 3
      const junctionY = sharedCoord.y + 1

      return { x: junctionX, y: junctionY }
    }
  }
}

// ============================================================================
// Bundled edge routing
// ============================================================================

/**
 * Route all edges in a bundle through the junction point.
 *
 * For fan-in bundles:
 *   1. Route each source → junction (stored in edge.pathToJunction)
 *   2. Route junction → target (stored in bundle.sharedPath)
 *
 * For fan-out bundles:
 *   1. Route source → junction (stored in bundle.sharedPath)
 *   2. Route junction → each target (stored in edge.pathToJunction)
 */
export function routeBundledEdges(graph: AsciiGraph, bundle: EdgeBundle): void {
  const dir = graph.config.graphDirection

  // Calculate and store junction point
  bundle.junctionPoint = calculateJunctionPoint(graph, bundle)
  const junction = bundle.junctionPoint

  // Determine directions based on graph direction and bundle type
  if (bundle.type === 'fan-in') {
    // Sources converge to junction, then junction to target
    bundle.junctionDir = dir === 'TD' ? Up : Left
    bundle.sharedNodeDir = dir === 'TD' ? Down : Right

    // Route junction → target (shared path). Anchor offsets (top/left
    // center of target, bottom/right center of source below) are computed
    // via gridCoordDirection — the same per-direction offset edge-routing.ts
    // uses — instead of each bundling call reimplementing its own
    // arithmetic. routeEdge (pathfinder.ts, also used by edge-routing.ts)
    // tries an unobstructed direct path before falling back to A*. Note
    // that `targetDir` here is the *arrival* anchor at the target, not
    // necessarily the true departure direction from `junction` — routeEdge
    // handles that by trying both L-corner orientations internally (see
    // tryDirectPath in pathfinder.ts) rather than trusting this value as a
    // routing axis.
    const targetCoord = requireGridCoord(bundle.sharedNode)
    const targetDir: CardinalDirection = requireCardinalDirection(
      dir === 'TD' ? Up : Left,
    )
    const targetEntry = gridCoordDirection(targetCoord, targetDir)

    const sharedPath = routeEdge(graph, junction, targetEntry, targetDir)
    bundle.sharedPath = sharedPath ?? [junction, targetEntry]

    // Route each source → junction
    for (const edge of bundle.edges) {
      const sourceCoord = requireGridCoord(edge.from)
      const sourceDir: CardinalDirection = requireCardinalDirection(
        dir === 'TD' ? Down : Right,
      )
      const sourceExit = gridCoordDirection(sourceCoord, sourceDir)

      const pathToJunction = routeEdge(graph, sourceExit, junction, sourceDir)
      edge.pathToJunction = pathToJunction ?? [sourceExit, junction]

      // Set edge directions for proper drawing
      edge.startDir = sourceDir
      edge.endDir = targetDir

      // Build full path for grid size calculation: source → junction → target
      edge.path = [...edge.pathToJunction, ...bundle.sharedPath.slice(1)]
    }
  } else {
    // fan-out: Source to junction, then junction splits to targets
    bundle.junctionDir = dir === 'TD' ? Down : Right
    bundle.sharedNodeDir = dir === 'TD' ? Up : Left

    // Route source → junction (shared path)
    const sourceCoord = requireGridCoord(bundle.sharedNode)
    const sourceDir: CardinalDirection = requireCardinalDirection(
      dir === 'TD' ? Down : Right,
    )
    const sourceExit = gridCoordDirection(sourceCoord, sourceDir)

    const sharedPath = routeEdge(graph, sourceExit, junction, sourceDir)
    bundle.sharedPath = sharedPath ?? [sourceExit, junction]

    // Route junction → each target
    for (const edge of bundle.edges) {
      const targetCoord = requireGridCoord(edge.to)
      const targetDir: CardinalDirection = requireCardinalDirection(
        dir === 'TD' ? Up : Left,
      )
      const targetEntry = gridCoordDirection(targetCoord, targetDir)

      const pathToJunction = routeEdge(graph, junction, targetEntry, targetDir)
      edge.pathToJunction = pathToJunction ?? [junction, targetEntry]

      // Set edge directions
      edge.startDir = sourceDir
      edge.endDir = targetDir

      // Build full path for grid size calculation: source → junction → target
      edge.path = [...bundle.sharedPath, ...edge.pathToJunction.slice(1)]
    }
  }
}

/**
 * Process all bundles in a graph: calculate junction points and route edges.
 */
export function processBundles(graph: AsciiGraph): void {
  for (const bundle of graph.bundles) {
    routeBundledEdges(graph, bundle)
  }
}
