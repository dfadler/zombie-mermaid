/**
 * Layout for a flowchart with subgraphs, arranged the way mermaid.js arranges it.
 *
 * ELK lays a subgraph's contents out as a block before the nodes around it, so
 * a node outside the subgraph can never sit beside a node deep inside it, and
 * an edge from outside can't pull a member down to a later layer. mermaid.js
 * (dagre) lays the whole graph out flat, ranks every node on its own, and draws
 * each subgraph as a box around its members, with the nodes that don't belong
 * to it placed beside the box. In the CI/CD sample, `Deploy Staging`,
 * `QA Approved?` and `Production` form a column to the left of the pipeline's
 * box, and `Fix & Retry` sits at the bottom of the box, level with `Production`.
 *
 * This does the same with ELK:
 *
 * 1. Lay the graph out flat (no subgraphs) to learn the layers and the order of
 *    the nodes within them.
 * 2. Keep each subgraph's box clear of the nodes beside it. In a layer between
 *    a subgraph's first and last member where it has no member, add an
 *    invisible *spine* node, chained to the subgraph's members in the layers
 *    on either side. It stands for the box in that layer, so ELK keeps the
 *    other nodes of the layer out of the box's way.
 * 3. Give ELK the nodes in a left-to-right order that keeps each subgraph's
 *    nodes together, with each outsider on the side of the subgraph its
 *    connections already put it on, and lay it out again.
 * 4. Draw each subgraph's box around its members. If a box would still cover a
 *    node that isn't a member, widen that subgraph's spine nodes (they start
 *    narrow) and lay out again.
 *
 * The spine nodes and their edges are layout scaffolding: they are dropped from
 * the result. If the boxes can't be made to clear the other nodes, `undefined`
 * is returned and the caller uses the nested layout instead.
 */

import type {
  Direction,
  MermaidEdge,
  MermaidGraph,
  MermaidNode,
  MermaidSubgraph,
  PositionedEdge,
  PositionedGraph,
  PositionedGroup,
  PositionedNode,
} from '@zombie-mermaid/core'
import { measureMultilineText } from '@zombie-mermaid/core'
import type { FontSizes } from '../styles.ts'
import { ARROW_HEAD, FONT_WEIGHTS } from '../styles.ts'
import { DEFAULTS } from './constants.ts'
import { resolveEdgeStyle } from './from-elk.ts'
import { labelSpot, routeInnerEdge } from './inner-edges.ts'
import type { LayoutHints } from './layout-hints.ts'
import {
  SUBGRAPH_PADDING,
  hasAnyDirectionOverride,
  isStateGraph,
} from './to-elk.ts'

/** Lays a graph out, with optional hints; the engine's `layoutGraphSync` bound to its options. */
export type LayoutFn = (
  graph: MermaidGraph,
  hints?: LayoutHints,
) => PositionedGraph

/** Prefix of the ids of the spine nodes, which no real node may share. */
const SPINE_PREFIX = '__zm_spine__'

/** How narrow a spine node starts, in px; it is widened only as far as needed. */
const SPINE_MIN_WIDTH = 8

/** How many times the spine nodes are widened before giving up. */
const MAX_WIDENINGS = 6

/** How many times the gaps between nodes and layers are widened for touching boxes. */
const MAX_SPACING_ATTEMPTS = 3

/** Slack added to the room two boxes ask for, in px. */
const SPACING_SLACK = 4

/** Slack added each time a spine node is widened, in px. */
const WIDEN_SLACK = 4

/** Px a neighbouring node moves per px a spine node is widened, until measured. */
const ASSUMED_SLOPE = 0.25

/** A measured slope below this is noise, and the assumed one is used. */
const MIN_SLOPE = 0.02

/** Space kept between a box and the nodes and boxes around it, in px. */
const BOX_CLEARANCE = 12

/** Left and right room the title text needs inside its box, in px. */
const TITLE_INSET = 12

type Box = { x: number; y: number; width: number; height: number }

