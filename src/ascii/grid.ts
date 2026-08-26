// ============================================================================
// ASCII renderer — grid-based layout
//
// Ported from AlexanderGrooff/mermaid-ascii cmd/graph.go + cmd/mapping_node.go.
// Places nodes on a logical grid, computes column/row sizes,
// converts grid coordinates to character-level drawing coordinates,
// and handles subgraph bounding boxes.
// ============================================================================

import type {
  GridCoord,
  DrawingCoord,
  Direction,
  AsciiGraph,
  AsciiNode,
  AsciiSubgraph,
} from './types.ts'
import { gridKey } from './types.ts'
import { setCanvasSizeToGrid, setRoleCanvasSizeToGrid } from './canvas.ts'
import { determinePath, determineLabelLine } from './edge-routing.ts'
import { analyzeEdgeBundles, processBundles } from './edge-bundling.ts'
import { createPathBudget } from './pathfinder.ts'
import { drawBox } from './draw.ts'
import { getShapeDimensions } from './shapes/index.ts'

// ============================================================================
// Grid coordinate → drawing coordinate conversion
// ============================================================================

/**
 * Convert a grid coordinate to a drawing (character) coordinate.
 * Sums column widths up to the target column, and row heights up to the target row,
 * then centers within the cell.
 */
export function gridToDrawingCoord(
  graph: AsciiGraph,
  c: GridCoord,
  dir?: Direction,
): DrawingCoord {
  const target: GridCoord = dir ? { x: c.x + dir.x, y: c.y + dir.y } : c

  let x = 0
  for (let col = 0; col < target.x; col++) {
    x += graph.columnWidth.get(col) ?? 0
  }

  let y = 0
  for (let row = 0; row < target.y; row++) {
    y += graph.rowHeight.get(row) ?? 0
  }

  const colW = graph.columnWidth.get(target.x) ?? 0
  const rowH = graph.rowHeight.get(target.y) ?? 0
  return {
    x: x + Math.floor(colW / 2) + graph.offsetX,
    y: y + Math.floor(rowH / 2) + graph.offsetY,
  }
}

/** Convert a path of grid coords to drawing coords. */
export function lineToDrawing(
  graph: AsciiGraph,
  line: GridCoord[],
): DrawingCoord[] {
  return line.map((c) => gridToDrawingCoord(graph, c))
}

// ============================================================================
// Node placement on the grid
// ============================================================================

/**
 * Reserve a 3x3 block in the grid for a node.
 * If the requested position is occupied, recursively shift by 4 grid units
 * (in the perpendicular direction based on effective direction) until a free spot is found.
 *
 * @param effectiveDir - Optional direction override. If not provided, uses the node's
 *                       effective direction (subgraph direction if in a subgraph with override,
 *                       otherwise graph direction).
 */
export function reserveSpotInGrid(
  graph: AsciiGraph,
  node: AsciiNode,
  requested: GridCoord,
  effectiveDir?: 'LR' | 'TD',
): GridCoord {
  // Determine direction for collision handling
  const dir = effectiveDir ?? getEffectiveDirection(graph, node)

  if (graph.grid.has(gridKey(requested))) {
    // Collision — shift perpendicular to main flow direction
    if (dir === 'LR') {
      return reserveSpotInGrid(
        graph,
        node,
        { x: requested.x, y: requested.y + 4 },
        dir,
      )
    } else {
      return reserveSpotInGrid(
        graph,
        node,
        { x: requested.x + 4, y: requested.y },
        dir,
      )
    }
  }

  // Reserve the 3x3 block
  for (let dx = 0; dx < 3; dx++) {
    for (let dy = 0; dy < 3; dy++) {
      const reserved: GridCoord = { x: requested.x + dx, y: requested.y + dy }
      graph.grid.set(gridKey(reserved), node)
    }
  }

  node.gridCoord = requested
  return requested
}

// ============================================================================
// Column width / row height computation
// ============================================================================

/**
 * Set column widths and row heights for a node's 3x3 grid block.
 * Each node occupies 3 columns (border, content, border) and 3 rows.
 * Uses shape-aware dimensions to properly size non-rectangular shapes.
 */
