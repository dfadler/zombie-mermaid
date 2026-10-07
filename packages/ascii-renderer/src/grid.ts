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
  AsciiEdge,
  AsciiGraph,
  AsciiNode,
  AsciiSubgraph,
} from './types.ts'
import { gridKey, requireGridCoord } from './types.ts'
import { setCanvasSizeToGrid, setRoleCanvasSizeToGrid } from './canvas.ts'
import {
  determinePath,
  determineLabelLine,
  createLabelContext,
  assignParallelEdgeLanes,
} from './edge-routing.ts'
import { analyzeEdgeBundles, processBundles } from './edge-bundling.ts'
import { createPathBudget } from './pathfinder.ts'
import { planClusterExits, widenClusterGutters } from './cluster-boundary.ts'
import {
  blockUnrelatedFrames,
  unblock,
  widenFrameGutters,
  widenFramesForTitleStrokes,
} from './frame-avoidance.ts'
import {
  isBlockFree,
  placeBlock,
  cloneGrid,
  NODE_BLOCK_SIZE,
  type Grid,
} from './grid-occupancy.ts'
import {
  createEdgeCellStyles,
  claimPathCells,
  findStyleConflict,
  createEdgeCellOwners,
  claimPathOwners,
  findUnrelatedOverlap,
  type EdgeCellStyles,
  type EdgeCellOwners,
} from './edge-cell-styles.ts'
import { drawBox } from './draw.ts'
import { getShapeDimensions } from './shapes/index.ts'
import { splitLines } from './multiline-utils.ts'
import { displayWidth } from './display-width.ts'

// `requireGridCoord` is defined in types.ts (a pure predicate over
// AsciiNode with no grid-state dependency) and re-exported here so the two
// existing call sites that import it from this module (edge-routing.ts,
// edge-bundling.ts) don't need to change.
export { requireGridCoord }

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

  if (!isBlockFree(graph.grid, requested, NODE_BLOCK_SIZE)) {
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

  placeBlock(graph.grid, requested, NODE_BLOCK_SIZE)

  node.gridCoord = requested
  return requested
}

// ============================================================================
// Column width / row height computation
// ============================================================================

/**
 * Whether the slot before `node` is the content column of a node centered
 * between its parents (#1339), either `node`'s own parent (the left one) or
 * its centered child (for the right one). Padding that slot would stretch the
 * left parent wider than its sibling, or the centered child past both, and
 * push the trunk off center. The nodes stacked in the centered node's slot (`A --> Z`) sit in
 * the same columns and inherit this. Only a node with several parents counts:
 * a single child at a fan-out's centered parent's content column (#1340)
 * keeps its padding.
 */
function straddlesParent(
  graph: AsciiGraph,
  node: AsciiNode,
  axis: 'x' | 'y',
  seen: Set<AsciiNode> = new Set(),
): boolean {
  const gc = node.gridCoord
  if (!gc || seen.has(node)) return false
  seen.add(node)
  const parents = new Set<AsciiNode>()
  for (const e of graph.edges) {
    if (e.to === node && e.from !== node) parents.add(e.from)
  }
  for (const p of parents) {
    const pc = p.gridCoord
    if (!pc) continue
    if (parents.size > 1 && pc[axis] + 1 === gc[axis] - 1) return true
    if (pc[axis] === gc[axis] && straddlesParent(graph, p, axis, seen)) {
      return true
    }
  }
  // The right-hand sibling: the slot before it is the centered child's
  // content column, which padding would stretch past the parents' width.
  for (const e of graph.edges) {
    const c = e.from === node && e.to !== node ? e.to.gridCoord : null
    if (!c || c[axis] + 1 !== gc[axis] - 1) continue
    const sources = new Set<AsciiNode>()
    for (const f of graph.edges) {
      if (f.to === e.to && f.from !== e.to) sources.add(f.from)
    }
    if (sources.size > 1) return true
  }
  return false
}

/**
 * Set column widths and row heights for a node's 3x3 grid block.
 * Each node occupies 3 columns (border, content, border) and 3 rows.
 * Uses shape-aware dimensions to properly size non-rectangular shapes.
 */