const isVertical = (direction: Direction): boolean =>
  direction === 'TD' || direction === 'TB' || direction === 'BT'

const isSpine = (id: string): boolean => id.startsWith(SPINE_PREFIX)

function flatten(subgraphs: MermaidSubgraph[]): MermaidSubgraph[] {
  return subgraphs.flatMap((sg) => [sg, ...flatten(sg.children)])
}

/** Every node id in `sg`, including those of its nested subgraphs. */
function membersOf(sg: MermaidSubgraph): Set<string> {
  const out = new Set<string>(sg.nodeIds)
  for (const child of sg.children) {
    for (const id of membersOf(child)) out.add(id)
  }
  return out
}

// ============================================================================
// Whether to use it
// ============================================================================

/**
 * Whether `graph` can be laid out this way: it has subgraphs, and nothing in it
 * needs the nested layout. A subgraph with its own direction is laid out as its
 * own graph, which this doesn't do; state diagrams have their own handling of
 * composite states; an edge to a subgraph (not a node) has no node to attach
 * to, and the parser gives it a node with the subgraph's id; and a subgraph
 * with no node in it has nothing to draw a box around.
 */
export function canLayOutFlat(graph: MermaidGraph): boolean {
  if (graph.subgraphs.length === 0) return false
  if (isStateGraph(graph) || hasAnyDirectionOverride(graph.subgraphs)) {
    return false
  }
  for (const id of graph.nodes.keys()) if (isSpine(id)) return false
  for (const edge of graph.edges) {
    if (!graph.nodes.has(edge.source) || !graph.nodes.has(edge.target)) {
      return false
    }
  }
  const clusters = flatten(graph.subgraphs)
  // An edge to a subgraph comes out of the parser as an edge to a node that
  // has the subgraph's id; the nested layout points it at the subgraph's box.
  if (clusters.some((sg) => graph.nodes.has(sg.id))) return false
  return clusters.every((sg) =>
    [...membersOf(sg)].some((id) => graph.nodes.has(id)),
  )
}

// ============================================================================
// Layers
// ============================================================================

/**
 * The layer of each node of a laid-out graph, counted from the start of the
 * flow. The nodes of one layer overlap along the flow axis (their centres or
 * their start edges line up, depending on the direction), and the next layer
 * starts after the shortest of them ends.
 */
export function layerIndexes(
  nodes: ReadonlyArray<Box & { id: string }>,
  direction: Direction,
): Map<string, number> {
  const vertical = isVertical(direction)
  const span = (n: Box): [number, number] =>
    vertical ? [n.y, n.y + n.height] : [n.x, n.x + n.width]
  const sorted = [...nodes].sort((a, b) => {
    const [a0, a1] = span(a)
    const [b0, b1] = span(b)
    return (a0 + a1) / 2 - (b0 + b1) / 2
  })
  const layers: Array<{ end: number; ids: string[] }> = []
  for (const node of sorted) {
    const [start, end] = span(node)
    const current = layers[layers.length - 1]
    if (current && start < current.end) {
      current.end = Math.min(current.end, end)
      current.ids.push(node.id)
    } else {
      layers.push({ end, ids: [node.id] })
    }
  }
  if (direction === 'BT' || direction === 'RL') layers.reverse()
  const out = new Map<string, number>()
  layers.forEach((layer, i) => layer.ids.forEach((id) => out.set(id, i)))
  return out
}

// ============================================================================
// Spine nodes
// ============================================================================

export interface SpinePlan {
  /** Spine node id and the subgraph it stands for. */
  ghosts: Array<{ id: string; subgraph: string }>
  /** The invisible edges chaining each subgraph's members and spine nodes by layer. */
  edges: MermaidEdge[]
}

/**
 * The spine nodes and the edges that chain them. For each subgraph, one node
 * per layer between its first and last member where it has no member, and an
 * edge from one representative per layer to the next, where either is a spine
 * node. The representative is the subgraph's leftmost member in that layer, or
 * its spine node. `crossOf` is a
 * node's position across the flow, in the first layout.
 */
