/**
 * C4 diagram layout engine (ELK.js).
 *
 * Elements are leaf nodes sized from their text (name, `[type]` line,
 * wrapped description, plus room for the person glyph / cylinder cap).
 * Boundaries and deployment nodes are ELK compound nodes, so nesting,
 * padding for the boundary title, and edges that cross boundary walls (or
 * end on a boundary itself) are all handled by one hierarchical layered run.
 *
 * `Rel_U/D/L/R` hints steer the run as far as a layered layout allows:
 *
 *  - A hint along the flow axis (`Rel_D`/`Rel_U` in a top-down diagram,
 *    `Rel_R`/`Rel_L` in a left-to-right one) is a layering constraint: the
 *    ELK edge is oriented so the hinted "before" element lands in an earlier
 *    layer, whatever the arrow direction is.
 *  - A hint across the flow axis (`Rel_R`/`Rel_L` in a top-down diagram)
 *    can't be a layering constraint, since layered layout puts an edge's
 *    ends in different layers. That edge is kept out of the ELK run so it
 *    does not force a layer split; the "before" element is instead ordered
 *    ahead of the "after" one among its siblings, and the edge is routed
 *    afterwards (straight when the two sit side by side, a Z-path
 *    otherwise). ELK does not promise the two land in the same layer, so
 *    this is a strong nudge, not a guarantee.
 */

import type { ElkNode, ElkExtendedEdge, LayoutOptions } from 'elkjs'
import type {
  C4Boundary,
  C4Diagram,
  C4Element,
  C4Relationship,
  PositionedC4Boundary,
  PositionedC4Diagram,
  PositionedC4Element,
  PositionedC4Relationship,
} from '@zombie-mermaid/mermaid-parser'
import {
  c4Placement,
  c4RelLabelLines,
  c4TypeLine,
} from '@zombie-mermaid/mermaid-parser'
import type { Point, RenderOptions } from '@zombie-mermaid/core'
import type { FontSizes } from '../styles.ts'
import { estimateTextWidth, FONT_WEIGHTS, resolveFontSizes } from '../styles.ts'
import { elkLayoutSync } from '../elk-instance.ts'
import {
  extractEdgeLabelPosition,
  extractEdgePoints,
} from '../layout-engine/elk-adapter-utils.ts'
import {
  ELK_DIRECTION_FALLBACK,
  INLINE_CENTERED_EDGE_LABEL,
  baseElkLayoutOptions,
  buildElkEdge,
  buildElkLeafNode,
  directionToElk,
  elkPadding,
} from '../layout-engine/elk-graph-builder.ts'
import type { ElkDirection } from '../layout-engine/elk-graph-builder.ts'
import { C4, c4TextSizes } from './metrics.ts'

interface Size {
  width: number
  height: number
}

interface Rect extends Size {
  x: number
  y: number
}

/** Greedy word wrap by rendered width; an over-wide word keeps its own line. */
function wrapByWidth(
  text: string,
  fontSize: number,
  weight: number,
  maxWidth: number,
): string[] {
  const out: string[] = []
  for (const paragraph of text.split('\n')) {
    let cur = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word
      if (cur && estimateTextWidth(next, fontSize, weight) > maxWidth) {
        out.push(cur)
        cur = word
      } else {
        cur = next
      }
    }
    out.push(cur)
  }
  return out
}

interface MeasuredElement {
  size: Size
  nameLines: string[]
  descriptionLines: string[]
}

function measureElement(el: C4Element, fontSizes: FontSizes): MeasuredElement {
  const t = c4TextSizes(fontSizes)
  const nameLines = wrapByWidth(el.label, t.name, 700, C4.maxTextWidth)
  const descriptionLines = el.description
    ? wrapByWidth(el.description, t.desc, 400, C4.maxTextWidth)
    : []
  let textW = estimateTextWidth(c4TypeLine(el), t.type, 400)
  for (const l of nameLines) {
    textW = Math.max(textW, estimateTextWidth(l, t.name, 700))
  }
  for (const l of descriptionLines) {
    textW = Math.max(textW, estimateTextWidth(l, t.desc, 400))
  }

  let width = Math.max(C4.minWidth, textW + C4.padX * 2)
  let height =
    C4.padY * 2 +
    nameLines.length * t.nameLine +
    t.typeLine +
    (descriptionLines.length > 0
      ? C4.descGap + descriptionLines.length * t.descLine
      : 0)
  if (el.kind === 'person') height += C4.personGlyphHeight
  if (el.shape === 'db') height += C4.dbCap * 2
  if (el.shape === 'queue') width += C4.queueCap * 2
  return {
    size: { width: Math.ceil(width), height: Math.ceil(height) },
    nameLines,
    descriptionLines,
  }
}