export function setColumnWidth(graph: AsciiGraph, node: AsciiNode): void {
  const gc = requireGridCoord(node)
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

  // Padding column/row before the node (spacing between nodes), unless
  // the node straddles its parents (see `straddlesParent`).
  if (gc.x > 0 && !straddlesParent(graph, node, 'x')) {
    const current = graph.columnWidth.get(gc.x - 1) ?? 0
    graph.columnWidth.set(
      gc.x - 1,
      Math.max(current, graph.config.paddingX, lrFanInGap(graph, node)),
    )
  }

  // LR: when the row above this node is another node's own block (a fan-in
  // child centered between its parents, `fanInCenter`), it is that node's
  // content row, not a gap between rows. Padding it would stretch the
  // neighbour into a tall box for no spacing benefit. `straddlesParent`
  // covers the centered node's own padding; this covers the one above its
  // lower parent, which lands on the centered node's content row.
  const rowAboveIsNodeBlock =
    graph.config.graphDirection === 'LR' &&
    graph.nodes.some((other) => {
      const oc = other.gridCoord
      return (
        other !== node &&
        oc !== null &&
        oc.y <= gc.y - 1 &&
        gc.y - 1 <= oc.y + 2 &&
        oc.x !== gc.x
      )
    })
  if (gc.y > 0 && !rowAboveIsNodeBlock && !straddlesParent(graph, node, 'y')) {
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

/**
 * Narrowest gap before an LR node with several parents. The parents' edges
 * join in that gap: one column for the junction and one for the arrowhead.
 * In a 1- or 2-wide gap the farther edge's riser lands on the arrowhead cell
 * and reads as stopping beside the child with no junction (#1393).
 */
function lrFanInGap(graph: AsciiGraph, node: AsciiNode): number {
  if (graph.config.graphDirection !== 'LR') return 0
  const parents = new Set<AsciiNode>()
  for (const e of graph.edges) {
    if (e.to === node && e.from !== node) parents.add(e.from)
  }
  return parents.size > 1 ? 3 : 0
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

/**
 * Cap on re-route attempts for a single edge's cross-style conflicts.
 *
 * `determinePath`'s A* attempts respect the blocked cells added below, but
 * its Case-4 direct-fallback (used when both A* attempts fail outright)
 * draws a straight line ignoring occupancy entirely — so a pathological
 * layout where every route is blocked could keep "finding" the same
 * conflict forever. This bounds that to a handful of tries; if a genuine
 * conflict survives them, the edge keeps its last-routed (still
 * overlapping) path rather than looping — the same "graceful degradation
 * over a hard failure" the render-wide `PathBudget` already applies to A*
 * itself.
 */
const MAX_STYLE_CONFLICT_REROUTES = 8

/**
 * After `edge` has been routed, check whether its path crosses a cell
 * already claimed by a *different*-style edge, or by an unrelated edge's
 * run of cells long enough to read as one continuous connector (see
 * edge-cell-styles.ts's two conflict checks) and, if so, re-route it around
 * the conflicting cell(s).
 *
 * Works by temporarily adding the conflicting cell to `graph.grid` — the
 * same occupancy map A* already treats node cells as blocked through — so
 * `determinePath`'s A* search avoids it on the next attempt, then removing
 * that temporary block again once this edge is done (it must not
 * permanently block the cell for other, unrelated edges; only these two
 * conflict shapes are meant to be avoided, not all future overlap).
 *
 * `nodeOnlyGrid` — not `graph.grid` — is what gets passed to
 * `findStyleConflict`/`findUnrelatedOverlap`'s "is this cell node-owned, and
 * therefore not a real conflict" check. This must be a separate,
 * frozen-at-node-placement-time grid: `graph.grid` gets `add`ed to right
 * below for A*'s benefit, and if the *conflict check* used that same live
 * grid, a cell temporarily blocked on attempt 1 would look node-occupied on
 * attempt 2 — so if A*'s direct-fallback (which ignores occupancy) routes
 * right back through it, the loop would wrongly see "no conflict" and stop,
 * leaving the two edges still overlapping there. See
 * ascii-edge-cross-style-overlap.test.ts's regression test for this exact
 * scenario.
 */
function rerouteAroundStyleConflicts(
  graph: AsciiGraph,
  edge: AsciiEdge,
  cellStyles: EdgeCellStyles,
  cellOwners: EdgeCellOwners,
  nodeOnlyGrid: Grid,
): void {
  const temporarilyBlocked: GridCoord[] = []
  // Each reroute blocks one conflict cell, and the A* search around it
  // picks an arbitrary one of many equally short detours — in practice a
  // staircase hugging the cluster wall (#1148's `retry` edge) or a stair-step
  // round a reciprocal edge (#1349's `D --> A`). Prefer fewest bends instead.
  graph.preferStraightRoutes = true
  try {
    for (let i = 0; i < MAX_STYLE_CONFLICT_REROUTES; i++) {
      const conflict =
        findStyleConflict(nodeOnlyGrid, cellStyles, edge.path, edge.style) ??
        findUnrelatedOverlap(
          nodeOnlyGrid,
          cellOwners,
          edge.path,
          edge,
          (owner) =>
            owner.clusterSource !== undefined &&
            graph.clusterExitPlans
              ?.get(owner.clusterSource)
              ?.edges.has(owner) === true,
        )
      if (!conflict) return
      graph.grid.add(gridKey(conflict))
      temporarilyBlocked.push(conflict)
      determinePath(graph, edge)
    }
  } finally {
    graph.preferStraightRoutes = false
    for (const cell of temporarilyBlocked) graph.grid.delete(gridKey(cell))
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
  const nodeY = requireGridCoord(node).y
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
    if (otherHasExternal && otherNode.gridCoord.y < nodeY) {
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

  // Widen the box, if necessary, so the subgraph's own cluster label fits
  // without truncation. `drawSubgraphLabel` (draw-subgraphs.ts) writes the
  // label into the interior columns `1..width-1` (width = maxX - minX), so
  // the box needs `width >= labelWidth + 1` to avoid clipping the label
  // against its own right border. Widening symmetrically (splitting any
  // extra columns across both sides) keeps the child nodes visually
  // centered inside the enlarged box rather than skewing it to one side.
  const labelWidth = Math.max(
    0,
    ...splitLines(sg.name).map((line) => displayWidth(line)),
  )
  const currentWidth = sg.maxX - sg.minX
  const requiredWidth = labelWidth + 1
  if (requiredWidth > currentWidth) {
    const extra = requiredWidth - currentWidth
    const extraLeft = Math.floor(extra / 2)
    const extraRight = extra - extraLeft
    sg.minX -= extraLeft
    sg.maxX += extraRight
  }

  // Extra room asked for by `widenFramesForTitleStrokes` (#1222).
  const room = sg.titleRoom ?? 0
  // Added on the right only: the title then sits to the right of an edge
  // entering at the node column, so the edge and the title both stay whole
  // (#1248). Splitting the room across both sides would move the frame wall
  // away from the edge by the same amount the title needs to clear it.
  if (room > 0) sg.maxX += room
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

/** Columns a frame needs (`maxX - minX`) so its longest title line fits. */
function titleRequiredWidth(sg: AsciiSubgraph): number {
  return (
    Math.max(0, ...splitLines(sg.name).map((line) => displayWidth(line))) + 1
  )
}

/** Grid box spanned by all of a subgraph's members, nested ones included. */
function memberGridBox(
  sg: AsciiSubgraph,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let box: { minX: number; minY: number; maxX: number; maxY: number } | null =
    null
  for (const m of collectSubgraphMembers(sg)) {
    const gc = m.gridCoord
    if (!gc) continue
    box = box
      ? {
          minX: Math.min(box.minX, gc.x),
          minY: Math.min(box.minY, gc.y),
          maxX: Math.max(box.maxX, gc.x + 2),
          maxY: Math.max(box.maxY, gc.y + 2),
        }
      : { minX: gc.x, minY: gc.y, maxX: gc.x + 2, maxY: gc.y + 2 }
  }
  return box
}

/**
 * Widen the grid gap between two side-by-side frames that a wide title made
 * touch (#1254, #1248). A frame grows past its nodes to fit its title (or the
 * room `widenFramesForTitleStrokes` gives it), into the gap beside it.
 *
 * - Root frames: `ensureSubgraphSpacing` separates touching ones by moving the
 *   right one's left wall, which narrows it; when its title needed that width
 *   the title is clipped ("Layer Two" -> "Layer T"). Widening the gap keeps
 *   both frames at their natural width instead. Frames whose title still fits
 *   after being pushed are left to `ensureSubgraphSpacing` as before.
 * - Nested sibling frames: nothing separates them, so they overlapped and
 *   their walls and nodes tangled. They get the same gap widening, always.
 *
 * Returns whether any column changed; drawing coordinates and boxes are
 * recomputed here.
 */
export function widenGapsForFrameTitles(graph: AsciiGraph): boolean {
  const framed = graph.subgraphs.filter((sg) => sg.nodes.length > 0)
  const related = (a: AsciiSubgraph, b: AsciiSubgraph): boolean =>
    isAncestorOrSelf(a, b) || isAncestorOrSelf(b, a)
  let changed = false
  for (let pass = 0; pass < 64; pass++) {
    // Raw boxes, before `ensureSubgraphSpacing` moves any wall.
    for (const sg of graph.subgraphs) calculateSubgraphBoundingBox(graph, sg)
    let widened = false
    for (const a of framed) {
      for (const b of framed) {
        if (related(a, b) || !(a.minX < b.minX)) continue
        if (!(a.minY < b.maxY && a.maxY > b.minY)) continue
        const deficit = a.maxX + 2 - b.minX
        if (deficit <= 0) continue
        const bothRoot = a.parent === null && b.parent === null
        // The pushed wall must also stay clear of b's own nodes: a wall pushed
        // onto a node's left edge draws a junction over its box corner (#1288).
        const pushedWall = a.maxX + 2
        const nodesClearWall = collectSubgraphMembers(b).every(
          (m) => !m.drawingCoord || m.drawingCoord.x > pushedWall,
        )
        if (
          bothRoot &&
          nodesClearWall &&
          b.maxX - pushedWall >= titleRequiredWidth(b)
        )
          continue
        const boxA = memberGridBox(a)
        const boxB = memberGridBox(b)
        if (!boxA || !boxB || boxA.maxX + 1 >= boxB.minX) continue
        const col = boxA.maxX + 1
        graph.columnWidth.set(col, (graph.columnWidth.get(col) ?? 0) + deficit)
        for (const node of graph.nodes) {
          node.drawingCoord = gridToDrawingCoord(graph, requireGridCoord(node))
        }
        widened = true
        changed = true
        break
      }
      if (widened) break
    }
    if (!widened) break
  }
  calculateSubgraphBoundingBoxes(graph)
  return changed
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
 * get a gridCoord and later crash (setColumnWidth calls `requireGridCoord`).
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
 * Find the node whose grid block originates at `coord`, if any.
 *
 * Only meaningful before edge routing starts: every reserved grid cell at
 * that point belongs to a placed node's block (edges haven't claimed any
 * cells yet), and every block's origin sits on the 4-unit lattice that
 * `reserveSpotInGrid` allocates from — so matching by exact origin equality
 * is safe; there's no partial-overlap case to worry about yet.
 */
function findNodeAtGridOrigin(
  graph: AsciiGraph,
  coord: GridCoord,
): AsciiNode | undefined {
  return graph.nodes.find(
    (n) =>
      n.gridCoord !== null &&
      n.gridCoord.x === coord.x &&
      n.gridCoord.y === coord.y,
  )
}

/**
 * Find a free grid slot adjacent to `anchor` along `axis`, without walking
 * through a node that belongs to a *different* top-level subgraph than
 * `ownTopSg`.
 *
 * A deferred subgraph root (see the module doc above createMapping) anchors
 * next to an already-placed sibling and slides along the shared axis until
 * it finds free space. Sliding blindly — the naive approach, via
 * `reserveSpotInGrid`'s generic collision handling — can walk straight
 * through an unrelated sibling subgraph's node that already occupies the
 * next slot over, landing the deferred node on the *far* side of that
 * foreign node. That foreign node then sits between the anchor and the
 * deferred node, so it falls inside this subgraph's bounding box and its own
 * frame/title is dropped (#301).
 *
 * Tries `preferredSign` first (the direction the old blind slide always
 * used), then the opposite sign. In each direction, stops — without
 * accepting the enclosure — the moment it would have to step past a node
 * belonging to a different top-level subgraph, and only continues past
 * nodes belonging to the *same* one. Returns null if both directions are
 * immediately foreign-blocked, so the caller can fall back to the old
 * (occasionally imperfect but non-looping) blind-slide behavior.
 */
function findSubgraphAdjacentSlot(
  graph: AsciiGraph,
  anchor: GridCoord,
  ownTopSg: AsciiSubgraph,
  axis: 'x' | 'y',
  preferredSign: 1 | -1,
): GridCoord | null {
  const other: 'x' | 'y' = axis === 'x' ? 'y' : 'x'

  const tryDirection = (sign: 1 | -1): GridCoord | null => {
    let offset = 4
    for (;;) {
      const axisVal = anchor[axis] + sign * offset
      if (axisVal < 0) return null
      const candidate: GridCoord =
        axis === 'x'
          ? { x: axisVal, y: anchor[other] }
          : { x: anchor[other], y: axisVal }
      if (isBlockFree(graph.grid, candidate, NODE_BLOCK_SIZE)) return candidate
      const occupant = findNodeAtGridOrigin(graph, candidate)
      if (!occupant || getTopLevelSubgraph(graph, occupant) !== ownTopSg) {
        return null // a foreign subgraph (or unexpected gap) blocks this side
      }
      offset += 4
    }
  }

  return (
    tryDirection(preferredSign) ?? tryDirection((preferredSign * -1) as 1 | -1)
  )
}

/**
 * Place any deferred nodes waiting on `rootNode`'s top-level subgraph
 * immediately adjacent to it, before returning control to the root-
 * placement loop — so an unrelated subgraph's root can never claim the slot
 * a deferred sibling needs first (#301). Removes the subgraph's entry from
 * `deferredByTopSg` once handled (a subgraph's deferred nodes attach to
 * whichever of its roots is placed *first*, not every one), and records each
 * placed node in `resolvedDeferred` so the later fallback pass (for deferred
 * nodes whose anchor turns out to be a non-root, only available after the
 * reachable-children traversal) skips them.
 */
function placeDeferredSiblingsNextToRoot(
  graph: AsciiGraph,
  rootNode: AsciiNode,
  deferredByTopSg: Map<AsciiSubgraph, AsciiNode[]>,
  resolvedDeferred: Set<AsciiNode>,
): void {
  const topSg = getTopLevelSubgraph(graph, rootNode)
  if (!topSg) return
  const waiting = deferredByTopSg.get(topSg)
  if (!waiting) return
  deferredByTopSg.delete(topSg)

  const anchor = requireGridCoord(rootNode)
  const axis: 'x' | 'y' =
    getEffectiveDirection(graph, rootNode) === 'LR' ? 'y' : 'x'

  for (const deferred of waiting) {
    const nodeDir = getEffectiveDirection(graph, deferred)
    const slot = findSubgraphAdjacentSlot(graph, anchor, topSg, axis, 1)
    reserveSpotInGrid(
      graph,
      graph.nodes[deferred.index]!,
      slot ?? anchor,
      nodeDir,
    )
    resolvedDeferred.add(deferred)
  }
}

/**
 * Whether `node` can sit half a slot over its children without a labelled
 * edge running out of room. A straddled parent's near border lines up with
 * the neighbouring child's border, so an edge leaving that side reaches the
 * child's centre after only half the child's width; the label has to fit in
 * that run (plus a cell either side) or it lands on the box.
 */
function fitsStraddled(graph: AsciiGraph, node: AsciiNode): boolean {
  const pad = graph.config.boxBorderPadding
  for (const e of graph.edges) {
    if (e.from !== node || !e.text) continue
    const childWidth = displayWidth(e.to.displayLabel) + 2 * pad + 2
    if (Math.floor(childWidth / 2) < displayWidth(e.text) + 2) return false
  }
  return true
}

/** Release `gc`'s 3x3 block in the occupancy grid. */
function freeNodeBlock(graph: AsciiGraph, gc: GridCoord): void {
  for (let dx = 0; dx < NODE_BLOCK_SIZE; dx++)
    for (let dy = 0; dy < NODE_BLOCK_SIZE; dy++)
      graph.grid.delete(gridKey({ x: gc.x + dx, y: gc.y + dy }))
}

/**
 * Move `node` to `to` if that block is free, else leave it where it is.
 * Returns whether it moved.
 */
function relocateNode(
  graph: AsciiGraph,
  node: AsciiNode,
  to: GridCoord,
): boolean {
  const from = requireGridCoord(node)
  freeNodeBlock(graph, from)
  const dest = isBlockFree(graph.grid, to, NODE_BLOCK_SIZE) ? to : from
  placeBlock(graph.grid, dest, NODE_BLOCK_SIZE)
  node.gridCoord = dest
  return dest === to
}

/** Shift every node strictly right of column `afterX` by `by` grid units. */
function shiftColumnsRight(
  graph: AsciiGraph,
  afterX: number,
  by: number,
): void {
  const moved = graph.nodes.filter(
    (n) => n.gridCoord !== null && n.gridCoord.x > afterX,
  )
  for (const n of moved) freeNodeBlock(graph, requireGridCoord(n))
  for (const n of moved) {
    const gc = requireGridCoord(n)
    n.gridCoord = { x: gc.x + by, y: gc.y }
    placeBlock(graph.grid, n.gridCoord, NODE_BLOCK_SIZE)
  }
}

/**
 * Centre a node over its children, as dagre does, instead of leaving it above
 * the first one (a fan-out like `A --> B & C & D` otherwise hangs A over B and
 * leaves its other edges to leave sideways and come back down).
 *
 * TD only, and only for graphs where every edge points to a lower row:
 * back edges and same-row edges route around the nodes they skip, and moving
 * nodes under them scrambles those routes. A node moves only when it and its
 * children sit outside every subgraph, the children are on the next row, and
 * each has no other parent. It only ever moves right, deepest rows first, so
 * a chain follows its moved child.
 *
 * With an odd number of children the midpoint is a node slot. With an even
 * number it falls on the padding column between the two middle children:
 *  - if every labelled edge to a child still fits (`fitsStraddled`), the node
 *    straddles that column and only the column widens;
 *  - otherwise one slot is opened by pushing the nodes right of the midpoint
 *    over, provided they all belong to this node's own subtree or fan-in
 *    (else the shift would drag unrelated branches wider, so it stays put).
 */
function centerParentsOverChildren(graph: AsciiGraph): void {
  if (graph.config.graphDirection !== 'TD') return
  // Back edges and same-row edges route around the nodes they skip; moving
  // nodes under them scrambles those routes (State: Connection Lifecycle).
  // Only handle graphs where every edge points to a lower row.
  const flowsDown = graph.edges.every((e) => {
    const f = e.from.gridCoord
    const t = e.to.gridCoord
    return f !== null && t !== null && f.y < t.y
  })
  if (!flowsDown) return
  // Deepest first so a moved child doesn't invalidate its parent's span.
  const order = graph.nodes
    .filter((n) => n.gridCoord !== null)
    .sort((a, b) => requireGridCoord(b).y - requireGridCoord(a).y)
  for (const node of order) {
    const gc = requireGridCoord(node)
    if (isNodeInAnySubgraph(graph, node)) continue
    // No self-loops here: `flowsDown` rejected them.
    const children = getChildren(graph, node)
    if (children.length < 1) continue
    let ok = true
    for (const c of children) {
      const cgc = c.gridCoord
      if (
        cgc === null ||
        cgc.y !== gc.y + 4 ||
        isNodeInAnySubgraph(graph, c) ||
        graph.edges.some((e) => e.to === c && e.from !== node)
      ) {
        ok = false
        break
      }
    }
    if (!ok) continue
    const xs = children.map((c) => requireGridCoord(c).x)
    // Node slots sit on a stride of 4, so the midpoint of the outermost
    // children is a slot only for an odd count.
    let mid = (Math.min(...xs) + Math.max(...xs)) / 2
    // A child centered over its own straddled children sits on an odd column,
    // so two such children can have a half-column midpoint. Grid coordinates
    // are integers (a fractional one hangs the pathfinder), so leave it be.
    if (!Number.isInteger(mid)) continue
    if (mid % 4 !== 0) {
      if (mid + 2 <= gc.x) continue
      if (fitsStraddled(graph, node)) {
        relocateNode(graph, node, { x: mid, y: gc.y })
        continue
      }
      const own = new Set<AsciiNode>([node])
      const queue = [...children]
      for (let n = queue.pop(); n; n = queue.pop()) {
        if (own.has(n)) continue
        own.add(n)
        queue.push(...getChildren(graph, n))
      }
      // Co-parents of the node itself (the other half of a fan-in such as
      // `A & B --> C`) move with it: widening the gap between them is what
      // keeps the node centered under both.
      for (const e of graph.edges) if (e.to === node) own.add(e.from)
      const foreign = graph.nodes.some(
        (n) => n.gridCoord !== null && n.gridCoord.x > mid && !own.has(n),
      )
      if (foreign) continue
      shiftColumnsRight(graph, mid, 4)
      mid += 2
    }
    if (mid > gc.x) relocateNode(graph, node, { x: mid, y: gc.y })
  }
  markLabeledFanIn(graph)
}

/**
 * A node `fanInCenter` left alone because it fans out itself still takes
 * labelled edges from several parents: flag it so edge-routing gives each
 * edge its own side entry instead of one shared run that overprints the
 * labels (`X -->|one| A; Y -->|two| A; A --> B; A --> C`, #1364). Only reached
 * for TD graphs where every edge points down, which already rules out the
 * cycles `labeledFanInFits` guards; `hasLabeledFanIn` skips cluster edges.
 */
function markLabeledFanIn(graph: AsciiGraph): void {
  for (const node of graph.nodes) {
    if (node.fanInCentered) continue
    const into = graph.edges.filter((e) => e.to === node && e.from !== node)
    if (new Set(into.map((e) => e.from)).size < 2) continue
    if (!into.some((e) => e.text !== '')) continue
    node.fanInCentered = true
  }
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
  minLevels: ReadonlyMap<AsciiNode, number>,
): void {
  // Set once a pass stalls with children still held back for a cluster
  // entry (see `clusterEntrySources`): their sources can't all be placed
  // first (a back-edge into the cluster), so they go in on what is known.
  let forceHeld = false
  const reservedSlot = new Set<AsciiNode>()
  const centered = new Set<AsciiNode>()
  let progressed = true
  while (progressed) {
    progressed = false
    let held = false

    // Visit already-placed nodes in cross-axis order (left-to-right for TD,
    // top-to-bottom for LR) rather than raw `graph.nodes` declaration
    // order. `highestPositionPerLevel[level]` hands out each level's next
    // free slot in visiting order, so a parent that's actually positioned
    // further along the cross axis must also be visited later — otherwise
    // its children claim an earlier (visually misaligned) slot than a
    // parent positioned before it, decoupling a child's column/row from its
    // own parent's. This matters once sibling placement order can diverge
    // from `graph.nodes` order — e.g. `compareBySiblingSubgraphOrder`
    // above, which places a later-declared sibling subgraph's root before
    // an earlier-declared one's (see issue #444).
    const crossAxisOf = (n: AsciiNode): number =>
      graph.config.graphDirection === 'LR'
        ? (n.gridCoord?.y ?? 0)
        : (n.gridCoord?.x ?? 0)
    const placedNodes = graph.nodes
      .filter((n) => n.gridCoord !== null)
      .sort((a, b) => crossAxisOf(a) - crossAxisOf(b))

    for (const node of placedNodes) {
      const gc = node.gridCoord
      if (gc === null) continue // unreachable: `placedNodes` is pre-filtered

      // Sort children so siblings that land in different subgraphs get
      // mermaid.js's reversed-declaration-order sibling placement (see
      // compareBySiblingSubgraphOrder) instead of raw edge-declaration
      // order — the sort is stable, so pairs with no subgraph-order
      // preference (the common case) keep their original relative order.
      const children = [...getChildren(graph, node)].sort((x, y) =>
        compareBySiblingSubgraphOrder(graph, x, y),
      )
      for (const child of children) {
        if (child.gridCoord !== null) continue // already placed

        // An edge addressed to a subgraph (`Y --> Sub`) must land the whole
        // cluster below its source, as real mermaid ranks the cluster as
        // one node. Hold the entry member until every such source is on the
        // grid, then place it past the deepest one.
        const entrySources = clusterEntrySources(graph, child)
        if (!forceHeld && entrySources.some((s) => s.gridCoord === null)) {
          held = true
          // Keep the slot the held child would have taken at this level, so
          // a sibling placed meanwhile stays in line with its own parent
          // and the held child's edge drops through the gap.
          if (!reservedSlot.has(child)) {
            reservedSlot.add(child)
            const level =
              graph.config.graphDirection === 'LR' ? gc.x + 4 : gc.y + 4
            highestPositionPerLevel[level] =
              (highestPositionPerLevel[level] ?? 0) + 4
          }
          continue
        }

        // Determine direction for this edge (parent -> child)
        // Use subgraph direction only if both are in the same subgraph with override
        const parentSg = getNodeSubgraph(graph, node)
        const childSg = getNodeSubgraph(graph, child)
        const edgeDir =
          parentSg && parentSg === childSg && parentSg.direction
            ? parentSg.direction
            : graph.config.graphDirection

        let childLevel = edgeDir === 'LR' ? gc.x + 4 : gc.y + 4
        if (edgeDir === graph.config.graphDirection) {
          // Longest-path layering: a child sits below its deepest forward
          // parent even when a shallower parent happens to place it first.
          /* v8 ignore next -- every node reachable here was ranked by the DFS */
          childLevel = Math.max(childLevel, minLevels.get(child) ?? 0)
          for (const source of entrySources) {
            const sgc = source.gridCoord
            if (!sgc) continue
            childLevel = Math.max(
              childLevel,
              edgeDir === 'LR' ? sgc.x + 4 : sgc.y + 4,
            )
          }
        }

        // Determine position based on direction context
        let highestPosition: number
        if (edgeDir !== graph.config.graphDirection) {
          // Cross-direction: use parent's perpendicular coordinate
          // This keeps children aligned with parent when direction changes
          highestPosition = edgeDir === 'LR' ? gc.y : gc.x
        } else {
          // Same direction: use level tracker, but a cluster's entry member
          // sits centered under (beside) its sources as mermaid.js draws the
          // cluster, not under the first one. Never earlier than the
          // tracker's next free slot, so it cannot land on a sibling already
          // placed at this level.
          const center = fanInCenter(graph, child, childLevel)
          highestPosition = Math.max(
            highestPositionPerLevel[childLevel] ?? 0,
            center ?? 0,
            // A child of a centered node stays under it, not back at the
            // level's left edge.
            // Likewise when longest-path layering has pushed siblings off
            // this level, leaving the slots left of the parent empty.
            clearSlotBelow(graph, gc, child, childLevel, edgeDir === 'LR'),
          )
          if (center !== undefined && highestPosition === center) {
            centered.add(child)
            child.fanInCentered = true
          }
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
    if (!progressed && held && !forceHeld) {
      forceHeld = true
      progressed = true
    }
  }
}

/**
 * The cross-axis slot a child pushed `childLevel` away from its parent can
 * take: the parent's own slot, or the next one over while an unrelated node
 * already placed between them occupies it (so the edge is not forced to wrap around
 * that node, as `B --> D` does around `B --> C` when D ranks below C).
 */
function clearSlotBelow(
  graph: AsciiGraph,
  parent: GridCoord,
  child: AsciiNode,
  childLevel: number,
  lr: boolean,
): number {
  let slot = lr ? parent.y : parent.x
  const level = lr ? parent.x : parent.y
  const blocked = (): boolean =>
    graph.nodes.some((n) => {
      const c = n.gridCoord
      if (!c) return false
      const nl = lr ? c.x : c.y
      // A node that is itself a parent of the child is no obstacle: its
      // edge into the child runs alongside the longer one.
      return (
        (lr ? c.y : c.x) === slot &&
        nl > level &&
        nl < childLevel &&
        !getChildren(graph, n).includes(child)
      )
    })
  while (blocked()) slot += 4
  return slot
}

/**
 * The cross-axis slot that centers a cluster's entry member on the sources
 * already placed above it (left of it, for LR), or undefined when it is not a
 * cluster entry or fewer than two sources are. Back edges
 * (a parent at or past `childLevel`) say nothing about where the child sits
 * and are ignored. Parent slots are one node block wide, so the midpoint of
 * the outermost two is the centered block's origin.
 */
function fanInCenter(
  graph: AsciiGraph,
  child: AsciiNode,
  childLevel: number,
): number | undefined {
  const lr = graph.config.graphDirection === 'LR'
  const slots = new Set<number>()
  const parents = new Set<AsciiNode>()
  let entersCluster = false
  let labeled = false
  for (const edge of graph.edges) {
    if (edge.to !== child || edge.from === child) continue
    const gc = edge.from.gridCoord
    if (!gc || (lr ? gc.x : gc.y) >= childLevel) continue
    slots.add(lr ? gc.y : gc.x)
    parents.add(edge.from)
    if (edge.clusterTarget) entersCluster = true
    if (edge.text !== '') labeled = true
  }
  if (slots.size < 2) return undefined
  // A plain node with a labeled incoming edge centers only where each edge
  // can take a path of its own (see labeledFanInFits): unlabeled edges
  // bundle into one trunk, but labeled ones sharing the gap between the
  // parents would draw one label over the other.
  if (labeled && !entersCluster && !labeledFanInFits(graph, child, lr)) {
    return undefined
  }
  // Nor when a parent also feeds another node. `A & B --> C & D`: the
  // siblings would all claim the same midpoint and the later ones slide off
  // it, leaving the set lopsided against its parents. `B --> C; B --> D;
  // C --> D`: D's edge from C would ride the corridor of B's edge to C and
  // read as one that never arrives. They keep their own parents' slots.
  if (
    !entersCluster &&
    graph.edges.some(
      (e) => e.from !== e.to && e.to !== child && parents.has(e.from),
    )
  ) {
    return undefined
  }
  // Nor when the child fans out itself: `centerParentsOverChildren` already
  // positions it between its own children, and the two would pull it apart.
  if (!entersCluster) {
    const kids = new Set<AsciiNode>()
    for (const e of graph.edges) {
      if (e.from === child && e.to !== child) kids.add(e.to)
    }
    if (kids.size > 1) return undefined
  }
  // Nor when the child has an edge back up to a node already placed at or
  // before its level (`E --> B` closing a loop): the loop routes around the
  // nodes it skips, and moving the child off its first parent's column
  // scrambles that route.
  if (!entersCluster) {
    const back = graph.edges.some((e) => {
      const gc = e.to.gridCoord
      return (
        e.from === child &&
        e.to !== child &&
        gc !== null &&
        (lr ? gc.x : gc.y) <= childLevel
      )
    })
    if (back) return undefined
  }
  const lo = Math.min(...slots)
  const hi = Math.max(...slots)
  return Math.floor((lo + hi) / 2)
}

/**
 * Whether a labeled fan-in into `child` is one the side-entry route
 * (edge-routing.ts) handles without losing a label (#1339). Chosen by
 * rendering thousands of random labeled graphs and counting labels that
 * vanish: the shapes below are where centering made that worse. A parent
 * with another outgoing edge is excluded for every fan-in by `fanInCenter`.
 *  - LR: the face a parent enters by is the one the child's own out-edge may
 *    leave by, and the two edges meet.
 *  - A child on a cycle: a back edge's label widens the column the side
 *    entry ends in and detaches the arrowhead.
 */
function labeledFanInFits(
  graph: AsciiGraph,
  child: AsciiNode,
  lr: boolean,
): boolean {
  if (lr) return false
  return !reachesAnyParent(graph, child)
}

/** Whether following edges out of `node` leads back to a node that feeds it. */
function reachesAnyParent(graph: AsciiGraph, node: AsciiNode): boolean {
  const parents = new Set(
    graph.edges
      .filter((e) => e.to === node && e.from !== node)
      .map((e) => e.from),
  )
  const seen = new Set<AsciiNode>([node])
  const queue = [node]
  for (let n = queue.pop(); n; n = queue.pop()) {
    for (const e of graph.edges) {
      if (e.from !== n || seen.has(e.to)) continue
      if (parents.has(e.to)) return true
      seen.add(e.to)
      queue.push(e.to)
    }
  }
  return false
}

/**
 * The shallowest level (a multiple of 4, root = 0) each node may occupy under
 * longest-path layering, as dagre ranks it: a node sits below every parent
 * that reaches it over a forward edge. A forward DFS from `roots` classifies
 * back edges (an edge into a node still open on the stack, which closes a
 * cycle) and drops them, so `A --> B --> A` still ranks B one level below A.
 * Without this, `A --> B --> D` plus `A --> D` placed D beside B (its first
 * parent's level) and the `B --> D` edge ran sideways.
 */
function computeMinLevels(
  graph: AsciiGraph,
  roots: AsciiNode[],
): Map<AsciiNode, number> {
  const forward = new Map<AsciiNode, AsciiNode[]>()
  const state = new Map<AsciiNode, 'open' | 'done'>()
  const dfs = (node: AsciiNode): void => {
    state.set(node, 'open')
    const out: AsciiNode[] = []
    for (const child of getChildren(graph, node)) {
      if (child === node || state.get(child) === 'open') continue
      out.push(child)
      if (!state.has(child)) dfs(child)
    }
    forward.set(node, out)
    state.set(node, 'done')
  }
  for (const root of roots) if (!state.has(root)) dfs(root)

  // Longest path from any root over the acyclic forward edges, in reverse
  // post-order so every parent is ranked before its children.
  const levels = new Map<AsciiNode, number>()
  const order = [...forward.keys()].reverse()
  for (const node of order) levels.set(node, 0)
  for (const node of order) {
    /* v8 ignore next -- every node in `order` was seeded to 0 above */
    const next = (levels.get(node) ?? 0) + 4
    /* v8 ignore next -- every forward node has an entry */
    for (const child of forward.get(node) ?? []) {
      levels.set(child, Math.max(levels.get(child) ?? 0, next))
    }
  }
  return levels
}

/**
 * Sources of edges the author addressed to a subgraph id that the converter
 * redirected onto `node`, the cluster's entry member. Empty for every other
 * node, so graphs without subgraph-addressed targets are untouched. A source
 * inside the cluster is not one of them: an internal edge says nothing about
 * where the cluster sits, and counting it would push the entry member below
 * its own member (the same rule `buildClusterEntryRoute` applies).
 */
function clusterEntrySources(graph: AsciiGraph, node: AsciiNode): AsciiNode[] {
  const sources: AsciiNode[] = []
  for (const edge of graph.edges) {
    if (edge.to !== node || !edge.clusterTarget) continue
    if (edge.from === node || sources.includes(edge.from)) continue
    if (collectSubgraphMembers(edge.clusterTarget).includes(edge.from)) continue
    sources.push(edge.from)
  }
  return sources
}

/**
 * After `node` is moved off a frame (#1283), bring along a parent that only
 * feeds `node`: a free-standing root (no incoming edge, in no subgraph) is
 * moved to the same cross-axis slot, so `W --> Y` keeps dropping straight down
 * instead of wrapping around from W's side. A parent with any other role is
 * left where it is.
 */
function alignSoleParent(
  graph: AsciiGraph,
  node: AsciiNode,
  placed: GridCoord,
  lr: boolean,
): void {
  const parents = new Set(
    graph.edges
      .filter((e) => e.to === node && e.from !== node)
      .map((e) => e.from),
  )
  if (parents.size !== 1) return
  const [parent] = [...parents]
  const gc = parent!.gridCoord
  if (!gc || isNodeInAnySubgraph(graph, parent!)) return
  if (
    graph.edges.some(
      (e) => e.to === parent || (e.from === parent && e.to !== node),
    )
  ) {
    return
  }
  if (lr ? gc.y === placed.y : gc.x === placed.x) return
  for (let dx = 0; dx < NODE_BLOCK_SIZE; dx++) {
    for (let dy = 0; dy < NODE_BLOCK_SIZE; dy++) {
      graph.grid.delete(gridKey({ x: gc.x + dx, y: gc.y + dy }))
    }
  }
  reserveSpotInGrid(
    graph,
    parent!,
    lr ? { x: gc.x, y: placed.y } : { x: placed.x, y: gc.y },
  )
}

/**
 * Move any node that is not a member of a subgraph out of that subgraph's
 * grid span (#1252). A frame is drawn around the grid box of its members, and
 * level-based placement can drop an unrelated node into a column the box
 * spans (`Y` in `W --> Y --> Sub`, which only has an edge *into* the
 * cluster, lands beside `A` because both sit one level below their roots),
 * so the frame swallowed it. The node is released and re-reserved just past
 * the box's far edge on the cross axis (right in TD, below in LR), sliding on
 * as `reserveSpotInGrid` always does if that slot is taken. Repeats until no
 * frame holds a non-member, since the new slot can fall inside another frame.
 */
function separateNonMembersFromFrames(graph: AsciiGraph): void {
  const lr = graph.config.graphDirection === 'LR'
  for (let pass = 0; pass < graph.nodes.length + 1; pass++) {
    let moved = false
    for (const sg of graph.subgraphs) {
      const members = collectSubgraphMembers(sg)
      const box = memberGridBox(sg)
      if (!box) continue
      for (const node of graph.nodes) {
        const gc = node.gridCoord
        if (!gc || members.includes(node)) continue
        if (
          gc.x + 2 < box.minX ||
          gc.x > box.maxX ||
          gc.y + 2 < box.minY ||
          gc.y > box.maxY
        ) {
          continue
        }
        for (let dx = 0; dx < NODE_BLOCK_SIZE; dx++) {
          for (let dy = 0; dy < NODE_BLOCK_SIZE; dy++) {
            graph.grid.delete(gridKey({ x: gc.x + dx, y: gc.y + dy }))
          }
        }
        const placed = reserveSpotInGrid(
          graph,
          node,
          lr ? { x: gc.x, y: box.maxY + 2 } : { x: box.maxX + 2, y: gc.y },
        )
        alignSoleParent(graph, node, placed, lr)
        moved = true
      }
    }
    if (!moved) return
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

  // No "has an incoming edge from outside its subgraph" filter is applied to
  // `initialRoots`: a true root is never an edge target (bar a self-loop, which
  // stays inside its own subgraph), so such a filter could only ever drop a
  // *pseudo*-root — and for a cycle across sibling subgraphs (`A --> C --> E
  // --> A`, each in its own subgraph) that is the component's only seed, so
  // dropping it left the whole component unplaced (#1197).
  const rootNodes = initialRoots
  const minLevels = computeMinLevels(graph, rootNodes)

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

  // Deferred nodes grouped by their top-level subgraph, so the placement
  // loops below can attach each subgraph's deferred members to whichever of
  // its roots gets placed first — before any *other* subgraph's root gets a
  // chance to claim the adjacent slot (#301). Entries are removed as they're
  // resolved; `resolvedDeferred` then lets the later fallback pass skip
  // anything already placed this way.
  const deferredByTopSg = new Map<AsciiSubgraph, AsciiNode[]>()
  for (const node of deferredRoots) {
    const topSg = getTopLevelSubgraph(graph, node)!
    const list = deferredByTopSg.get(topSg)
    if (list) list.push(node)
    else deferredByTopSg.set(topSg, [node])
  }
  const resolvedDeferred = new Set<AsciiNode>()

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
    placeDeferredSiblingsNextToRoot(
      graph,
      node,
      deferredByTopSg,
      resolvedDeferred,
    )
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
      placeDeferredSiblingsNextToRoot(
        graph,
        node,
        deferredByTopSg,
        resolvedDeferred,
      )
    }
  }

  // Place child nodes level by level (reachable from the roots placed so far).
  placeReachableChildren(graph, highestPositionPerLevel, minLevels)

  // Now place whatever deferred subgraph-orphan roots weren't already
  // resolved above (anchored to a root placed in this same subgraph) —
  // these are the ones whose anchor is itself a non-root, only placed by
  // the reachable-children traversal just above.
  for (const node of deferredRoots) {
    if (resolvedDeferred.has(node)) continue
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
      // (topmost row for TD, leftmost column for LR).
      let anchor = placedSiblings[0]!
      for (const sibling of placedSiblings) {
        const isShallower =
          nodeDir === 'LR'
            ? sibling.gridCoord.x < anchor.gridCoord.x
            : sibling.gridCoord.y < anchor.gridCoord.y
        if (isShallower) anchor = sibling
      }
      // Slide along the shared axis to find free space next to the anchor,
      // staying clear of unrelated sibling subgraphs (#301) rather than
      // reserveSpotInGrid's subgraph-agnostic blind slide. Falls back to the
      // anchor's own coordinate (triggering the old blind slide inside
      // reserveSpotInGrid below) only when both directions are immediately
      // foreign-blocked.
      const axis: 'x' | 'y' = nodeDir === 'LR' ? 'y' : 'x'
      requested = findSubgraphAdjacentSlot(
        graph,
        anchor.gridCoord,
        topSg,
        axis,
        1,
      ) ?? { x: anchor.gridCoord.x, y: anchor.gridCoord.y }
    } else {
      // Defensive fallback — shouldn't normally happen, since we only defer
      // a node when it has a sibling that's guaranteed to be placed by the
      // traversal above. Fall back to ordinary root-level placement.
      requested =
        nodeDir === 'LR'
          ? { x: 0, y: highestPositionPerLevel[0] ?? 0 }
          : { x: highestPositionPerLevel[0] ?? 0, y: 0 }
      /* v8 ignore next */
      highestPositionPerLevel[0] = (highestPositionPerLevel[0] ?? 0) + 4
    }

    reserveSpotInGrid(graph, graph.nodes[node.index]!, requested, nodeDir)
  }

  // A deferred root may itself have children (edges) that couldn't be placed
  // above since it wasn't on the grid yet — give the traversal another pass.
  placeReachableChildren(graph, highestPositionPerLevel, minLevels)

  centerParentsOverChildren(graph)

  separateNonMembersFromFrames(graph)

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

  // Tag true parallel/multi-edges (same source AND target, e.g. two
  // separately-labeled A-->B edges) with a lane index before bundling
  // analysis runs, so determinePath below can route sibling edges past the
  // first through distinct offset lanes instead of all computing the
  // identical center path (see #329).
  assignParallelEdgeLanes(graph)

  // Give edges that leave a cluster through a shared exit (2+ of them) a
  // common flow-side stub — see cluster-boundary.ts. Needs the lane tags
  // above (parallel-lane edges keep lane routing) and the final node
  // placement, and runs before any edge is routed.
  planClusterExits(graph)

  // Analyze edges for bundling (parallel links like A & B --> C)
  // This groups edges that share sources or targets for cleaner visualization
  graph.bundles = analyzeEdgeBundles(graph)

  // Route bundled edges through junction points
  processBundles(graph)

  // Route non-bundled edges via A* and determine label positions.
  //
  // `cellStyles` tracks which line style has claimed each cell an edge's
  // path has passed through so far. After routing a non-bundled edge,
  // `rerouteAroundStyleConflicts` checks whether its path crosses a cell
  // already claimed by a *different*-style edge — e.g. a solid edge and a
  // dotted back-edge with no shared source or target, independently
  // finding the same empty column — and if so, re-routes just that edge
  // around the conflicting cell(s). Same-style overlap is left completely
  // untouched: it's how sibling/bundled edges are meant to share a trunk
  // (see edge-cell-styles.ts's module doc).
  //
  // `nodeOnlyGrid` snapshots `graph.grid` right here — after all node
  // placement and bundle routing (which doesn't itself reserve into
  // `graph.grid`; see routeBundledEdges), before any per-edge temporary
  // reroute reservations start mutating the live `graph.grid` below. See
  // `rerouteAroundStyleConflicts`'s doc for why the conflict check needs
  // this frozen copy instead of the live grid.
  const cellStyles = createEdgeCellStyles()
  const cellOwners = createEdgeCellOwners()
  const nodeOnlyGrid = cloneGrid(graph.grid)
  const frameAvoidingEdges = new Set<AsciiEdge>()
  for (const edge of graph.edges) {
    // Skip edges that were already routed as part of a bundle
    if (edge.bundle && edge.path.length > 0) {
      increaseGridSizeForPath(graph, edge.path)
      claimPathCells(nodeOnlyGrid, cellStyles, edge.path, edge.style)
      claimPathOwners(nodeOnlyGrid, cellOwners, edge.path, edge)
      continue
    }

    // Keep the route out of frames it has no endpoint in (#1197).
    const { added: frameCells, engaged } = blockUnrelatedFrames(graph, edge)
    if (engaged) frameAvoidingEdges.add(edge)
    const prevStraight = graph.preferStraightRoutes
    if (engaged) graph.preferStraightRoutes = true
    determinePath(graph, edge)
    rerouteAroundStyleConflicts(
      graph,
      edge,
      cellStyles,
      cellOwners,
      nodeOnlyGrid,
    )
    graph.preferStraightRoutes = prevStraight
    unblock(graph, frameCells)
    increaseGridSizeForPath(graph, edge.path)
    claimPathCells(nodeOnlyGrid, cellStyles, edge.path, edge.style)
    claimPathOwners(nodeOnlyGrid, cellOwners, edge.path, edge)
  }

  // Choose each label's segment only now that every path exists, so a label
  // avoids segments another edge also runs along and segments another label
  // already holds (#1347).
  const labelContext = createLabelContext(graph)
  for (const edge of graph.edges) determineLabelLine(graph, edge, labelContext)

  // Convert grid coords → drawing coords and generate box drawings
  for (const node of graph.nodes) {
    node.drawingCoord = gridToDrawingCoord(graph, requireGridCoord(node))
    node.drawing = drawBox(node, graph)
  }

  // Compute subgraph bounding boxes and the resulting drawing offset
  // *before* sizing the canvas. `offsetDrawingForSubgraphs` can set
  // `graph.offsetX`/`offsetY` to a positive shift (needed whenever a
  // subgraph's own border padding would otherwise push its content
  // negative) — every `gridToDrawingCoord` call, including the ones
  // draw.ts makes later for edge lines, adds that offset to its result.
  // Sizing the canvas *before* this offset is known (the previous order)
  // left it too narrow/short by exactly `offsetX`/`offsetY`: node boxes
  // were retroactively shifted to the correct position (see below), but
  // nothing widened the canvas array to match, so any edge line whose
  // drawing coordinate landed in that unreserved margin was silently
  // dropped by `write()`'s out-of-bounds clip — invisible whenever
  // nothing happened to route that close to the diagram's far edge, but
  // a real, reproducible content loss once something did (see #1093,
  // the `Error --> Idle : retry` edge in the "State: Composite States"
  // sample, whose rerouted path was the first to reach it).
  calculateSubgraphBoundingBoxes(graph)
  // Keep side-by-side frames at their natural width when a wide title makes
  // them touch (#1254).
  widenGapsForFrameTitles(graph)
  // A cluster-exit gutter narrower than its cluster's drawn wall (padding,
  // nesting, or LR label widening) is widened here, where the wall is first
  // known. Widening only shifts what lies past the gutter, so node drawing
  // coordinates are refreshed and the boxes recomputed once.
  if (widenClusterGutters(graph)) {
    for (const node of graph.nodes) {
      node.drawingCoord = gridToDrawingCoord(graph, requireGridCoord(node))
    }
    calculateSubgraphBoundingBoxes(graph)
  }
  // A title-widened frame can reach past the gap column an avoiding edge
  // runs in; widen the gap until the edge clears the wall (#1197).
  const refreshBoxes = (): void => {
    for (const node of graph.nodes) {
      node.drawingCoord = gridToDrawingCoord(graph, requireGridCoord(node))
    }
    calculateSubgraphBoundingBoxes(graph)
  }
  widenFrameGutters(graph, frameAvoidingEdges, refreshBoxes)
  // A title that would still hide an entering edge gets room (#1222). Runs
  // after the gutters so avoiding edges are already outside the frames; the
  // wider walls may need the gap widened once more.
  // Each trial width also re-clears the avoiding edges: left where they were,
  // they fall inside the growing frame and read as title collisions, so the
  // frame over-widens (Layer Two came out 24 wide for a 9-wide title).
  widenFramesForTitleStrokes(graph, () => {
    refreshBoxes()
    widenFrameGutters(graph, frameAvoidingEdges, refreshBoxes)
  })
  // The room a frame was given may reach its neighbour; open the gap (#1248).
  widenGapsForFrameTitles(graph)
  widenFrameGutters(graph, frameAvoidingEdges, refreshBoxes)
  offsetDrawingForSubgraphs(graph)

  // Set canvas size, now covering the offset computed above.
  setCanvasSizeToGrid(
    graph.canvas,
    graph.columnWidth,
    graph.rowHeight,
    graph.offsetX,
    graph.offsetY,
  )
  setRoleCanvasSizeToGrid(
    graph.roleCanvas,
    graph.columnWidth,
    graph.rowHeight,
    graph.offsetX,
    graph.offsetY,
  )
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

/**
 * Outermost-to-innermost chain of subgraphs directly containing `node`
 * (empty if the node isn't in any subgraph).
 */
function subgraphChain(graph: AsciiGraph, node: AsciiNode): AsciiSubgraph[] {
  const innermost = getNodeSubgraph(graph, node)
  const chain: AsciiSubgraph[] = []
  let current: AsciiSubgraph | null = innermost
  while (current !== null) {
    chain.unshift(current)
    current = current.parent
  }
  return chain
}

/**
 * Order two nodes the way real mermaid.js orders the sibling subgraphs they
 * (transitively) belong to, when they diverge into *different* subgraphs
 * under a shared subgraph ancestor (or both at the top level) — otherwise 0
 * (no preference; the caller's sort is stable, so original edge-declaration
 * order is preserved).
 *
 * Verified against mermaid@11.17.2's bundled flowDb.getData()
 * (node_modules/mermaid/dist/mermaid.min.js): it builds the layout node list
 * by iterating the parsed `subGraphs` array *backwards* to emit cluster
 * nodes, so sibling subgraphs end up in reversed declaration order in the
 * graph the layout engine actually sees — see the matching comment in
 * `../layout-engine/to-elk.ts`'s `mermaidToElk`, and issue #444. The ASCII
 * grid has no compound-node concept for the layout engine to order — node
 * position here is driven entirely by BFS descent from edges (see
 * `placeReachableChildren`) — so this comparator recovers the same visual
 * left-right order by reordering sibling children at the point they'd
 * otherwise be placed in raw edge-declaration order.
 */
function compareBySiblingSubgraphOrder(
  graph: AsciiGraph,
  a: AsciiNode,
  b: AsciiNode,
): number {
  const chainA = subgraphChain(graph, a)
  const chainB = subgraphChain(graph, b)
  let i = 0
  while (i < chainA.length && i < chainB.length && chainA[i] === chainB[i]) {
    i++
  }
  const sgA = chainA[i]
  const sgB = chainB[i]
  if (!sgA || !sgB || sgA === sgB) return 0
  // Reversed declaration order: later-declared sibling sorts first. Sibling
  // relative declaration order is recovered from each one's position in the
  // flat `graph.subgraphs` list, which preserves source order (see
  // `convertSubgraph`'s pre-order-DFS push in converter.ts).
  return graph.subgraphs.indexOf(sgB) - graph.subgraphs.indexOf(sgA)
}

/** Get all direct children of a node (targets of outgoing edges). */
function getChildren(graph: AsciiGraph, node: AsciiNode): AsciiNode[] {
  return getEdgesFromNode(graph, node).map((e) => e.to)
}