export function planSpines(
  clusters: MermaidSubgraph[],
  layer: ReadonlyMap<string, number>,
  crossOf: (id: string) => number,
): SpinePlan {
  const plan: SpinePlan = { ghosts: [], edges: [] }
  for (const sg of clusters) {
    const real = [...membersOf(sg)].filter((id) => layer.has(id))
    if (real.length === 0) continue
    const layers = real.map((id) => layer.get(id)!)
    const first = Math.min(...layers)
    const last = Math.max(...layers)
    const representative = new Map<number, string>()
    for (let l = first; l <= last; l++) {
      const here = real
        .filter((id) => layer.get(id) === l)
        .sort((a, b) => crossOf(a) - crossOf(b))
      if (here.length > 0) {
        representative.set(l, here[0]!)
      } else {
        const id = `${SPINE_PREFIX}${sg.id}__${l}`
        plan.ghosts.push({ id, subgraph: sg.id })
        representative.set(l, id)
      }
    }
    for (let l = first; l < last; l++) {
      const source = representative.get(l)!
      const target = representative.get(l + 1)!
      // Two real members in neighbouring layers need no chain: the layers they
      // are in already keep them together.
      if (!isSpine(source) && !isSpine(target)) continue
      plan.edges.push({
        source,
        target,
        style: 'invisible',
        hasArrowStart: false,
        hasArrowEnd: false,
      })
    }
  }
  return plan
}

// ============================================================================
// Order
// ============================================================================

/**
 * Put sibling subgraphs that sit side by side in the order mermaid.js draws
 * them: the reverse of their declaration order (mermaid.js walks its list of
 * subgraphs backwards, so `subgraph a` then `subgraph b` come out with `b` on
 * the left; see #444 and the same reversal in `mermaidToElk`). ELK chooses the
 * order of two independent subgraphs by their edges, so the first layout may
 * have them the other way round. The subgraphs of a group swap places: each
 * takes the position of whichever came to occupy its slot, by moving the keys of
 * its nodes (`keys`, positions across the flow, is changed in place). Only
 * subgraphs whose layers overlap are side by side; the rest are left alone.
 */
export function orderSiblings(
  subgraphs: readonly MermaidSubgraph[],
  layer: ReadonlyMap<string, number>,
  keys: Map<string, number>,
): void {
  const span = (sg: MermaidSubgraph): [number, number] | undefined => {
    const layers = [...membersOf(sg)]
      .filter((id) => layer.has(id))
      .map((id) => layer.get(id)!)
    return layers.length > 0
      ? [Math.min(...layers), Math.max(...layers)]
      : undefined
  }
  const mean = (sg: MermaidSubgraph): number => {
    const at = [...membersOf(sg)]
      .filter((id) => keys.has(id))
      .map((id) => keys.get(id)!)
    return at.reduce((a, b) => a + b, 0) / at.length
  }
  // Group the siblings whose layers overlap, directly or through one another.
  const spans = subgraphs
    .map((sg) => ({ sg, at: span(sg) }))
    .filter((e): e is { sg: MermaidSubgraph; at: [number, number] } => !!e.at)
    .sort((a, b) => a.at[0] - b.at[0])
  const groups: MermaidSubgraph[][] = []
  let reach = -Infinity
  for (const { sg, at } of spans) {
    const current = groups[groups.length - 1]
    if (current && at[0] <= reach) {
      current.push(sg)
      reach = Math.max(reach, at[1])
    } else {
      groups.push([sg])
      reach = at[1]
    }
  }
  for (const group of groups) {
    if (group.length < 2) continue
    // Declaration order, last to first, is left to right.
    const want = [...group].sort(
      (a, b) => subgraphs.indexOf(b) - subgraphs.indexOf(a),
    )
    const slots = group.map(mean).sort((a, b) => a - b)
    const moves = want.map((sg, i) => slots[i]! - mean(sg))
    want.forEach((sg, i) => {
      for (const id of membersOf(sg)) {
        if (keys.has(id)) keys.set(id, keys.get(id)! + moves[i]!)
      }
    })
  }
  for (const sg of subgraphs) orderSiblings(sg.children, layer, keys)
}

