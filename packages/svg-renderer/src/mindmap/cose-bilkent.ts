/**
 * Deterministic, dependency-free port of the CoSE-Bilkent layout that mermaid
 * runs for mindmaps, specialised to a single tree.
 *
 * Derived from (all MIT licensed):
 *   - cytoscape-cose-bilkent 4.1.0  Copyright (c) 2016-2018, The Cytoscape Consortium
 *   - cose-base 1.0.3               Copyright (c) 2019 - present, iVis@Bilkent
 *   - layout-base 1.0.2             Copyright (c) 2019 iVis@Bilkent
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * the original software and associated documentation files, to deal in it without
 * restriction, subject to the above copyright notices and the MIT permission
 * notice being included in all copies or substantial portions of the software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 *
 * Options reproduced: `{ quality: 'proof', styleEnabled: false, animate: false }`
 * with every other option at the cytoscape-cose-bilkent default (randomize true,
 * nodeRepulsion 4500, idealEdgeLength 50, edgeElasticity 0.45, gravity 0.25,
 * numIter 2500, tile true, ...).
 *
 * What is dropped, and why the output is unchanged for a tree:
 *   - Compound graphs / inclusion-tree / lowest-common-ancestor bookkeeping: the
 *     graph is flat, so every edge is intra-graph and ideal length is the plain 50.
 *   - Tiling of zero-degree nodes: a tree has none (a lone root is a group of one).
 *   - Gravity: only applied to nodes of a disconnected graph; a tree is connected.
 *   - Random scatter, tree reduction and tree growing: only used when the graph is
 *     not a forest. A tree always takes the radial-initial-placement path, so
 *     the seeded `Math.sin` PRNG is never consulted.
 *   - Multi-component packing (one tree => one column), animation and `fit`.
 *
 * Floating-point operation order follows the original so results match it.
 * Input that is not a single tree (cycle, several components) throws.
 */

export interface CoseNode {
  id: string
  width: number
  height: number
}
export interface CoseEdge {
  source: string
  target: string
}

// ---- constants (cose-base / layout-base defaults after cytoscape-cose-bilkent options) ----
const NODE_REPULSION = 4500
const IDEAL_EDGE_LENGTH = 50
const SPRING_STRENGTH = 0.45
const MAX_ITERATIONS = 2500
const MAX_NODE_DISPLACEMENT = 300 // 100 * 3
const MIN_REPULSION_DIST = IDEAL_EDGE_LENGTH / 10
const CONVERGENCE_CHECK_PERIOD = 100
const GRID_CALCULATION_CHECK_PERIOD = 10
const DISPLACEMENT_THRESHOLD_PER_NODE = (3.0 * IDEAL_EDGE_LENGTH) / 100
const GRAPH_MARGIN = 15
const WORLD_CENTER_X = 1200
const WORLD_CENTER_Y = 900
const RADIAL_SEPARATION = IDEAL_EDGE_LENGTH
const TWO_PI = 2.0 * Math.PI
const INT_MIN = -2147483648
const INT_MAX = 2147483647

interface LNode {
  id: string
  // top-left corner and size (layout-base RectangleD)
  x: number
  y: number
  width: number
  height: number
  edges: LEdge[]
  springForceX: number
  springForceY: number
  repulsionForceX: number
  repulsionForceY: number
  startX: number
  finishX: number
  startY: number
  finishY: number
  surrounding: LNode[]
}

interface LEdge {
  source: LNode
  target: LNode
  lengthX: number
  lengthY: number
  length: number
  overlapping: boolean
}

/** Clipping points: (x0, y0) on the first rect, (x1, y1) on the second. */
interface Clip {
  x0: number
  y0: number
  x1: number
  y1: number
}

const centerX = (n: LNode): number => n.x + n.width / 2
const centerY = (n: LNode): number => n.y + n.height / 2
const right = (n: LNode): number => n.x + n.width
const bottom = (n: LNode): number => n.y + n.height
const sign = (v: number): number => (v > 0 ? 1 : v < 0 ? -1 : 0)
const otherEnd = (e: LEdge, n: LNode): LNode =>
  e.source === n ? e.target : e.source