export function setColumnWidth(graph: AsciiGraph, node: AsciiNode): void {
  const gc = node.gridCoord!
  const padding = graph.config.boxBorderPadding

  // Get shape-aware dimensions
  const shapeDims = getShapeDimensions(node.shape, node.displayLabel, {
    useAscii: graph.config.useAscii,
    padding,
  })

  // Use shape-provided grid dimensions
  const colWidths = shapeDims.gridColumns
  const rowHeights = shapeDims.gridRows

  for (let idx = 0; idx < colWidths.length; idx++) {
    const xCoord = gc.x + idx
    const current = graph.columnWidth.get(xCoord) ?? 0
    graph.columnWidth.set(xCoord, Math.max(current, colWidths[idx]!))
  }

  for (let idx = 0; idx < rowHeights.length; idx++) {
    const yCoord = gc.y + idx
    const current = graph.rowHeight.get(yCoord) ?? 0
    graph.rowHeight.set(yCoord, Math.max(current, rowHeights[idx]!))
  }

  // Padding column/row before the node (spacing between nodes)
  if (gc.x > 0) {
    const current = graph.columnWidth.get(gc.x - 1) ?? 0
    graph.columnWidth.set(gc.x - 1, Math.max(current, graph.config.paddingX))
  }

  if (gc.y > 0) {
    let basePadding = graph.config.paddingY
    // Extra vertical padding for nodes with incoming edges from outside their subgraph
    if (hasIncomingEdgeFromOutsideSubgraph(graph, node)) {
      const subgraphOverhead = 4
      basePadding += subgraphOverhead
    }
    const current = graph.rowHeight.get(gc.y - 1) ?? 0
    graph.rowHeight.set(gc.y - 1, Math.max(current, basePadding))
  }
}

/** Ensure grid has width/height entries for all cells along an edge path. */
export function increaseGridSizeForPath(
  graph: AsciiGraph,
  path: GridCoord[],
): void {
  for (const c of path) {
    if (!graph.columnWidth.has(c.x)) {
      graph.columnWidth.set(c.x, Math.floor(graph.config.paddingX / 2))
    }
    if (!graph.rowHeight.has(c.y)) {
      graph.rowHeight.set(c.y, Math.floor(graph.config.paddingY / 2))
    }
  }
}

// ============================================================================
// Subgraph helpers
// ============================================================================

function isNodeInAnySubgraph(graph: AsciiGraph, node: AsciiNode): boolean {
  return graph.subgraphs.some((sg) => sg.nodes.includes(node))
}

/**
 * Get the innermost subgraph that directly contains this node.
 * Returns null if node is not in any subgraph.
 */
export function getNodeSubgraph(
  graph: AsciiGraph,
  node: AsciiNode,
): AsciiSubgraph | null {
  // Find the innermost (most deeply nested) subgraph containing the node
  let innermost: AsciiSubgraph | null = null
  for (const sg of graph.subgraphs) {
    if (sg.nodes.includes(node)) {
      // Check if this subgraph is deeper (more nested) than current innermost
      if (!innermost || isAncestorOrSelf(innermost, sg)) {
        innermost = sg
      }
    }
  }
  return innermost
}

/** Check if `candidate` is the same as or an ancestor of `target`. */
function isAncestorOrSelf(
  candidate: AsciiSubgraph,
  target: AsciiSubgraph,
): boolean {
  let current: AsciiSubgraph | null = target
  while (current !== null) {
    if (current === candidate) return true
    current = current.parent
  }
  return false
}

/**
 * Get the outermost (top-level, unnested) subgraph ancestor for a node.
 * Returns null if the node isn't in any subgraph.
 *
 * Used to group nodes for bounding-box-disjointness purposes: sibling
 * subgraphs nested under different top-level subgraphs are unrelated and
 * must never be allowed to overlap (#90), while a subgraph's own nested
 * children are already folded into its box via calculateSubgraphBoundingBox.
 */