/**
 * The order to give ELK the nodes in, which becomes the left-to-right order
 * within each layer. Starts from where the first layout put each node across
 * the flow, then moves every node that is not in a subgraph but falls within
 * its span of layers to whichever side of the subgraph it was already nearer,
 * so the subgraph's own nodes stay together. `keys` holds each node's position
 * across the flow (spine nodes included); `original` breaks ties.
 */
export function orderNodes(
  original: readonly string[],
  keys: Map<string, number>,
  layer: ReadonlyMap<string, number>,
  clusters: MermaidSubgraph[],
  spineNodes: ReadonlyMap<string, string[]>,
): string[] {
  const key = new Map(keys)
  // Outer subgraphs first, so an inner one's adjustment is applied last.
  for (const sg of clusters) {
    const inside = membersOf(sg)
    for (const id of spineNodes.get(sg.id) ?? []) inside.add(id)
    const members = [...inside].filter((id) => key.has(id))
    const withLayer = members.filter((id) => layer.has(id))
    if (withLayer.length === 0) continue
    const first = Math.min(...withLayer.map((id) => layer.get(id)!))
    const last = Math.max(...withLayer.map((id) => layer.get(id)!))
    const positions = members.map((id) => key.get(id)!)
    const left = Math.min(...positions)
    const right = Math.max(...positions)
    const centre = (left + right) / 2
    let step = 0
    for (const id of original) {
      if (inside.has(id) || isSpine(id)) continue
      const l = layer.get(id)
      if (l === undefined || l < first || l > last) continue
      step++
      const at = key.get(id)!
      // The tiny per-step offset keeps the nodes pushed to one side in their
      // original relative order.
      key.set(
        id,
        at <= centre
          ? Math.min(at, left) - 1 - step * 1e-3
          : Math.max(at, right) + 1 + step * 1e-3,
      )
    }
  }
  const index = new Map(original.map((id, i) => [id, i]))
  return [...original].sort(
    (a, b) => key.get(a)! - key.get(b)! || index.get(a)! - index.get(b)!,
  )
}

// ============================================================================
// Boxes
// ============================================================================

/** Whether `l` is between the first and last of `layers`. */
const withinSpan = (layers: readonly number[], l: number): boolean =>
  l >= Math.min(...layers) && l <= Math.max(...layers)

/** The box of every subgraph, nested, drawn around the real nodes in `nodes`. */
function buildGroups(
  subgraphs: MermaidSubgraph[],
  nodes: ReadonlyMap<string, PositionedNode>,
  fontSizes: FontSizes,
): PositionedGroup[] {
  const build = (sg: MermaidSubgraph): PositionedGroup => {
    const children = sg.children.map(build)
    const boxes: Box[] = [
      ...[...membersOf(sg)].flatMap((id) => {
        const n = nodes.get(id)
        return n ? [n] : []
      }),
      ...children,
    ]
    const x0 = Math.min(...boxes.map((b) => b.x)) - SUBGRAPH_PADDING.left
    const y0 = Math.min(...boxes.map((b) => b.y)) - SUBGRAPH_PADDING.top
    const x1 =
      Math.max(...boxes.map((b) => b.x + b.width)) + SUBGRAPH_PADDING.right
    const y1 =
      Math.max(...boxes.map((b) => b.y + b.height)) + SUBGRAPH_PADDING.bottom
    // The title has to fit inside the box.
    const titleWidth =
      measureMultilineText(
        sg.label,
        fontSizes.groupHeader,
        FONT_WEIGHTS.groupHeader,
      ).width +
      2 * TITLE_INSET
    return {
      id: sg.id,
      label: sg.label,
      x: x0,
      y: y0,
      width: Math.max(x1 - x0, titleWidth),
      height: y1 - y0,
      children,
    }
  }
  return subgraphs.map(build)
}