function neighbors(n: LNode): Set<LNode> {
  const s = new Set<LNode>()
  for (const e of n.edges) s.add(e.source === n ? e.target : e.source)
  return s
}

function intersects(a: LNode, b: LNode): boolean {
  if (right(a) < b.x) return false
  if (bottom(a) < b.y) return false
  if (right(b) < a.x) return false
  if (bottom(b) < a.y) return false
  return true
}

// ---- IGeometry ----

function getCardinalDirection(
  slope: number,
  slopePrime: number,
  line: number,
): number {
  return slope > slopePrime ? line : 1 + (line % 4)
}

/** IGeometry.getIntersection2: clip points of two rects on the centre-to-centre line. */
function getIntersection(a: LNode, b: LNode, out: Clip): boolean {
  const p1x = centerX(a)
  const p1y = centerY(a)
  const p2x = centerX(b)
  const p2y = centerY(b)

  if (intersects(a, b)) {
    out.x0 = p1x
    out.y0 = p1y
    out.x1 = p2x
    out.y1 = p2y
    return true
  }
  const topLeftAx = a.x
  const topLeftAy = a.y
  const topRightAx = right(a)
  const bottomLeftAx = a.x
  const bottomLeftAy = bottom(a)
  const bottomRightAx = right(a)
  const halfWidthA = a.width / 2
  const halfHeightA = a.height / 2
  const topLeftBx = b.x
  const topLeftBy = b.y
  const topRightBx = right(b)
  const bottomLeftBx = b.x
  const bottomLeftBy = bottom(b)
  const bottomRightBx = right(b)
  const halfWidthB = b.width / 2
  const halfHeightB = b.height / 2

  let clipPointAFound = false
  let clipPointBFound = false

  if (p1x === p2x) {
    // Vertical line
    if (p1y > p2y) {
      out.x0 = p1x
      out.y0 = topLeftAy
      out.x1 = p2x
      out.y1 = bottomLeftBy
      return false
    } else if (p1y < p2y) {
      out.x0 = p1x
      out.y0 = bottomLeftAy
      out.x1 = p2x
      out.y1 = topLeftBy
      return false
    }
  } else if (p1y === p2y) {
    // Horizontal line
    if (p1x > p2x) {
      out.x0 = topLeftAx
      out.y0 = p1y
      out.x1 = topRightBx
      out.y1 = p2y
      return false
    } else if (p1x < p2x) {
      out.x0 = topRightAx
      out.y0 = p1y
      out.x1 = topLeftBx
      out.y1 = p2y
      return false
    }
  } else {
    const slopeA = a.height / a.width
    const slopeB = b.height / b.width
    const slopePrime = (p2y - p1y) / (p2x - p1x)

    if (-slopeA === slopePrime) {
      if (p1x > p2x) {
        out.x0 = bottomLeftAx
        out.y0 = bottomLeftAy
      } else {
        out.x0 = topRightAx
        out.y0 = topLeftAy
      }
      clipPointAFound = true
    } else if (slopeA === slopePrime) {
      if (p1x > p2x) {
        out.x0 = topLeftAx
        out.y0 = topLeftAy
      } else {
        out.x0 = bottomRightAx
        out.y0 = bottomLeftAy
      }
      clipPointAFound = true
    }

    if (-slopeB === slopePrime) {
      if (p2x > p1x) {
        out.x1 = bottomLeftBx
        out.y1 = bottomLeftBy
      } else {
        out.x1 = topRightBx
        out.y1 = topLeftBy
      }
      clipPointBFound = true
    } else if (slopeB === slopePrime) {
      if (p2x > p1x) {
        out.x1 = topLeftBx
        out.y1 = topLeftBy
      } else {
        out.x1 = bottomRightBx
        out.y1 = bottomLeftBy
      }
      clipPointBFound = true
    }

    if (clipPointAFound && clipPointBFound) return false

    let dirA: number
    let dirB: number
    if (p1x > p2x) {
      if (p1y > p2y) {
        dirA = getCardinalDirection(slopeA, slopePrime, 4)
        dirB = getCardinalDirection(slopeB, slopePrime, 2)
      } else {
        dirA = getCardinalDirection(-slopeA, slopePrime, 3)
        dirB = getCardinalDirection(-slopeB, slopePrime, 1)
      }
    } else if (p1y > p2y) {
      dirA = getCardinalDirection(-slopeA, slopePrime, 1)
      dirB = getCardinalDirection(-slopeB, slopePrime, 3)
    } else {
      dirA = getCardinalDirection(slopeA, slopePrime, 2)
      dirB = getCardinalDirection(slopeB, slopePrime, 4)
    }

    if (!clipPointAFound) {
      switch (dirA) {
        case 1:
          out.y0 = topLeftAy
          out.x0 = p1x + -halfHeightA / slopePrime
          break
        case 2:
          out.x0 = bottomRightAx
          out.y0 = p1y + halfWidthA * slopePrime
          break
        case 3:
          out.y0 = bottomLeftAy
          out.x0 = p1x + halfHeightA / slopePrime
          break
        case 4:
          out.x0 = bottomLeftAx
          out.y0 = p1y + -halfWidthA * slopePrime
          break
      }
    }
    if (!clipPointBFound) {
      switch (dirB) {
        case 1:
          out.y1 = topLeftBy
          out.x1 = p2x + -halfHeightB / slopePrime
          break
        case 2:
          out.x1 = bottomRightBx
          out.y1 = p2y + halfWidthB * slopePrime
          break
        case 3:
          out.y1 = bottomLeftBy
          out.x1 = p2x + halfHeightB / slopePrime
          break
        case 4:
          out.x1 = bottomLeftBx
          out.y1 = p2y + -halfWidthB * slopePrime
          break
      }
    }
  }
  return false
}