function getTopLevelSubgraph(
  graph: AsciiGraph,
  node: AsciiNode,
): AsciiSubgraph | null {
  const sg = getNodeSubgraph(graph, node)
  if (!sg) return null
  let top = sg
  while (top.parent) top = top.parent
  return top
}

/** Recursively collect every node belonging to a subgraph, including nodes in nested subgraphs. */
function collectSubgraphMembers(sg: AsciiSubgraph): AsciiNode[] {
  const members = [...sg.nodes]
  for (const child of sg.children) {
    members.push(...collectSubgraphMembers(child))
  }
  return members
}

/** Whether `to` is reachable from `from` by following outgoing edges (BFS). */
function isReachableViaEdges(
  graph: AsciiGraph,
  from: AsciiNode,
  to: AsciiNode,
): boolean {
  if (from === to) return true
  const visited = new Set<AsciiNode>([from])
  const queue: AsciiNode[] = [from]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const child of getChildren(graph, current)) {
      if (child === to) return true
      if (!visited.has(child)) {
        visited.add(child)
        queue.push(child)
      }
    }
  }
  return false
}

/**
 * Get the effective direction for a node's layout.
 * Returns the subgraph's direction override if the node is in a subgraph with one,
 * otherwise returns the graph-level direction.
 */
export function getEffectiveDirection(
  graph: AsciiGraph,
  node: AsciiNode,
): 'LR' | 'TD' {
  const sg = getNodeSubgraph(graph, node)
  if (sg?.direction) {
    return sg.direction
  }
  return graph.config.graphDirection
}

/**
 * Check if a node has an incoming edge from outside its subgraph
 * AND is the topmost such node in its subgraph.
 * Used to add extra vertical padding for subgraph borders.
 */
function hasIncomingEdgeFromOutsideSubgraph(
  graph: AsciiGraph,
  node: AsciiNode,
): boolean {
  const nodeSg = getNodeSubgraph(graph, node)
  if (!nodeSg) return false

  let hasExternalEdge = false
  for (const edge of graph.edges) {
    if (edge.to === node) {
      const sourceSg = getNodeSubgraph(graph, edge.from)
      if (sourceSg !== nodeSg) {
        hasExternalEdge = true
        break
      }
    }
  }

  if (!hasExternalEdge) return false

  // Only return true for the topmost node with an external incoming edge
  for (const otherNode of nodeSg.nodes) {
    if (otherNode === node || !otherNode.gridCoord) continue
    let otherHasExternal = false
    for (const edge of graph.edges) {
      if (edge.to === otherNode) {
        const sourceSg = getNodeSubgraph(graph, edge.from)
        if (sourceSg !== nodeSg) {
          otherHasExternal = true
          break
        }
      }
    }
    if (otherHasExternal && otherNode.gridCoord.y < node.gridCoord!.y) {
      return false
    }
  }

  return true
}

// ============================================================================
// Subgraph bounding boxes
// ============================================================================

function calculateSubgraphBoundingBox(
  graph: AsciiGraph,
  sg: AsciiSubgraph,
): void {
  if (sg.nodes.length === 0) return

  let minX = 1_000_000
  let minY = 1_000_000
  let maxX = -1_000_000
  let maxY = -1_000_000

  // Include children's bounding boxes
  for (const child of sg.children) {
    calculateSubgraphBoundingBox(graph, child)
    if (child.nodes.length > 0) {
      minX = Math.min(minX, child.minX)
      minY = Math.min(minY, child.minY)
      maxX = Math.max(maxX, child.maxX)
      maxY = Math.max(maxY, child.maxY)
    }
  }

  // Include node positions
  for (const node of sg.nodes) {
    if (!node.drawingCoord || !node.drawing) continue
    const nodeMinX = node.drawingCoord.x
    const nodeMinY = node.drawingCoord.y
    const nodeMaxX = nodeMinX + node.drawing.length - 1
    const nodeMaxY = nodeMinY + node.drawing[0]!.length - 1
    minX = Math.min(minX, nodeMinX)
    minY = Math.min(minY, nodeMinY)
    maxX = Math.max(maxX, nodeMaxX)
    maxY = Math.max(maxY, nodeMaxY)
  }

  const subgraphPadding = 2
  const subgraphLabelSpace = 2
  sg.minX = minX - subgraphPadding
  sg.minY = minY - subgraphPadding - subgraphLabelSpace
  sg.maxX = maxX + subgraphPadding
  sg.maxY = maxY + subgraphPadding
}