const flattenGroups = (groups: PositionedGroup[]): PositionedGroup[] =>
  groups.flatMap((g) => [g, ...flattenGroups(g.children)])

/**
 * How far each subgraph's box reaches into a node that isn't a member, across
 * the flow, for the subgraphs that do. A node in a layer where the subgraph has
 * no member is pushed away by the subgraph's spine nodes there; if the subgraph
 * has none, `stuck` is set. Anything else, a node beside a member, a node
 * before or after the subgraph's layers, or two boxes that overlap each other,
 * is a matter of spacing: `room` is how much more space between nodes (across
 * the flow) or between layers (along it) would separate them, taking whichever
 * is less for each pair.
 */
function overlaps(
  groups: PositionedGroup[],
  subgraphs: MermaidSubgraph[],
  nodes: ReadonlyMap<string, PositionedNode>,
  direction: Direction,
  hasSpine: ReadonlySet<string>,
  layer: ReadonlyMap<string, number>,
): {
  penetration: Map<string, number>
  stuck: boolean
  room: { cross: number; along: number }
} {
  const vertical = isVertical(direction)
  const members = new Map(
    flatten(subgraphs).map((sg) => [sg.id, membersOf(sg)]),
  )
  const penetration = new Map<string, number>()
  let stuck = false
  const room = { cross: 0, along: 0 }
  const cross = (b: Box): [number, number] =>
    vertical ? [b.x, b.x + b.width] : [b.y, b.y + b.height]
  const along = (b: Box): [number, number] =>
    vertical ? [b.y, b.y + b.height] : [b.x, b.x + b.width]
  const overlap = (
    [a0, a1]: [number, number],
    [b0, b1]: [number, number],
  ): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
  /** A box with the clearance added on every side. */
  const grown = (b: Box): Box => ({
    x: b.x - BOX_CLEARANCE,
    y: b.y - BOX_CLEARANCE,
    width: b.width + 2 * BOX_CLEARANCE,
    height: b.height + 2 * BOX_CLEARANCE,
  })
  /** How far `a` reaches into `b` across the flow, if they overlap along it. */
  const hit = (a: Box, b: Box): number =>
    overlap(along(a), along(b)) > 0 ? overlap(cross(a), cross(b)) : 0
  const all = flattenGroups(groups)
  const wide = new Map(all.map((g) => [g, grown(g)]))
  /** Ask for the room that separates `a` from `b`, along or across, whichever is less. */
  const needRoom = (a: Box, b: Box): void => {
    const acrossBy = overlap(cross(a), cross(b))
    const alongBy = overlap(along(a), along(b))
    if (acrossBy <= 0 || alongBy <= 0) return
    if (acrossBy <= alongBy) room.cross = Math.max(room.cross, acrossBy)
    else room.along = Math.max(room.along, alongBy)
  }
  for (const group of all) {
    const inside = members.get(group.id)!
    const layers = [...inside]
      .filter((id) => layer.has(id))
      .map((id) => layer.get(id)!)
    const memberLayers = new Set(layers)
    for (const [id, node] of nodes) {
      if (inside.has(id)) continue
      // Beside a member, or before or after the subgraph's layers.
      if (
        memberLayers.has(layer.get(id)!) ||
        !withinSpan(layers, layer.get(id)!)
      ) {
        needRoom(wide.get(group)!, node)
        continue
      }
      const pen = hit(wide.get(group)!, node)
      if (pen <= 0) continue
      if (hasSpine.has(group.id)) {
        penetration.set(group.id, Math.max(penetration.get(group.id) ?? 0, pen))
      } else {
        stuck = true
      }
    }
  }
  // Two boxes that overlap and don't contain one another.
  const contains = (outer: PositionedGroup, inner: PositionedGroup): boolean =>
    flattenGroups(outer.children).includes(inner)
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]!
      const b = all[j]!
      if (contains(a, b) || contains(b, a)) continue
      needRoom(wide.get(a)!, b)
    }
  }
  return { penetration, stuck, room }
}