function boundaryMinSize(b: C4Boundary, fontSizes: FontSizes): Size {
  const labelW = estimateTextWidth(
    b.label,
    fontSizes.groupHeader,
    FONT_WEIGHTS.groupHeader,
  )
  const typeW = b.type
    ? estimateTextWidth(`[${b.type}]`, fontSizes.edgeLabel, 400)
    : 0
  return {
    width: Math.ceil(
      Math.max(C4.boundaryMinWidth, Math.max(labelW, typeW) + C4.padX * 2),
    ),
    height: C4.boundaryPadTop + C4.boundaryPadBottom + 40,
  }
}

/** `before` should sit ahead of `after` among their siblings. */
interface OrderHint {
  before: string
  after: string
}

interface EdgePlan {
  rel: C4Relationship
  /** The ELK edge id, or undefined for an edge routed after the ELK run. */
  elkId?: string
  /** ELK routes source->target opposite to the relationship's own direction. */
  reversed: boolean
}

/**
 * Stable reorder so every `before` sibling precedes its `after` sibling.
 * Pairs whose ends aren't siblings are skipped, and cyclic pairs settle
 * after a bounded number of passes rather than looping.
 */
function applyOrderHints(children: ElkNode[], hints: OrderHint[]): void {
  for (let pass = 0; pass < children.length; pass++) {
    let moved = false
    for (const { before, after } of hints) {
      const order = children.map((c) => c.id)
      const bi = order.indexOf(before)
      const ai = order.indexOf(after)
      if (bi < 0 || ai < 0 || bi < ai) continue
      const [node] = children.splice(bi, 1)
      children.splice(ai, 0, node!)
      moved = true
    }
    if (!moved) return
  }
}

function polylineMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(
      points[i]!.x - points[i - 1]!.x,
      points[i]!.y - points[i - 1]!.y,
    )
  }
  let walked = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const seg = Math.hypot(b.x - a.x, b.y - a.y)
    if (seg > 0 && walked + seg >= total / 2) {
      const t = (total / 2 - walked) / seg
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    walked += seg
  }
  return points[points.length - 1]!
}

/**
 * Route an edge the ELK run didn't see: straight when the two boxes face
 * each other with overlapping extents, otherwise a Z-shaped path between the
 * facing sides.
 */
export function routeManualEdge(a: Rect, b: Rect): Point[] {
  const overlap = (a0: number, a1: number, b0: number, b1: number) => {
    const lo = Math.max(a0, b0)
    const hi = Math.min(a1, b1)
    return hi > lo ? (lo + hi) / 2 : undefined
  }
  const midY = overlap(a.y, a.y + a.height, b.y, b.y + b.height)
  const midX = overlap(a.x, a.x + a.width, b.x, b.x + b.width)
  const aRight = a.x + a.width
  const bRight = b.x + b.width
  const aBottom = a.y + a.height
  const bBottom = b.y + b.height

  if (midY !== undefined && aRight <= b.x) {
    return [
      { x: aRight, y: midY },
      { x: b.x, y: midY },
    ]
  }
  if (midY !== undefined && bRight <= a.x) {
    return [
      { x: a.x, y: midY },
      { x: bRight, y: midY },
    ]
  }
  if (midX !== undefined && aBottom <= b.y) {
    return [
      { x: midX, y: aBottom },
      { x: midX, y: b.y },
    ]
  }
  if (midX !== undefined && bBottom <= a.y) {
    return [
      { x: midX, y: a.y },
      { x: midX, y: bBottom },
    ]
  }
  const acx = a.x + a.width / 2
  const acy = a.y + a.height / 2
  const bcx = b.x + b.width / 2
  const bcy = b.y + b.height / 2
  if (Math.abs(bcx - acx) >= Math.abs(bcy - acy)) {
    const ax = bcx > acx ? aRight : a.x
    const bx = bcx > acx ? b.x : bRight
    const mx = (ax + bx) / 2
    return [
      { x: ax, y: acy },
      { x: mx, y: acy },
      { x: mx, y: bcy },
      { x: bx, y: bcy },
    ]
  }
  const ay = bcy > acy ? aBottom : a.y
  const by = bcy > acy ? b.y : bBottom
  const my = (ay + by) / 2
  return [
    { x: acx, y: ay },
    { x: acx, y: my },
    { x: bcx, y: my },
    { x: bcx, y: by },
  ]
}