/** Ensure non-overlapping root subgraphs have minimum spacing. */
function ensureSubgraphSpacing(graph: AsciiGraph): void {
  const minSpacing = 1
  const rootSubgraphs = graph.subgraphs.filter(
    (sg) => sg.parent === null && sg.nodes.length > 0,
  )

  for (let i = 0; i < rootSubgraphs.length; i++) {
    for (let j = i + 1; j < rootSubgraphs.length; j++) {
      const sg1 = rootSubgraphs[i]!
      const sg2 = rootSubgraphs[j]!

      // Horizontal overlap → adjust vertical
      if (sg1.minX < sg2.maxX && sg1.maxX > sg2.minX) {
        if (sg1.maxY >= sg2.minY - minSpacing && sg1.minY < sg2.minY) {
          sg2.minY = sg1.maxY + minSpacing + 1
        } else if (sg2.maxY >= sg1.minY - minSpacing && sg2.minY < sg1.minY) {
          sg1.minY = sg2.maxY + minSpacing + 1
        }
      }
      // Vertical overlap → adjust horizontal
      if (sg1.minY < sg2.maxY && sg1.maxY > sg2.minY) {
        if (sg1.maxX >= sg2.minX - minSpacing && sg1.minX < sg2.minX) {
          sg2.minX = sg1.maxX + minSpacing + 1
        } else if (sg2.maxX >= sg1.minX - minSpacing && sg2.minX < sg1.minX) {
          sg1.minX = sg2.maxX + minSpacing + 1
        }
      }
    }
  }
}

export function calculateSubgraphBoundingBoxes(graph: AsciiGraph): void {
  for (const sg of graph.subgraphs) {
    calculateSubgraphBoundingBox(graph, sg)
  }
  ensureSubgraphSpacing(graph)
}

/**
 * Offset all drawing coordinates so subgraph borders don't go negative.
 * If any subgraph has negative min coordinates, shift everything positive.
 */
export function offsetDrawingForSubgraphs(graph: AsciiGraph): void {
  if (graph.subgraphs.length === 0) return

  let minX = 0
  let minY = 0
  for (const sg of graph.subgraphs) {
    minX = Math.min(minX, sg.minX)
    minY = Math.min(minY, sg.minY)
  }

  const offsetX = -minX
  const offsetY = -minY
  if (offsetX === 0 && offsetY === 0) return

  graph.offsetX = offsetX
  graph.offsetY = offsetY

  for (const sg of graph.subgraphs) {
    sg.minX += offsetX
    sg.minY += offsetY
    sg.maxX += offsetX
    sg.maxY += offsetY
  }

  for (const node of graph.nodes) {
    if (node.drawingCoord) {
      node.drawingCoord.x += offsetX
      node.drawingCoord.y += offsetY
    }
  }
}

/**
 * Group root nodes by which downstream target they feed into, preserving a
 * stable order: groups appear in the order their shared target was first
 * seen among `roots`, and a root with no children (or whose target no other
 * root shares) keeps its original relative position.
 *
 * Fixes fan-in root placement: without this, `createMapping` places roots
 * sequentially in whatever order they were discovered, so e.g. `A1, B1, A2,
 * B2` (all roots, A1/A2 feeding A and B1/B2 feeding B) land interleaved on
 * the grid instead of grouped as `A1, A2, B1, B2` — causing the two fan-in
 * bundles' trunk edges to share a row and visually cross.
 */