// ============================================================================
// Layout
// ============================================================================

/**
 * Lay out `graph` with its subgraphs arranged as described at the top of this
 * file. `layout` lays out a graph (with the hints it is given). Returns
 * `undefined` if the boxes can't be made to clear the other nodes.
 */
export function layoutCompoundFlat(
  graph: MermaidGraph,
  layout: LayoutFn,
  fontSizes: FontSizes,
): PositionedGraph | undefined {
  const realOrder = [...graph.nodes.keys()]
  const flat: MermaidGraph = { ...graph, subgraphs: [] }
  const first = layout(flat)
  const layer = layerIndexes(first.nodes, graph.direction)
  const vertical = isVertical(graph.direction)
  const firstNode = new Map(first.nodes.map((n) => [n.id, n]))
  const crossOf = (id: string): number => {
    const n = firstNode.get(id)!
    return vertical ? n.x : n.y
  }

  const clusters = flatten(graph.subgraphs)
  const plan = planSpines(clusters, layer, crossOf)
  const spineNodes = new Map<string, string[]>()
  for (const g of plan.ghosts) {
    spineNodes.set(g.subgraph, [...(spineNodes.get(g.subgraph) ?? []), g.id])
  }

  // Where each node sits across the flow, for the order: the first layout's
  // position, and for a spine node the middle of its subgraph's members.
  const keys = new Map<string, number>(
    first.nodes.map((n) => [n.id, crossOf(n.id)]),
  )
  orderSiblings(graph.subgraphs, layer, keys)
  for (const g of plan.ghosts) {
    const sg = clusters.find((c) => c.id === g.subgraph)!
    const at = [...membersOf(sg)]
      .filter((id) => keys.has(id))
      .map((id) => keys.get(id)!)
    keys.set(g.id, at.reduce((a, b) => a + b, 0) / at.length)
  }

  const nodes = new Map<string, MermaidNode>(graph.nodes)
  for (const g of plan.ghosts) {
    nodes.set(g.id, { id: g.id, label: ' ', shape: 'rectangle' })
  }
  const ordered = orderNodes(
    [...nodes.keys()],
    keys,
    layer,
    clusters,
    spineNodes,
  )
  const augmented: MermaidGraph = {
    ...flat,
    nodes: new Map(ordered.map((id) => [id, nodes.get(id)!])),
    edges: [...graph.edges, ...plan.edges],
  }
  const looseEdges = new Set(plan.edges.map((_, i) => graph.edges.length + i))

  /**
   * Lay out and widen the spine nodes until no box covers a node that isn't a
   * member, with more room between neighbours in a layer and between layers.
   * Returns the room two overlapping boxes still need if that is all that is
   * wrong, and `undefined` if it can't be fixed.
   */
  const settle = (
    extraNodeSpacing: number,
    extraLayerSpacing: number,
    detachedEdges: ReadonlySet<number>,
  ):
    | PositionedGraph
    | { room: { cross: number; along: number } }
    | undefined => {
    // How much wider each subgraph's spine nodes are than their minimum, and
    // how far the box reached into a neighbour at the width before.
    const widen = new Map<string, number>()
    const previous = new Map<string, { width: number; overlap: number }>()
    for (let round = 0; ; round++) {
      const fixedWidths = new Map(
        plan.ghosts.map((g) => [
          g.id,
          SPINE_MIN_WIDTH + (widen.get(g.subgraph) ?? 0),
        ]),
      )
      const laidOut = layout(augmented, {
        extraNodeSpacing,
        extraLayerSpacing,
        fixedWidths,
        looseEdges,
        detachedEdges,
        walkOrder: realOrder,
        forceNodeOrder: true,
      })
      const real = new Map(
        laidOut.nodes.filter((n) => !isSpine(n.id)).map((n) => [n.id, n]),
      )
      const groups = buildGroups(graph.subgraphs, real, fontSizes)
      const { penetration, stuck, room } = overlaps(
        groups,
        graph.subgraphs,
        real,
        graph.direction,
        new Set(spineNodes.keys()),
        layer,
      )
      if (stuck) return undefined
      if (penetration.size === 0) {
        if (room.cross > 0 || room.along > 0) return { room }
        const inner = routeDetached(
          graph,
          detachedEdges,
          real,
          groups,
          clusters,
        )
        return inner && assemble(laidOut, [...real.values()], groups, inner)
      }
      if (round === MAX_WIDENINGS) return undefined
      for (const [id, overlap] of penetration) {
        const width = widen.get(id) ?? 0
        const before = previous.get(id)
        // How far the neighbour moves per px of width: measured from the last
        // two runs, or assumed (a spine node is centred on its column, and the
        // neighbours it pushes also nudge it) until there are two.
        const measured = before
          ? (before.overlap - overlap) / (width - before.width)
          : 0
        const slope = measured > MIN_SLOPE ? measured : ASSUMED_SLOPE
        previous.set(id, { width, overlap })
        widen.set(id, width + overlap / slope + WIDEN_SLACK)
      }
    }
  }

  // Normally the gaps ELK leaves are enough. Boxes side by side, or one above
  // another, need their paddings' worth more: give them what they asked for and
  // try again.
  const solve = (
    detached: ReadonlySet<number>,
  ): PositionedGraph | undefined => {
    let nodeSpacing = 0
    let layerSpacing = 0
    for (let attempt = 0; attempt <= MAX_SPACING_ATTEMPTS; attempt++) {
      const result = settle(nodeSpacing, layerSpacing, detached)
      if (!result) return undefined
      if ('nodes' in result) return result
      nodeSpacing += result.room.cross + SPACING_SLACK
      layerSpacing += result.room.along + SPACING_SLACK
    }
    return undefined
  }

  // Edges inside a box that would have to go round a spine are drawn by hand
  // (see `inner-edges.ts`); if one can't be routed, lay them out as usual.
  const detached = detachableEdges(graph, plan, layer, clusters)
  return (detached.size > 0 ? solve(detached) : undefined) ?? solve(new Set())
}