/** IGeometry.calcSeparationAmount: half the x/y push needed to separate two overlapping rects. */
function calcSeparationAmount(
  a: LNode,
  b: LNode,
  separationBuffer: number,
): { x: number; y: number } {
  const dir0 = centerX(a) < centerX(b) ? -1 : 1
  const dir1 = centerY(a) < centerY(b) ? -1 : 1

  let ox = Math.min(right(a), right(b)) - Math.max(a.x, b.x)
  let oy = Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y)

  if (a.x <= b.x && right(a) >= right(b)) {
    ox += Math.min(b.x - a.x, right(a) - right(b))
  } else if (b.x <= a.x && right(b) >= right(a)) {
    ox += Math.min(a.x - b.x, right(b) - right(a))
  }
  if (a.y <= b.y && bottom(a) >= bottom(b)) {
    oy += Math.min(b.y - a.y, bottom(a) - bottom(b))
  } else if (b.y <= a.y && bottom(b) >= bottom(a)) {
    oy += Math.min(a.y - b.y, bottom(b) - bottom(a))
  }

  let slope = Math.abs((centerY(b) - centerY(a)) / (centerX(b) - centerX(a)))
  if (centerY(b) === centerY(a) && centerX(b) === centerX(a)) slope = 1.0

  let moveByY = slope * ox
  let moveByX = oy / slope
  if (ox < moveByX) {
    moveByX = ox
  } else {
    moveByY = oy
  }
  return {
    x: -1 * dir0 * (moveByX / 2 + separationBuffer),
    y: -1 * dir1 * (moveByY / 2 + separationBuffer),
  }
}

// ---- initial radial placement (CoSELayout.positionNodesRadially, one tree) ----

/** Layout.findCenterOfTree, including its quirky in-loop splicing, verbatim. */
function findCenterOfTree(nodes: LNode[]): LNode {
  const list = nodes.slice()
  let removed: LNode[] = []
  const remainingDegrees = new Map<LNode, number>()
  let center: LNode | undefined

  if (list.length === 1 || list.length === 2) center = list[0]

  for (const node of list) {
    const degree = neighbors(node).size
    remainingDegrees.set(node, degree)
    if (degree === 1) removed.push(node)
  }

  let tempList = removed.slice()
  while (center === undefined) {
    tempList = []
    // The original deliberately(?) splices `list` while indexing it
    for (let i = 0; i < list.length; i++) {
      const node = list[i]
      if (node === undefined) break
      const index = list.indexOf(node)
      if (index >= 0) list.splice(index, 1)
      for (const neighbour of neighbors(node)) {
        if (removed.indexOf(neighbour) < 0) {
          const newDegree = (remainingDegrees.get(neighbour) ?? 0) - 1
          if (newDegree === 1) tempList.push(neighbour)
          remainingDegrees.set(neighbour, newDegree)
        }
      }
    }
    removed = removed.concat(tempList)
    if (list.length === 1 || list.length === 2) center = list[0]
  }
  return center
}