function groupRootsByDownstreamTarget(
  graph: AsciiGraph,
  roots: AsciiNode[],
): AsciiNode[] {
  const primaryTargetKey = (node: AsciiNode): string | null => {
    const children = getChildren(graph, node)
    return children.length > 0 ? children[0]!.name : null
  }

  // For each root, find the index (within `roots`) of the first root that
  // shares its primary target — that's this root's sort anchor.
  const firstIndexForTarget = new Map<string, number>()
  const anchorIndex: number[] = roots.map((node, i) => {
    const key = primaryTargetKey(node)
    if (key === null) return i // no downstream target: anchor to self
    const existing = firstIndexForTarget.get(key)
    if (existing !== undefined) return existing
    firstIndexForTarget.set(key, i)
    return i
  })

  return roots
    .map((node, i) => ({ node, i }))
    .sort((a, b) => anchorIndex[a.i]! - anchorIndex[b.i]! || a.i - b.i)
    .map(({ node }) => node)
}

/**
 * A node whose every incoming path loops back through itself (e.g. `A -->
 * B --> C --> A`, or a lone self-loop `A --> A`) is, correctly, never a
 * "root" — every node in the cycle has a real incoming edge. But the grid
 * layout still needs at least one seed node per such component to place
 * anything at all; with zero roots feeding it, that component would never
 * get a gridCoord and later crash (setColumnWidth reads `.gridCoord!.x`).
 *
 * The old order-dependent detection accidentally provided this seed — the
 * first node the scan reached "looked like" a root simply because it
 * hadn't been visited as a target *yet* — which is the exact bug fixed
 * above. This restores just the useful part of that behavior for genuine
 * cycles: for each weakly-connected component not reachable from any real
 * root, seed it with its first-declared (graph.nodes order) node.
 */
function addPseudoRootsForUnreachableCycles(
  graph: AsciiGraph,
  roots: AsciiNode[],
): AsciiNode[] {
  const reachable = new Set<string>()
  const floodFrom = (start: AsciiNode): void => {
    const queue: AsciiNode[] = [start]
    while (queue.length > 0) {
      const n = queue.shift()!
      if (reachable.has(n.name)) continue
      reachable.add(n.name)
      for (const child of getChildren(graph, n)) queue.push(child)
    }
  }
  for (const root of roots) floodFrom(root)

  const result = [...roots]
  for (const node of graph.nodes) {
    if (reachable.has(node.name)) continue
    result.push(node)
    floodFrom(node)
  }
  return result
}

/**
 * Place all currently-reachable, still-unplaced children of already-placed
 * nodes, level by level, mutating `highestPositionPerLevel` as it goes.
 * Multi-pass: iterates until no more progress can be made in a full pass
 * (handles non-topological node order, and simply leaves anything
 * unreachable from an already-placed node untouched).
 */
function placeReachableChildren(
  graph: AsciiGraph,
  highestPositionPerLevel: number[],
): void {
  let progressed = true
  while (progressed) {
    progressed = false
    for (const node of graph.nodes) {
      if (node.gridCoord === null) continue // skip unplaced nodes
      const gc = node.gridCoord

      for (const child of getChildren(graph, node)) {
        if (child.gridCoord !== null) continue // already placed

        // Determine direction for this edge (parent -> child)
        // Use subgraph direction only if both are in the same subgraph with override
        const parentSg = getNodeSubgraph(graph, node)
        const childSg = getNodeSubgraph(graph, child)
        const edgeDir =
          parentSg && parentSg === childSg && parentSg.direction
            ? parentSg.direction
            : graph.config.graphDirection

        const childLevel = edgeDir === 'LR' ? gc.x + 4 : gc.y + 4

        // Determine position based on direction context
        let highestPosition: number
        if (edgeDir !== graph.config.graphDirection) {
          // Cross-direction: use parent's perpendicular coordinate
          // This keeps children aligned with parent when direction changes
          highestPosition = edgeDir === 'LR' ? gc.y : gc.x
        } else {
          // Same direction: use level tracker
          highestPosition = highestPositionPerLevel[childLevel] ?? 0
        }

        const requested: GridCoord =
          edgeDir === 'LR'
            ? { x: childLevel, y: highestPosition }
            : { x: highestPosition, y: childLevel }
        reserveSpotInGrid(graph, graph.nodes[child.index]!, requested, edgeDir)

        // Only update level tracker for same-direction placements
        if (edgeDir === graph.config.graphDirection) {
          highestPositionPerLevel[childLevel] = highestPosition + 4
        }
        progressed = true
      }
    }
  }
}