interface Built {
  root: ElkNode
  plans: EdgePlan[]
  sizes: Map<string, Size>
  measured: Map<string, MeasuredElement>
}

function buildGraph(
  diagram: C4Diagram,
  fontSizes: FontSizes,
  direction: ElkDirection,
): Built {
  const measured = new Map<string, MeasuredElement>()
  const sizes = new Map<string, Size>()
  const elementNode = new Map<string, ElkNode>()
  for (const el of diagram.elements) {
    const m = measureElement(el, fontSizes)
    measured.set(el.alias, m)
    sizes.set(el.alias, m.size)
    elementNode.set(el.alias, buildElkLeafNode(el.alias, m.size))
  }

  const inBoundary = new Set<string>()
  const buildBoundary = (b: C4Boundary): ElkNode => {
    const min = boundaryMinSize(b, fontSizes)
    const children: ElkNode[] = []
    for (const alias of b.elementAliases) {
      inBoundary.add(alias)
      children.push(elementNode.get(alias)!)
    }
    for (const child of b.children) children.push(buildBoundary(child))
    if (children.length === 0) {
      // An empty boundary has nothing to wrap; draw it as a sized box.
      sizes.set(b.alias, min)
      return buildElkLeafNode(b.alias, min)
    }
    return {
      id: b.alias,
      children,
      layoutOptions: {
        'elk.padding': elkPadding({
          top: C4.boundaryPadTop,
          left: C4.boundaryPadX,
          bottom: C4.boundaryPadBottom,
          right: C4.boundaryPadX,
        }),
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${min.width},${min.height})`,
      },
    }
  }
  const boundaryNodes = diagram.boundaries.map(buildBoundary)
  const rootChildren: ElkNode[] = [
    ...diagram.elements
      .filter((e) => !inBoundary.has(e.alias))
      .map((e) => elementNode.get(e.alias)!),
    ...boundaryNodes,
  ]

  // -- Relationships -------------------------------------------------------
  const flowVertical = direction === 'DOWN' || direction === 'UP'
  const flowForward = direction === 'DOWN' || direction === 'RIGHT'
  const labelStyle = {
    fontSize: fontSizes.edgeLabel,
    layoutOptions: INLINE_CENTERED_EDGE_LABEL,
  }
  const plans: EdgePlan[] = []
  const elkEdges: ElkExtendedEdge[] = []
  const orderHints: OrderHint[] = []
  let hintGap: number = C4.nodeSpacing
  for (const [i, rel] of diagram.relationships.entries()) {
    const placement = c4Placement(rel)
    const hinted = placement.explicit && rel.from !== rel.to
    const along = placement.axis === (flowVertical ? 'vertical' : 'horizontal')
    if (hinted && !along) {
      orderHints.push({ before: placement.source, after: placement.target })
      // The edge is drawn in the gap between the two, so the gap between
      // siblings must fit its label (widest line, plus the pill and arrow).
      for (const l of c4RelLabelLines(rel)) {
        hintGap = Math.max(
          hintGap,
          estimateTextWidth(l, fontSizes.edgeLabel, FONT_WEIGHTS.edgeLabel) +
            40,
        )
      }
      plans.push({ rel, reversed: false })
      continue
    }
    let source = rel.from
    let target = rel.to
    if (hinted) {
      // Along the flow axis: `placement.source` must come first in the flow.
      source = flowForward ? placement.source : placement.target
      target = flowForward ? placement.target : placement.source
    }
    const id = `e${i}`
    const lines = c4RelLabelLines(rel)
    elkEdges.push(
      buildElkEdge({
        id,
        source,
        target,
        label: lines.length > 0 ? lines.join('\n') : undefined,
        labelStyle,
      }),
    )
    plans.push({ rel, elkId: id, reversed: source !== rel.from })
  }

  // Layer alignment for across-axis hints: give each end an invisible copy of
  // every edge that feeds the other, so layering puts both under the same
  // predecessors, i.e. in the same layer. The copies are dropped on read-back.
  const copyIncoming = (from: string, to: string) => {
    const existing = new Set(
      elkEdges.filter((e) => e.targets[0] === to).map((e) => e.sources[0]),
    )
    for (const e of elkEdges.filter(
      (x) => x.targets[0] === from && !x.id.startsWith('h'),
    )) {
      const source = e.sources[0]!
      if (source === to || existing.has(source)) continue
      const copy: ElkExtendedEdge = {
        id: `h${elkEdges.length}`,
        sources: [source],
        targets: [to],
      }
      // Inline labels occupy a layer of their own, so the copy carries one
      // of the same size to keep both ends the same distance down.
      if (e.labels) copy.labels = e.labels.map((l) => structuredClone(l))
      elkEdges.push(copy)
    }
  }
  for (const { before, after } of orderHints) {
    copyIncoming(before, after)
    copyIncoming(after, before)
  }

  if (orderHints.length > 0) {
    // Ordering only applies among siblings, so run it per container.
    const containers: ElkNode[][] = [rootChildren]
    const collect = (nodes: ElkNode[]) => {
      for (const n of nodes) {
        if (n.children) {
          containers.push(n.children)
          collect(n.children)
        }
      }
    }
    collect(rootChildren)
    for (const c of containers) applyOrderHints(c, orderHints)
  }

  const layoutOptions: LayoutOptions = {
    ...baseElkLayoutOptions({
      direction,
      nodeSpacing: hintGap,
      layerSpacing: C4.layerSpacing,
      padding: C4.padding,
    }),
    'elk.spacing.edgeEdge': '12',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
    'elk.layered.spacing.edgeNodeBetweenLayers': '12',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  }
  if (orderHints.length > 0) {
    layoutOptions['elk.layered.crossingMinimization.forceNodeModelOrder'] =
      'true'
  }
  return {
    root: {
      id: '__c4_root',
      layoutOptions,
      children: rootChildren,
      edges: elkEdges,
    },
    plans,
    sizes,
    measured,
  }
}

/**
 * Walk the ELK result once, recording every node's absolute rect and every
 * edge with the coordinate offset its points are relative to. Under
 * `INCLUDE_CHILDREN` ELK may report an edge in the coordinate space of the
 * container named by its (untyped-in-elkjs) `container` property rather than
 * the array it was left in, so that wins when present.
 */
function walkResult(root: ElkNode): {
  nodes: Map<string, Rect>
  edges: Map<string, { edge: ElkExtendedEdge; offset: Point }>
} {
  const nodes = new Map<string, Rect>()
  const containerOffset = new Map<string, Point>()
  const pending: { edge: ElkExtendedEdge; owner: Point }[] = []

  const visit = (node: ElkNode, ox: number, oy: number, isRoot: boolean) => {
    // A child's own x/y are relative to its parent; ELK always assigns them.
    const ax = isRoot ? 0 : ox + (node.x ?? 0)
    const ay = isRoot ? 0 : oy + (node.y ?? 0)
    containerOffset.set(node.id, { x: ax, y: ay })
    if (!isRoot) {
      nodes.set(node.id, {
        x: ax,
        y: ay,
        width: node.width ?? 0,
        height: node.height ?? 0,
      })
    }
    for (const e of node.edges ?? []) {
      pending.push({ edge: e, owner: { x: ax, y: ay } })
    }
    for (const c of node.children ?? []) visit(c, ax, ay, false)
  }
  visit(root, 0, 0, true)

  const edges = new Map<string, { edge: ElkExtendedEdge; offset: Point }>()
  for (const { edge, owner } of pending) {
    const containerId = (edge as { container?: string }).container
    const declared =
      containerId !== undefined ? containerOffset.get(containerId) : undefined
    edges.set(edge.id, { edge, offset: declared ?? owner })
  }
  return { nodes, edges }
}

/**
 * Lay out a parsed C4 diagram using ELK.js (synchronous).
 */
export function layoutC4DiagramSync(
  diagram: C4Diagram,
  options: RenderOptions = {},
): PositionedC4Diagram {
  const direction = directionToElk(diagram.direction, ELK_DIRECTION_FALLBACK.c4)
  const fontSizes = resolveFontSizes(options.fontSizes)
  const titleShift = diagram.title ? C4.titleHeight : 0

  if (diagram.elements.length === 0 && diagram.boundaries.length === 0) {
    const empty: PositionedC4Diagram = {
      variant: diagram.variant,
      width: 0,
      height: 0,
      elements: [],
      boundaries: [],
      relationships: [],
    }
    if (diagram.title) empty.title = diagram.title
    return empty
  }

  const { root, plans, sizes, measured } = buildGraph(
    diagram,
    fontSizes,
    direction,
  )
  const result = elkLayoutSync(root, options.layoutCache)
  const { nodes, edges } = walkResult(result)

  const rectOf = (alias: string): Rect => {
    const rect = nodes.get(alias)
    if (!rect) {
      // Unreachable: every element and boundary alias is an ELK node.
      /* v8 ignore next */
      throw new Error(`C4 layout: missing node "${alias}"`)
    }
    return rect
  }

  const elements: PositionedC4Element[] = diagram.elements.map((el) => {
    const r = rectOf(el.alias)
    const m = measured.get(el.alias)!
    return {
      ...el,
      x: r.x,
      y: r.y + titleShift,
      width: r.width || m.size.width,
      height: r.height || m.size.height,
      nameLines: m.nameLines,
      descriptionLines: m.descriptionLines,
    }
  })

  const boundaries: PositionedC4Boundary[] = []
  const flatten = (b: C4Boundary, depth: number) => {
    const r = rectOf(b.alias)
    const fallback = sizes.get(b.alias)
    const pb: PositionedC4Boundary = {
      alias: b.alias,
      label: b.label,
      x: r.x,
      y: r.y + titleShift,
      width: r.width || fallback?.width || 0,
      height: r.height || fallback?.height || 0,
      depth,
    }
    if (b.type) pb.type = b.type
    if (b.description) pb.description = b.description
    boundaries.push(pb)
    for (const c of b.children) flatten(c, depth + 1)
  }
  for (const b of diagram.boundaries) flatten(b, 0)

  const relationships: PositionedC4Relationship[] = plans.map((plan) => {
    let points: Point[]
    let labelPosition: Point | undefined
    const lines = c4RelLabelLines(plan.rel)
    if (plan.elkId !== undefined) {
      const found = edges.get(plan.elkId)
      points = found
        ? extractEdgePoints(found.edge, found.offset.x, found.offset.y)
        : []
      if (lines.length > 0 && found) {
        labelPosition = extractEdgeLabelPosition(
          found.edge,
          found.offset.x,
          found.offset.y,
        )
      }
      if (plan.reversed) points.reverse()
    } else {
      points = routeManualEdge(rectOf(plan.rel.from), rectOf(plan.rel.to))
    }
    if (lines.length > 0 && !labelPosition && points.length >= 2) {
      labelPosition = polylineMidpoint(points)
    }
    const out: PositionedC4Relationship = {
      ...plan.rel,
      points: points.map((p) => ({ x: p.x, y: p.y + titleShift })),
    }
    if (labelPosition) {
      out.labelPosition = {
        x: labelPosition.x,
        y: labelPosition.y + titleShift,
      }
    }
    return out
  })

  // Label boxes of edges ELK never saw can poke past its bounds.
  let width = result.width ?? 0
  const height = (result.height ?? 0) + titleShift
  for (const rel of relationships) {
    if (!rel.labelPosition) continue
    const w =
      Math.max(
        ...c4RelLabelLines(rel).map((l) =>
          estimateTextWidth(l, fontSizes.edgeLabel, FONT_WEIGHTS.edgeLabel),
        ),
      ) + 8
    width = Math.max(width, rel.labelPosition.x + w / 2 + C4.padding / 2)
  }

  const out: PositionedC4Diagram = {
    variant: diagram.variant,
    width: Math.ceil(width),
    height: Math.ceil(height),
    elements,
    boundaries,
    relationships,
  }
  if (diagram.title) {
    out.title = diagram.title
    out.titlePosition = { x: out.width / 2, y: titleShift / 2 + 6 }
  }
  return out
}