function branchRadialLayout(
  node: LNode,
  parentOfNode: LNode | null,
  startAngle: number,
  endAngle: number,
  distance: number,
  radialSeparation: number,
): void {
  let halfInterval = (endAngle - startAngle + 1) / 2
  if (halfInterval < 0) halfInterval += 180

  const nodeAngle = (halfInterval + startAngle) % 360
  const teta = (nodeAngle * TWO_PI) / 360

  const x = distance * Math.cos(teta)
  const y = distance * Math.sin(teta)
  node.x = x - node.width / 2
  node.y = y - node.height / 2

  const neighborEdges = node.edges.slice()
  let childCount = neighborEdges.length
  if (parentOfNode !== null) childCount--

  const incEdgesCount = neighborEdges.length
  let startIndex = 0
  if (parentOfNode !== null) {
    const parentEdge = neighborEdges.find(
      (e) => e.source === parentOfNode || e.target === parentOfNode,
    )
    startIndex =
      parentEdge === undefined
        ? 0
        : (neighborEdges.indexOf(parentEdge) + 1) % incEdgesCount
  }

  const stepAngle = Math.abs(endAngle - startAngle) / childCount
  let branchCount = 0
  for (
    let i = startIndex;
    branchCount !== childCount;
    i = (i + 1) % incEdgesCount
  ) {
    const edge = neighborEdges[i]
    if (edge === undefined) break
    const currentNeighbor = otherEnd(edge, node)
    if (currentNeighbor === parentOfNode) continue

    const childStartAngle = (startAngle + branchCount * stepAngle) % 360
    const childEndAngle = (childStartAngle + stepAngle) % 360
    branchRadialLayout(
      currentNeighbor,
      node,
      childStartAngle,
      childEndAngle,
      distance + radialSeparation,
      radialSeparation,
    )
    branchCount++
  }
}

/** LGraph.calculateBounds -> RectangleD(left, top, right - left, bottom - top). */
function calculateBounds(nodes: LNode[]): {
  x: number
  y: number
  width: number
  height: number
} {
  let left = INT_MAX
  let r = -INT_MAX
  let top = INT_MAX
  let b = -INT_MAX
  for (const n of nodes) {
    if (left > n.x) left = n.x
    if (r < right(n)) r = right(n)
    if (top > n.y) top = n.y
    if (b < bottom(n)) b = bottom(n)
  }
  return { x: left, y: top, width: r - left, height: b - top }
}

/**
 * Layout.transform(newLeftTop): translate so the graph's margin-expanded top-left
 * lands on (wox, woy).
 */
function transformTo(nodes: LNode[], wox: number, woy: number): void {
  let top = INT_MAX
  let left = INT_MAX
  for (const n of nodes) {
    if (top > n.y) top = n.y
    if (left > n.x) left = n.x
  }
  const dox = left - GRAPH_MARGIN
  const doy = top - GRAPH_MARGIN
  for (const n of nodes) {
    n.x = wox + (n.x - dox)
    n.y = woy + (n.y - doy)
  }
}

function positionNodesRadially(tree: LNode[]): void {
  const center = findCenterOfTree(tree)

  let maxDiagonal = INT_MIN
  for (const n of tree) {
    const d = Math.sqrt(n.width * n.width + n.height * n.height)
    if (d > maxDiagonal) maxDiagonal = d
  }
  const radialSep = Math.max(maxDiagonal, RADIAL_SEPARATION)
  branchRadialLayout(center, null, 0, 359, 0, radialSep)

  const bounds = calculateBounds(tree)
  for (const n of tree) {
    n.x = 0 + (n.x - bounds.x)
    n.y = 0 + (n.y - bounds.y)
  }
  // inverseTransformPoint(bottom-right) with the transform above
  const pointX = 0 + (bounds.x + bounds.width - bounds.x)
  const pointY = 0 + (bounds.y + bounds.height - bounds.y)

  transformTo(tree, WORLD_CENTER_X - pointX / 2, WORLD_CENTER_Y - pointY / 2)
}