// ============================================================================
// Main layout orchestrator
// ============================================================================

/**
 * createMapping performs the full grid layout:
 * 1. Place root nodes on the grid
 * 2. Place child nodes level by level
 * 3. Compute column widths and row heights
 * 4. Run A* pathfinding for all edges
 * 5. Determine label placement
 * 6. Convert grid coords → drawing coords
 * 7. Generate node box drawings
 * 8. Calculate subgraph bounding boxes
 */
export function createMapping(graph: AsciiGraph): void {
  const dir = graph.config.graphDirection
  // A sparse array, not a fixed-size preallocation: level indices grow with
  // chain depth (each level adds 4 to the coordinate), and a long enough
  // chain would silently read past a fixed bound. Reads default missing
  // levels to 0 via `?? 0` below instead.
  const highestPositionPerLevel: number[] = []

  // Identify root nodes — nodes that are never the target of any edge.
  //
  // This must be order-independent: a single forward pass over graph.nodes
  // (in Map-insertion / first-mention order) incorrectly treats a node as a
  // root whenever it hasn't been seen as an edge target *yet* at the point
  // it's visited. That misclassifies nodes when a `child -> parent` edge
  // appears in the source *after* a `parent -> grandchild` edge (e.g. `A -->
  // C` is declared before `A1 --> A`), since `A` looks unvisited-as-target
  // when the loop reaches it.
  //
  // Two-pass fix: first collect every node that appears as the target of a
  // non-self-loop edge (a self-loop shouldn't disqualify a node from being a
  // root — see edge-bundling.ts's identical self-loop skip), then anything
  // never targeted is a genuine root, independent of source order.
  const targetedNames = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.from === edge.to) continue // self-loop: doesn't count as "targeted"
    targetedNames.add(edge.to.name)
  }
  const targetBasedRoots: AsciiNode[] = graph.nodes.filter(
    (node) => !targetedNames.has(node.name),
  )

  // A weakly-connected component that's entirely a cycle (e.g. `A --> B -->
  // C --> A`) correctly has zero target-based roots — every node in it has
  // a real incoming edge — but the grid layout still needs one seed node
  // per component to place anything at all. See
  // addPseudoRootsForUnreachableCycles for why and how.
  const initialRoots = addPseudoRootsForUnreachableCycles(
    graph,
    targetBasedRoots,
  )

  // Filter out subgraph nodes that have incoming edges from external sources.
  // This handles the case where subgraph is declared before external nodes
  // (e.g., `subgraph s; A-->B; end; X-->A` - A shouldn't be a root, X should).
  const rootNodes = initialRoots.filter((node) => {
    const nodeSg = getNodeSubgraph(graph, node)
    if (!nodeSg) return true // external nodes: keep as roots

    // Check if this subgraph node has incoming edges from outside its subgraph
    for (const edge of graph.edges) {
      if (edge.to === node) {
        const sourceSg = getNodeSubgraph(graph, edge.from)
        if (sourceSg !== nodeSg) {
          return false // has external incoming edge → not a root
        }
      }
    }
    return true
  })

  // Defer root nodes that belong to a subgraph which has OTHER members that
  // are (a) not roots themselves and (b) not even reachable from this root
  // via its own edges — i.e. members whose placement is driven by some
  // completely unrelated part of the graph. Placing such a node at the
  // generic root level — shared with roots of unrelated sibling subgraphs —
  // can scatter its own subgraph's members across disjoint regions of the
  // grid, making that subgraph's bounding box balloon out to enclose
  // unrelated sibling content (#90). Instead, anchor these nodes next to
  // their already-placed subgraph siblings once the normal placement pass
  // below has run.
  //
  // A sibling that *is* reachable from this root (e.g. a subgraph root with
  // its own intra-subgraph child) is left alone: the normal traversal below
  // already positions it correctly relative to this root, so deferring would
  // be both unnecessary and wrong.
  const rootNodeSet = new Set(rootNodes)
  const deferredRoots: AsciiNode[] = []
  const placementRoots: AsciiNode[] = []
  for (const node of rootNodes) {
    const topSg = getTopLevelSubgraph(graph, node)
    const hasUnrelatedNonRootSibling =
      topSg !== null &&
      collectSubgraphMembers(topSg).some(
        (m) =>
          m !== node &&
          !rootNodeSet.has(m) &&
          !isReachableViaEdges(graph, node, m),
      )
    if (hasUnrelatedNonRootSibling) {
      deferredRoots.push(node)
    } else {
      placementRoots.push(node)
    }
  }

  // Group the non-deferred root nodes by which downstream target they feed
  // into, so a fan-in cluster (e.g. A1, A2 -> A) is placed contiguously
  // instead of interleaving with roots that feed a *different* target (e.g.
  // B1 -> B landing between A1 and A2). Without this, unrelated fan-in
  // bundles can end up on the same grid row and their trunk edges visually
  // cross.
  //
  // Stable: each root's sort key is the position of the *first* root that
  // shares its primary (first) downstream target, so groups appear in the
  // order their target was first seen, and a root with no children (or a
  // target no other root shares) keeps its original relative position.
  const groupedRootNodes = groupRootsByDownstreamTarget(graph, placementRoots)

  // In LR mode with both external and subgraph roots, separate them
  // so subgraph roots are placed one level deeper
  let hasExternalRoots = false
  let hasSubgraphRootsWithEdges = false
  for (const node of groupedRootNodes) {
    if (isNodeInAnySubgraph(graph, node)) {
      if (getChildren(graph, node).length > 0) hasSubgraphRootsWithEdges = true
    } else {
      hasExternalRoots = true
    }
  }
  const shouldSeparate =
    dir === 'LR' && hasExternalRoots && hasSubgraphRootsWithEdges

  let externalRootNodes: AsciiNode[]
  let subgraphRootNodes: AsciiNode[] = []

  if (shouldSeparate) {
    externalRootNodes = groupedRootNodes.filter(
      (n) => !isNodeInAnySubgraph(graph, n),
    )
    subgraphRootNodes = groupedRootNodes.filter((n) =>
      isNodeInAnySubgraph(graph, n),
    )
  } else {
    externalRootNodes = groupedRootNodes
  }

  // Place external root nodes
  for (const node of externalRootNodes) {
    const requested: GridCoord =
      dir === 'LR'
        ? { x: 0, y: highestPositionPerLevel[0] ?? 0 }
        : { x: highestPositionPerLevel[0] ?? 0, y: 0 }
    reserveSpotInGrid(graph, graph.nodes[node.index]!, requested)
    highestPositionPerLevel[0] = (highestPositionPerLevel[0] ?? 0) + 4
  }

  // Place subgraph root nodes at level 4 (one level in from the edge)
  if (shouldSeparate && subgraphRootNodes.length > 0) {
    const subgraphLevel = 4
    for (const node of subgraphRootNodes) {
      const requested: GridCoord =
        dir === 'LR'
          ? { x: subgraphLevel, y: highestPositionPerLevel[subgraphLevel] ?? 0 }
          : { x: highestPositionPerLevel[subgraphLevel] ?? 0, y: subgraphLevel }
      reserveSpotInGrid(graph, graph.nodes[node.index]!, requested)
      highestPositionPerLevel[subgraphLevel] =
        (highestPositionPerLevel[subgraphLevel] ?? 0) + 4
    }
  }

  // Place child nodes level by level (reachable from the roots placed so far).
  placeReachableChildren(graph, highestPositionPerLevel)

  // Now place the deferred subgraph-orphan roots, anchored next to their
  // already-placed subgraph siblings rather than at the shared root level.
  for (const node of deferredRoots) {
    const topSg = getTopLevelSubgraph(graph, node)!
    const nodeDir = getEffectiveDirection(graph, node)
    // Type predicate narrows `gridCoord` to non-null on every element, so the
    // loop below can read `.gridCoord.x`/`.y` directly instead of trusting
    // that this filter and the access stay in sync via a bare `!`.
    const placedSiblings = collectSubgraphMembers(topSg).filter(
      (m): m is AsciiNode & { gridCoord: GridCoord } =>
        m !== node && m.gridCoord !== null,
    )

    let requested: GridCoord
    if (placedSiblings.length > 0) {
      // Anchor to whichever placed sibling sits at the shallowest level
      // (topmost row for TD, leftmost column for LR) — reserveSpotInGrid's
      // built-in collision handling then slides this node along the same
      // level until it finds a free spot immediately adjacent.
      let anchor = placedSiblings[0]!
      for (const sibling of placedSiblings) {
        const isShallower =
          nodeDir === 'LR'
            ? sibling.gridCoord.x < anchor.gridCoord.x
            : sibling.gridCoord.y < anchor.gridCoord.y
        if (isShallower) anchor = sibling
      }
      requested = { x: anchor.gridCoord.x, y: anchor.gridCoord.y }
    } else {
      // Defensive fallback — shouldn't normally happen, since we only defer
      // a node when it has a sibling that's guaranteed to be placed by the
      // traversal above. Fall back to ordinary root-level placement.
      requested =
        nodeDir === 'LR'
          ? { x: 0, y: highestPositionPerLevel[0] ?? 0 }
          : { x: highestPositionPerLevel[0] ?? 0, y: 0 }
      highestPositionPerLevel[0] = (highestPositionPerLevel[0] ?? 0) + 4
    }

    reserveSpotInGrid(graph, graph.nodes[node.index]!, requested, nodeDir)
  }

  // A deferred root may itself have children (edges) that couldn't be placed
  // above since it wasn't on the grid yet — give the traversal another pass.
  placeReachableChildren(graph, highestPositionPerLevel)

  // Compute column widths and row heights
  for (const node of graph.nodes) {
    setColumnWidth(graph, node)
  }

  // Fresh render-wide A* iteration budget for this layout pass. Shared by
  // every getPath call below (both bundled-edge routing and per-edge
  // determinePath), so total pathfinding work for the whole render is
  // hard-bounded regardless of edge count — a per-call iteration cap alone
  // isn't enough for dense fan-in/out graphs with hundreds of edges, since
  // each call is independently allowed to spend up to its own cap. See
  // pathfinder.ts's PathBudget for details.
  graph.pathBudget = createPathBudget()

  // Analyze edges for bundling (parallel links like A & B --> C)
  // This groups edges that share sources or targets for cleaner visualization
  graph.bundles = analyzeEdgeBundles(graph)

  // Route bundled edges through junction points
  processBundles(graph)

  // Route non-bundled edges via A* and determine label positions
  for (const edge of graph.edges) {
    // Skip edges that were already routed as part of a bundle
    if (edge.bundle && edge.path.length > 0) {
      increaseGridSizeForPath(graph, edge.path)
      determineLabelLine(graph, edge)
      continue
    }

    determinePath(graph, edge)
    increaseGridSizeForPath(graph, edge.path)
    determineLabelLine(graph, edge)
  }

  // Convert grid coords → drawing coords and generate box drawings
  for (const node of graph.nodes) {
    node.drawingCoord = gridToDrawingCoord(graph, node.gridCoord!)
    node.drawing = drawBox(node, graph)
  }

  // Set canvas size and compute subgraph bounding boxes
  setCanvasSizeToGrid(graph.canvas, graph.columnWidth, graph.rowHeight)
  setRoleCanvasSizeToGrid(graph.roleCanvas, graph.columnWidth, graph.rowHeight)
  calculateSubgraphBoundingBoxes(graph)
  offsetDrawingForSubgraphs(graph)
}

// ============================================================================
// Graph traversal helpers
// ============================================================================

/** Get all edges originating from a node. */
function getEdgesFromNode(
  graph: AsciiGraph,
  node: AsciiNode,
): AsciiGraph['edges'] {
  return graph.edges.filter((e) => e.from.name === node.name)
}

/** Get all direct children of a node (targets of outgoing edges). */
function getChildren(graph: AsciiGraph, node: AsciiNode): AsciiNode[] {
  return getEdgesFromNode(graph, node).map((e) => e.to)
}