/**
 * The edges between two members of a subgraph that span a layer where it has
 * only a spine node, and whose ends each keep some other edge to hold them in
 * place without it.
 */
function detachableEdges(
  graph: MermaidGraph,
  plan: SpinePlan,
  layer: ReadonlyMap<string, number>,
  clusters: MermaidSubgraph[],
): Set<number> {
  const spans = clusters.map((sg) => {
    const inside = membersOf(sg)
    const layers = new Set(
      [...inside].filter((id) => layer.has(id)).map((id) => layer.get(id)!),
    )
    return { inside, layers }
  })
  const through = (edge: MermaidEdge): boolean => {
    const from = layer.get(edge.source)
    const to = layer.get(edge.target)
    if (from === undefined || to === undefined || edge.source === edge.target) {
      return false
    }
    return spans.some(
      ({ inside, layers }) =>
        inside.has(edge.source) &&
        inside.has(edge.target) &&
        Array.from(
          { length: Math.max(0, Math.abs(to - from) - 1) },
          (_, i) => Math.min(from, to) + 1 + i,
        ).some((l) => !layers.has(l)),
    )
  }
  const detached = new Set<number>()
  graph.edges.forEach((edge, index) => {
    if (through(edge)) detached.add(index)
  })
  // What holds each node in place: the edges that stay, and the spine's chain.
  const held = new Map<string, number>()
  const hold = (e: { source: string; target: string }): void => {
    if (e.source === e.target) return
    held.set(e.source, (held.get(e.source) ?? 0) + 1)
    held.set(e.target, (held.get(e.target) ?? 0) + 1)
  }
  graph.edges.forEach((e, i) => {
    if (!detached.has(i)) hold(e)
  })
  plan.edges.forEach(hold)
  for (const i of [...detached]) {
    const e = graph.edges[i]!
    if (!held.get(e.source) || !held.get(e.target)) detached.delete(i)
  }
  return detached
}