// ---- spring embedder ----

interface Embedder {
  nodes: LNode[]
  edges: LEdge[]
  repulsionRange: number
  grid: LNode[][][]
}

function cell(g: LNode[][][], i: number, j: number): LNode[] {
  const c = g[i]?.[j]
  if (c === undefined) throw new Error('cose-bilkent: grid index out of range')
  return c
}

function updateGrid(s: Embedder): void {
  // Root graph bounds (LGraph.updateBounds)
  let l = INT_MAX
  let r = -INT_MAX
  let t = INT_MAX
  let b = -INT_MAX
  for (const n of s.nodes) {
    if (l > n.x) l = n.x
    if (r < right(n)) r = right(n)
    if (t > n.y) t = n.y
    if (b < bottom(n)) b = bottom(n)
  }
  const rectX = l
  const rectY = t
  const rectW = r - l
  const rectH = b - t
  const gLeft = rectX - GRAPH_MARGIN
  const gRight = rectX + rectW + GRAPH_MARGIN
  const gTop = rectY - GRAPH_MARGIN
  const gBottom = rectY + rectH + GRAPH_MARGIN

  const range = s.repulsionRange
  const sizeX = Math.ceil((gRight - gLeft) / range)
  const sizeY = Math.ceil((gBottom - gTop) / range)
  const grid: LNode[][][] = []
  for (let i = 0; i < sizeX; i++) {
    const col: LNode[][] = []
    for (let j = 0; j < sizeY; j++) col.push([])
    grid.push(col)
  }
  s.grid = grid

  for (const v of s.nodes) {
    const startX = Math.floor((v.x - gLeft) / range)
    const finishX = Math.floor((v.width + v.x - gLeft) / range)
    const startY = Math.floor((v.y - gTop) / range)
    const finishY = Math.floor((v.height + v.y - gTop) / range)
    for (let i = startX; i <= finishX; i++) {
      for (let j = startY; j <= finishY; j++) {
        cell(grid, i, j).push(v)
        v.startX = startX
        v.finishX = finishX
        v.startY = startY
        v.finishY = finishY
      }
    }
  }
}

function updateLength(e: LEdge, clip: Clip): void {
  e.overlapping = getIntersection(e.target, e.source, clip)
  if (!e.overlapping) {
    e.lengthX = clip.x0 - clip.x1
    e.lengthY = clip.y0 - clip.y1
    if (Math.abs(e.lengthX) < 1.0) e.lengthX = sign(e.lengthX)
    if (Math.abs(e.lengthY) < 1.0) e.lengthY = sign(e.lengthY)
    e.length = Math.sqrt(e.lengthX * e.lengthX + e.lengthY * e.lengthY)
  }
}

function calcSpringForces(s: Embedder, clip: Clip): void {
  for (const e of s.edges) {
    updateLength(e, clip)
    if (e.overlapping) continue
    const length = e.length
    if (length === 0) continue
    const springForce = SPRING_STRENGTH * (length - IDEAL_EDGE_LENGTH)
    const fx = springForce * (e.lengthX / length)
    const fy = springForce * (e.lengthY / length)
    e.source.springForceX += fx
    e.source.springForceY += fy
    e.target.springForceX -= fx
    e.target.springForceY -= fy
  }
}

