/**
 * `layout: 'simple'` (#1685): lay a flowchart out without ELK.
 *
 * Turns a parsed MermaidGraph into a PositionedGraph using the layered
 * algorithm in ./layered.ts. Subgraphs are laid out inside-out: each is
 * placed as its own layered layout, becomes one opaque box in its parent's,
 * and an edge that crosses boundaries is routed at the level of the lowest
 * common ancestor, then joined to its real endpoints. Self-loops reuse the
 * ELK path's geometry. A subgraph's own `direction` is ignored (it follows its
 * parent), as are `mergeEdges` and `layoutCache`.
 *
 * Everything below works in the abstract (axis, cross) frame of layered.ts and
 * is mapped onto x/y once, at the end (`toRect` / `toPoint`).
 */

import type {
  FlowchartRenderOptions,
  MermaidGraph,
  MermaidSubgraph,
  PositionedEdge,
  PositionedGraph,
  PositionedGroup,
  PositionedNode,
  Point,
} from '@zombie-mermaid/core'
import { measureMultilineText, resolveNodeStyle } from '@zombie-mermaid/core'
import { ARROW_HEAD, FONT_WEIGHTS, resolveFontSizes } from '../styles.ts'
import { clipEdgeToShape } from '../shape-clipping.ts'
import { DEFAULTS } from './constants.ts'
import { straightenTinyJogs } from './jog-straightening.ts'
import { layered, type Waypoint } from './layered.ts'
import { synthesizeSelfLoopEdges, resolveEdgeStyle } from './from-elk.ts'
import { SUBGRAPH_PADDING, estimateNodeSize } from './to-elk.ts'

/** A box in the abstract frame: top-left corner and extents. */
interface Box {
  axis: number
  cross: number
  aSize: number
  cSize: number
}

/** One subgraph (or the root) laid out on its own. */
interface Level {
  /** Member ids, in layout order. */
  members: string[]
  /** Each member's top-left in this level's content frame. */
  at: Map<string, Waypoint>
  /** Each member's extent. */
  sizes: Map<string, { aSize: number; cSize: number }>
  /** Where the content sits inside the box, for a subgraph. */
  inset: Waypoint
  axisSize: number
  crossSize: number
  /** Edges routed at this level: index -> dummy centres and label. */
  routes: Map<number, { mids: Waypoint[]; label?: Waypoint }>
  /** Laid-out child subgraphs by id. */
  inner: Map<string, Level>
}

const LOOP_REACH = 28
const LOOP_STACK = 18
const LOOP_LABEL_GAP = 10
/** Room beside a subgraph's title, so a wide title is not clipped. */
const TITLE_MARGIN = 32