/**
 * Draw the detached edges inside the innermost box that holds both ends.
 * `undefined` if one has no clear route.
 */
function routeDetached(
  graph: MermaidGraph,
  detached: ReadonlySet<number>,
  nodes: ReadonlyMap<string, PositionedNode>,
  groups: PositionedGroup[],
  clusters: MermaidSubgraph[],
): PositionedEdge[] | undefined {
  const boxes = new Map(flattenGroups(groups).map((g) => [g.id, g]))
  const out: PositionedEdge[] = []
  for (const index of detached) {
    const edge = graph.edges[index]!
    const source = nodes.get(edge.source)
    const target = nodes.get(edge.target)
    const home = clusters
      .filter((sg) => {
        const inside = membersOf(sg)
        return inside.has(edge.source) && inside.has(edge.target)
      })
      .sort((a, b) => membersOf(a).size - membersOf(b).size)[0]
    const box = home && boxes.get(home.id)
    if (!source || !target || !box) return undefined
    const points = routeInnerEdge(
      source,
      target,
      [...nodes.values()].filter((n) => n !== source && n !== target),
      box,
      graph.direction,
    )
    if (!points) return undefined
    out.push({
      source: edge.source,
      target: edge.target,
      label: edge.label,
      style: edge.style,
      hasArrowStart: edge.hasArrowStart,
      hasArrowEnd: edge.hasArrowEnd,
      points,
      labelPosition: edge.label ? labelSpot(points) : undefined,
      inlineStyle: resolveEdgeStyle(index, graph),
      id: edge.id,
      animate: edge.animate,
    })
  }
  return out
}

/** The result of the last layout without the scaffolding, moved and sized to fit what is left. */
function assemble(
  laidOut: PositionedGraph,
  nodes: PositionedNode[],
  groups: PositionedGroup[],
  extraEdges: PositionedEdge[],
): PositionedGraph {
  const edges: PositionedEdge[] = [
    ...laidOut.edges.filter((e) => !isSpine(e.source) && !isSpine(e.target)),
    ...extraEdges,
  ]
  const all = flattenGroups(groups)
  const xs = [
    ...nodes.map((n) => n.x),
    ...all.map((g) => g.x),
    ...edges.flatMap((e) => e.points.map((p) => p.x)),
  ]
  const ys = [
    ...nodes.map((n) => n.y),
    ...all.map((g) => g.y),
    ...edges.flatMap((e) => e.points.map((p) => p.y)),
  ]
  const dx = DEFAULTS.padding - Math.min(...xs)
  const dy = DEFAULTS.padding - Math.min(...ys)
  for (const n of nodes) {
    n.x += dx
    n.y += dy
  }
  for (const g of all) {
    g.x += dx
    g.y += dy
  }
  for (const e of edges) {
    for (const p of e.points) {
      p.x += dx
      p.y += dy
    }
    if (e.labelPosition) {
      e.labelPosition.x += dx
      e.labelPosition.y += dy
    }
  }
  // Same allowances `elkToPositioned` makes around edges and labels.
  let width = 0
  let height = 0
  for (const n of nodes) {
    width = Math.max(width, n.x + n.width + DEFAULTS.padding)
    height = Math.max(height, n.y + n.height + DEFAULTS.padding)
  }
  for (const g of all) {
    width = Math.max(width, g.x + g.width + DEFAULTS.padding)
    height = Math.max(height, g.y + g.height + DEFAULTS.padding)
  }
  for (const e of edges) {
    for (const p of e.points) {
      width = Math.max(width, p.x + ARROW_HEAD.width + DEFAULTS.padding)
      height = Math.max(height, p.y + ARROW_HEAD.width + DEFAULTS.padding)
    }
    if (e.labelPosition) {
      width = Math.max(width, e.labelPosition.x + 60 + DEFAULTS.padding)
      height = Math.max(height, e.labelPosition.y + 20 + DEFAULTS.padding)
    }
  }
  return { ...laidOut, nodes, edges, groups, width, height }
}