function calcRepulsionForce(a: LNode, b: LNode, clip: Clip): void {
  if (intersects(a, b)) {
    const sep = calcSeparationAmount(a, b, IDEAL_EDGE_LENGTH / 2.0)
    const fx = 2 * sep.x
    const fy = 2 * sep.y
    // Every flat-graph node weighs 1: 1 * 1 / (1 + 1)
    const childrenConstant = (1 * 1) / (1 + 1)
    a.repulsionForceX -= childrenConstant * fx
    a.repulsionForceY -= childrenConstant * fy
    b.repulsionForceX += childrenConstant * fx
    b.repulsionForceY += childrenConstant * fy
  } else {
    getIntersection(a, b, clip)
    let distanceX = clip.x1 - clip.x0
    let distanceY = clip.y1 - clip.y0

    if (Math.abs(distanceX) < MIN_REPULSION_DIST)
      distanceX = sign(distanceX) * MIN_REPULSION_DIST
    if (Math.abs(distanceY) < MIN_REPULSION_DIST)
      distanceY = sign(distanceY) * MIN_REPULSION_DIST

    const distanceSquared = distanceX * distanceX + distanceY * distanceY
    const distance = Math.sqrt(distanceSquared)
    const repulsionForce = (NODE_REPULSION * 1 * 1) / distanceSquared
    const fx = (repulsionForce * distanceX) / distance
    const fy = (repulsionForce * distanceY) / distance

    a.repulsionForceX -= fx
    a.repulsionForceY -= fy
    b.repulsionForceX += fx
    b.repulsionForceY += fy
  }
}

function calcRepulsionForces(
  s: Embedder,
  totalIterations: number,
  clip: Clip,
): void {
  const gridTick = totalIterations % GRID_CALCULATION_CHECK_PERIOD === 1
  if (gridTick) updateGrid(s)

  const processed = new Set<LNode>()
  for (const a of s.nodes) {
    if (gridTick) {
      const surrounding = new Set<LNode>()
      const grid = s.grid
      for (let i = a.startX - 1; i < a.finishX + 2; i++) {
        for (let j = a.startY - 1; j < a.finishY + 2; j++) {
          const col = grid[i]
          const bucket = col === undefined ? undefined : col[j]
          if (i < 0 || j < 0 || bucket === undefined) continue
          for (const b of bucket) {
            if (a === b) continue
            if (!processed.has(b) && !surrounding.has(b)) {
              const distanceX =
                Math.abs(centerX(a) - centerX(b)) - (a.width / 2 + b.width / 2)
              const distanceY =
                Math.abs(centerY(a) - centerY(b)) -
                (a.height / 2 + b.height / 2)
              if (
                distanceX <= s.repulsionRange &&
                distanceY <= s.repulsionRange
              ) {
                surrounding.add(b)
              }
            }
          }
        }
      }
      a.surrounding = [...surrounding]
    }
    for (const b of a.surrounding) calcRepulsionForce(a, b, clip)
    processed.add(a)
  }
}

/** Returns the total displacement of this step. */
function moveNodes(nodes: LNode[], coolingFactor: number): number {
  let total = 0
  const cap = coolingFactor * MAX_NODE_DISPLACEMENT
  for (const n of nodes) {
    // Gravity is never applied to a connected graph, so its term is omitted
    let dx = (coolingFactor * (n.springForceX + n.repulsionForceX)) / 1
    let dy = (coolingFactor * (n.springForceY + n.repulsionForceY)) / 1
    if (Math.abs(dx) > cap) dx = cap * sign(dx)
    if (Math.abs(dy) > cap) dy = cap * sign(dy)
    n.x += dx
    n.y += dy
    total += Math.abs(dx) + Math.abs(dy)
    n.springForceX = 0
    n.springForceY = 0
    n.repulsionForceX = 0
    n.repulsionForceY = 0
  }
  return total
}

// ---- public entry ----

/**
 * Lay out a tree with CoSE-Bilkent. `nodes` must be in the order mermaid adds
 * them (DFS pre-order, root first) and `edges` in parent-to-child order, as that
 * order feeds the algorithm. Returns node centres.
 */