export function layoutSimple(
  graph: MermaidGraph,
  options: FlowchartRenderOptions = {},
): PositionedGraph {
  const opts = {
    ...DEFAULTS,
    ...options,
    fontSizes: resolveFontSizes(options.fontSizes),
  }
  const vertical =
    graph.direction === 'TB' ||
    graph.direction === 'TD' ||
    graph.direction === 'BT'
  const flipped = graph.direction === 'BT' || graph.direction === 'RL'

  // --- hierarchy ---------------------------------------------------------
  const groupOf = new Map<string, MermaidSubgraph>()
  const parentOf = new Map<string, string>()
  const index = (sg: MermaidSubgraph, parent?: string): void => {
    groupOf.set(sg.id, sg)
    if (parent !== undefined) parentOf.set(sg.id, parent)
    for (const id of sg.nodeIds) if (!parentOf.has(id)) parentOf.set(id, sg.id)
    for (const child of sg.children) index(child, sg.id)
  }
  graph.subgraphs.forEach((sg) => index(sg))
  const leafIds = [...graph.nodes.keys()].filter((id) => !groupOf.has(id))
  // A node's first mention orders it; a subgraph sorts with its earliest member.
  const mention = new Map(leafIds.map((id, i) => [id, i]))
  const firstMention = (sg: MermaidSubgraph): number =>
    Math.min(
      ...sg.nodeIds.map((id) => mention.get(id) ?? Infinity),
      ...sg.children.map(firstMention),
    )
  const orderKey = (id: string): number => {
    const sg = groupOf.get(id)
    return sg ? firstMention(sg) : (mention.get(id) ?? Infinity)
  }
  const membersOf = (parent: string | undefined): string[] => {
    const ids = [
      ...leafIds.filter((id) => parentOf.get(id) === parent),
      ...(parent === undefined
        ? graph.subgraphs
        : groupOf.get(parent)!.children
      ).map((sg) => sg.id),
    ]
    return ids
      .map((id, i) => ({ id, i }))
      .sort((a, b) => orderKey(a.id) - orderKey(b.id) || a.i - b.i)
      .map((m) => m.id)
  }
  /** Ancestor ids of `id`, outermost first, ending with `id`. */
  const lineage = (id: string): string[] => {
    const out = [id]
    for (let p = parentOf.get(id); p !== undefined; p = parentOf.get(p)) {
      out.unshift(p)
    }
    return out
  }

  // --- edges, grouped by the level that routes them ----------------------
  const edgeLabel = (i: number): Waypoint | undefined => {
    const text = graph.edges[i]!.label
    if (!text) return undefined
    const m = measureMultilineText(
      text,
      opts.fontSizes.edgeLabel,
      FONT_WEIGHTS.edgeLabel,
    )
    const w = m.width + 8
    const h = m.height + 6
    return vertical ? { axis: h, cross: w } : { axis: w, cross: h }
  }
  const lifted = new Map<
    string,
    { index: number; from: string; to: string }[]
  >()
  const loops = new Map<string, number[]>()
  graph.edges.forEach((edge, i) => {
    if (edge.source === edge.target) {
      loops.set(edge.source, [...(loops.get(edge.source) ?? []), i])
      return
    }
    const a = lineage(edge.source)
    const b = lineage(edge.target)
    let depth = 0
    while (a[depth] !== undefined && a[depth] === b[depth]) depth++
    // One end sits inside the other: nothing to route at any level.
    if (depth >= a.length || depth >= b.length) return
    const key = depth === 0 ? '' : a[depth - 1]!
    lifted.set(key, [
      ...(lifted.get(key) ?? []),
      { index: i, from: a[depth]!, to: b[depth]! },
    ])
  })

  // --- subgraph padding in the abstract frame ----------------------------
  const pad = vertical
    ? flipped
      ? {
          axisStart: SUBGRAPH_PADDING.bottom,
          axisEnd: SUBGRAPH_PADDING.top,
          crossStart: SUBGRAPH_PADDING.left,
          crossEnd: SUBGRAPH_PADDING.right,
        }
      : {
          axisStart: SUBGRAPH_PADDING.top,
          axisEnd: SUBGRAPH_PADDING.bottom,
          crossStart: SUBGRAPH_PADDING.left,
          crossEnd: SUBGRAPH_PADDING.right,
        }
    : {
        axisStart: flipped ? SUBGRAPH_PADDING.right : SUBGRAPH_PADDING.left,
        axisEnd: flipped ? SUBGRAPH_PADDING.left : SUBGRAPH_PADDING.right,
        crossStart: SUBGRAPH_PADDING.top,
        crossEnd: SUBGRAPH_PADDING.bottom,
      }
  // abstract (axis, cross) extents of a real (width, height)
  const abstractSize = (w: number, h: number) =>
    vertical ? { aSize: h, cSize: w } : { aSize: w, cSize: h }

  // --- layout, inside-out -------------------------------------------------
  const nodeSize = new Map<string, { aSize: number; cSize: number }>()
  for (const id of leafIds) {
    const node = graph.nodes.get(id)!
    const s = estimateNodeSize(
      id,
      node.label,
      node.shape,
      opts.fontSizes.nodeLabel,
    )
    nodeSize.set(id, abstractSize(s.width, s.height))
  }
  /** Room a node's self-loops need on the high side of the cross axis. */
  const loopRoom = (id: string): number => {
    const own = loops.get(id)
    if (!vertical || !own) return 0
    const widest = Math.max(
      0,
      ...own.map(
        (i) => (edgeLabel(i)?.cross ?? -LOOP_LABEL_GAP) + LOOP_LABEL_GAP,
      ),
    )
    return LOOP_REACH + (own.length - 1) * LOOP_STACK + widest
  }

  const build = (parent: string | undefined): Level => {
    const members = membersOf(parent)
    const inner = new Map<string, Level>()
    const sizes = new Map<string, { aSize: number; cSize: number }>()
    const insets = new Map<string, Waypoint>()
    for (const id of members) {
      const sg = groupOf.get(id)
      if (!sg) {
        sizes.set(id, nodeSize.get(id)!)
        continue
      }
      const level = build(id)
      inner.set(id, level)
      const title = measureMultilineText(
        sg.label,
        opts.fontSizes.groupHeader,
        FONT_WEIGHTS.groupHeader,
      ).width
      let aSize = level.axisSize + pad.axisStart + pad.axisEnd
      let cSize = level.crossSize + pad.crossStart + pad.crossEnd
      // Widen to fit the title, centring the contents in the extra room.
      const wantA = vertical ? 0 : title + TITLE_MARGIN
      const wantC = vertical ? title + TITLE_MARGIN : 0
      const extraA = Math.max(0, wantA - aSize)
      const extraC = Math.max(0, wantC - cSize)
      aSize += extraA
      cSize += extraC
      sizes.set(id, { aSize, cSize })
      insets.set(id, {
        axis: pad.axisStart + extraA / 2,
        cross: pad.crossStart + extraC / 2,
      })
    }
    const position = new Map(members.map((id, i) => [id, i]))
    const own = lifted.get(parent ?? '') ?? []
    const result = layered(
      members.map((id) => ({
        axis: sizes.get(id)!.aSize,
        cross: sizes.get(id)!.cSize,
        after: loopRoom(id),
      })),
      own.map((e) => ({
        from: position.get(e.from)!,
        to: position.get(e.to)!,
        label: edgeLabel(e.index),
      })),
      { nodeSep: opts.nodeSpacing, rankSep: opts.layerSpacing },
    )
    const routes = new Map<number, { mids: Waypoint[]; label?: Waypoint }>()
    own.forEach((e, k) =>
      routes.set(e.index, {
        mids: result.paths[k]!,
        label: result.labels[k],
      }),
    )
    return {
      members,
      at: new Map(members.map((id, i) => [id, result.nodes[i]!])),
      sizes,
      inset: { axis: 0, cross: 0 },
      axisSize: result.axisSize,
      crossSize: result.crossSize,
      routes,
      inner: new Map(
        [...inner].map(([id, level]) => [
          id,
          { ...level, inset: insets.get(id)! },
        ]),
      ),
    }
  }
  const root = build(undefined)

  // --- absolute positions --------------------------------------------------
  const boxes = new Map<string, Box>()
  const offsetRoutes = new Map<number, { mids: Waypoint[]; label?: Waypoint }>()
  const place = (
    level: Level,
    axis0: number,
    cross0: number,
  ): PositionedGroup[] => {
    for (const [i, r] of level.routes) {
      offsetRoutes.set(i, {
        mids: r.mids.map((p) => ({
          axis: p.axis + axis0,
          cross: p.cross + cross0,
        })),
        label: r.label && {
          axis: r.label.axis + axis0,
          cross: r.label.cross + cross0,
        },
      })
    }
    const groups: PositionedGroup[] = []
    for (const id of level.members) {
      const at = level.at.get(id)!
      const size = level.sizes.get(id)!
      const box: Box = {
        axis: axis0 + at.axis,
        cross: cross0 + at.cross,
        ...size,
      }
      boxes.set(id, box)
      const child = level.inner.get(id)
      if (child) {
        const sg = groupOf.get(id)!
        const children = place(
          child,
          box.axis + child.inset.axis,
          box.cross + child.inset.cross,
        )
        groups.push({
          id,
          label: sg.label,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          children,
          ...(sg.region ? { region: true } : {}),
        })
      }
    }
    return groups
  }
  const groups = place(root, 0, 0)

  // --- abstract -> real ----------------------------------------------------
  const margin = opts.padding
  const total = root.axisSize
  const toPoint = (p: Waypoint): Point => {
    const along = flipped ? total - p.axis : p.axis
    return vertical
      ? { x: p.cross + margin, y: along + margin }
      : { x: along + margin, y: p.cross + margin }
  }
  const toRect = (b: Box) => {
    const along = flipped ? total - b.axis - b.aSize : b.axis
    return vertical
      ? {
          x: b.cross + margin,
          y: along + margin,
          width: b.cSize,
          height: b.aSize,
        }
      : {
          x: along + margin,
          y: b.cross + margin,
          width: b.aSize,
          height: b.cSize,
        }
  }
  const fillGroups = (list: PositionedGroup[]): void => {
    for (const g of list) {
      Object.assign(g, toRect(boxes.get(g.id)!))
      fillGroups(g.children)
    }
  }
  fillGroups(groups)

  const nodes: PositionedNode[] = leafIds.map((id) => {
    const node = graph.nodes.get(id)!
    return {
      id,
      label: node.label,
      shape: node.shape,
      ...toRect(boxes.get(id)!),
      inlineStyle: resolveNodeStyle(id, graph),
      className: graph.classAssignments.get(id),
      interaction: graph.interactions.get(id),
    }
  })
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // --- edges ----------------------------------------------------------------
  const edges: PositionedEdge[] = []
  graph.edges.forEach((edge, i) => {
    const route = offsetRoutes.get(i)
    if (!route) return
    const src = boxes.get(edge.source)!
    const dst = boxes.get(edge.target)!
    // A feedback edge was reversed for ranking: route it low rank to high
    // rank, then flip the points back so they still run source to target.
    const feedback = src.axis > dst.axis
    const [lo, hi] = feedback ? [dst, src] : [src, dst]
    const stops: Waypoint[] = [
      { axis: lo.axis + lo.aSize, cross: lo.cross + lo.cSize / 2 },
      ...(feedback ? [...route.mids].reverse() : route.mids),
      { axis: hi.axis, cross: hi.cross + hi.cSize / 2 },
    ]
    const path: Waypoint[] = [stops[0]!]
    for (const next of stops.slice(1)) {
      const prev = path[path.length - 1]!
      if (prev.cross !== next.cross) {
        const mid = (prev.axis + next.axis) / 2
        path.push(
          { axis: mid, cross: prev.cross },
          { axis: mid, cross: next.cross },
        )
      }
      path.push(next)
    }
    let points = straightenTinyJogs(dropCollinear(path.map(toPoint)))
    if (feedback) points.reverse()
    const from = nodeMap.get(edge.source)
    const to = nodeMap.get(edge.target)
    if (from) points = clipEdgeToShape(points, from, true)
    if (to) points = clipEdgeToShape(points, to, false)
    edges.push({
      source: edge.source,
      target: edge.target,
      label: edge.label,
      style: edge.style,
      hasArrowStart: edge.hasArrowStart,
      hasArrowEnd: edge.hasArrowEnd,
      points,
      labelPosition: route.label && toPoint(route.label),
      inlineStyle: resolveEdgeStyle(i, graph),
      id: edge.id,
      animate: edge.animate,
    })
  })
  synthesizeSelfLoopEdges(graph, nodeMap, edges)

  // --- bounds ----------------------------------------------------------------
  let width = (vertical ? root.crossSize : root.axisSize) + margin * 2
  let height = (vertical ? root.axisSize : root.crossSize) + margin * 2
  for (const edge of edges) {
    for (const p of edge.points) {
      width = Math.max(width, p.x + ARROW_HEAD.width + margin)
      height = Math.max(height, p.y + ARROW_HEAD.width + margin)
    }
    if (edge.labelPosition) {
      width = Math.max(width, edge.labelPosition.x + 60 + margin)
      height = Math.max(height, edge.labelPosition.y + 20 + margin)
    }
  }
  return { width, height, nodes, edges, groups }
}

/** Drop a point that sits on a straight run between its neighbours. */
function dropCollinear(points: Point[]): Point[] {
  return points.filter((p, i) => {
    const a = points[i - 1]
    const b = points[i + 1]
    if (!a || !b) return true
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y))
  })
}