export function coseBilkentLayout(
  nodes: CoseNode[],
  edges: CoseEdge[],
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>()
  if (nodes.length === 0) return result

  const byId = new Map<string, LNode>()
  const lnodes: LNode[] = nodes.map((n) => {
    const ln: LNode = {
      id: n.id,
      x: 0 - n.width / 2,
      y: 0 - n.height / 2,
      width: n.width,
      height: n.height,
      edges: [],
      springForceX: 0,
      springForceY: 0,
      repulsionForceX: 0,
      repulsionForceY: 0,
      startX: 0,
      finishX: 0,
      startY: 0,
      finishY: 0,
      surrounding: [],
    }
    byId.set(n.id, ln)
    return ln
  })

  const ledges: LEdge[] = []
  for (const e of edges) {
    const source = byId.get(e.source)
    const target = byId.get(e.target)
    if (source === undefined || target === undefined) {
      throw new Error(
        `cose-bilkent: edge ${e.source}->${e.target} references an unknown node`,
      )
    }
    if (
      source === target ||
      source.edges.some((x) => x.source === target || x.target === target)
    ) {
      continue
    }
    const le: LEdge = {
      source,
      target,
      lengthX: 0,
      lengthY: 0,
      length: 0,
      overlapping: false,
    }
    source.edges.push(le)
    target.edges.push(le)
    ledges.push(le)
  }

  // Layout.getFlatForest: BFS from the first node; a tree must reach every node without a cycle.
  const first = lnodes[0]
  if (first === undefined) return result
  const visited = new Set<LNode>()
  const parents = new Map<LNode, LNode>()
  const queue: LNode[] = [first]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    visited.add(current)
    for (const edge of current.edges) {
      const neighbor = otherEnd(edge, current)
      if (parents.get(current) !== neighbor) {
        if (visited.has(neighbor))
          throw new Error('cose-bilkent: input graph contains a cycle')
        queue.push(neighbor)
        parents.set(neighbor, current)
      }
    }
  }
  if (visited.size !== lnodes.length) {
    throw new Error('cose-bilkent: input graph must be a single tree')
  }
  positionNodesRadially([...visited])

  // initSpringEmbedder / runSpringEmbedder (quality 'proof': coolingAdjuster stays 1)
  const n = lnodes.length
  const maxIterations = Math.max(n * 5, MAX_ITERATIONS)
  const totalDisplacementThreshold = DISPLACEMENT_THRESHOLD_PER_NODE * n
  const maxCoolingCycle = MAX_ITERATIONS / CONVERGENCE_CHECK_PERIOD
  const finalTemperature = CONVERGENCE_CHECK_PERIOD / MAX_ITERATIONS
  const initialCoolingFactor = 1.0
  const state: Embedder = {
    nodes: lnodes,
    edges: ledges,
    repulsionRange: 2 * (0 + 1) * IDEAL_EDGE_LENGTH,
    grid: [],
  }
  const clip: Clip = { x0: 0, y0: 0, x1: 0, y1: 0 }

  let coolingFactor = initialCoolingFactor
  let coolingCycle = 0
  let totalIterations = 0
  let totalDisplacement = 0
  let oldTotalDisplacement = 0

  for (;;) {
    totalIterations++
    if (totalIterations === maxIterations) break

    if (totalIterations % CONVERGENCE_CHECK_PERIOD === 0) {
      // FDLayout.isConverged
      let oscillating = false
      if (totalIterations > maxIterations / 3) {
        oscillating = Math.abs(totalDisplacement - oldTotalDisplacement) < 2
      }
      const converged = totalDisplacement < totalDisplacementThreshold
      oldTotalDisplacement = totalDisplacement
      if (converged || oscillating) break

      coolingCycle++
      coolingFactor = Math.max(
        initialCoolingFactor -
          (Math.pow(
            coolingCycle,
            Math.log(100 * (initialCoolingFactor - finalTemperature)) /
              Math.log(maxCoolingCycle),
          ) /
            100) *
            1,
        finalTemperature,
      )
    }

    calcSpringForces(state, clip)
    calcRepulsionForces(state, totalIterations, clip)
    totalDisplacement = moveNodes(lnodes, coolingFactor)
  }

  // Layout.doPostLayout: move the margin-expanded top-left to the origin
  transformTo(lnodes, 0, 0)

  for (const ln of lnodes) {
    result.set(ln.id, { x: ln.x + ln.width / 2, y: ln.y + ln.height / 2 })
  }
  return result
}
