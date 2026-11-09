// ============================================================================
// Sankey layout
//
// Turns a parsed Sankey into absolute SVG geometry the way Mermaid does: its
// sankeyRenderer.ts feeds the graph to d3-sankey and draws the result. The
// layout below is a TypeScript port of d3-sankey 0.12.3 (the `sankey()`
// generator, `justify`/`left`/`right`/`center` alignments and
// `sankeyLinkHorizontal`'s endpoints), keeping its arithmetic order so the
// numbers match Mermaid's.
//
// d3-sankey: Copyright 2015, Mike Bostock. All rights reserved. BSD-3-Clause
// (https://github.com/d3/d3-sankey/blob/v0.12.3/LICENSE).
//
// Mermaid defaults (config `sankey`): 600 x 400, nodeWidth 10, nodePadding 12
// (+15 with `showValues`, which is on), alignment `justify`, labels 14px,
// 6px beside the bar. The viewBox is the bounding box of everything drawn
// (`setupGraphViewbox`), which is why long labels widen it. Text is measured
// by summing Trebuchet MS advances (the one input Mermaid takes from a
// browser) plus a 12% allowance for the font labels are really drawn in.
// ============================================================================

import type {
  PositionedSankey,
  PositionedSankeyLink,
  PositionedSankeyNode,
  Sankey,
} from '@zombie-mermaid/mermaid-parser'
import { MermaidParseError } from '@zombie-mermaid/core'
import { textWidth } from '../timeline/layout.ts'

export const SANKEY = {
  width: 600,
  height: 400,
  nodeWidth: 10,
  nodePadding: 12,
  /** Added to the padding while node values are shown. */
  valuePadding: 15,
  fontSize: 14,
  labelGap: 6,
  /** Ascent and descent of one 14px line as Mermaid's `getBBox` reports it. */
  ascent: 13,
  descent: 3,
  iterations: 6,
  /**
   * Labels are drawn in Inter, about 10% wider than the Trebuchet advances
   * the box is sized from; widening the overhang keeps edge labels from
   * being cut off. Only a label that reaches past the bars changes the size.
   */
  labelFit: 1.12,
} as const

interface N {
  id: string
  index: number
  sourceLinks: L[]
  targetLinks: L[]
  value: number
  depth: number
  height: number
  layer: number
  x0: number
  x1: number
  y0: number
  y1: number
}
interface L {
  index: number
  source: N
  target: N
  value: number
  width: number
  y0: number
  y1: number
}

const sum = (xs: readonly L[]): number => xs.reduce((a, l) => a + l.value, 0)

function align(
  how: 'left' | 'right' | 'center' | 'justify',
  node: N,
  n: number,
): number {
  if (how === 'left') return node.depth
  if (how === 'right') return n - 1 - node.height
  if (how === 'justify') return node.sourceLinks.length ? node.depth : n - 1
  return node.targetLinks.length
    ? node.depth
    : node.sourceLinks.length
      ? Math.min(...node.sourceLinks.map((l) => l.target.depth)) - 1
      : 0
}

/** The d3-sankey generator, for the extent, widths and alignment Mermaid passes. */
function sankey(
  nodes: N[],
  links: L[],
  o: {
    x1: number
    y1: number
    dx: number
    dy: number
    how: 'left' | 'right' | 'center' | 'justify'
  },
): void {
  const x0 = 0
  const y0 = 0
  const { x1, y1, dx, how } = o
  let py = o.dy

  const ascendingBreadth = (a: N, b: N): number => a.y0 - b.y0
  const ascendingSourceBreadth = (a: L, b: L): number =>
    ascendingBreadth(a.source, b.source) || a.index - b.index
  const ascendingTargetBreadth = (a: L, b: L): number =>
    ascendingBreadth(a.target, b.target) || a.index - b.index

  for (const l of links) {
    l.source.sourceLinks.push(l)
    l.target.targetLinks.push(l)
  }
  for (const node of nodes) {
    node.value = Math.max(sum(node.sourceLinks), sum(node.targetLinks))
  }

  // Depths (longest path from a source) and heights (longest path to a sink).
  const layersOf = (next: (n: N) => N[], set: (n: N, x: number) => void) => {
    let current = new Set(nodes)
    let x = 0
    while (current.size) {
      const following = new Set<N>()
      for (const node of current) {
        set(node, x)
        for (const t of next(node)) following.add(t)
      }
      if (++x > nodes.length) {
        throw new MermaidParseError('circular link', { diagramType: 'sankey' })
      }
      current = following
    }
  }
  layersOf(
    (n) => n.sourceLinks.map((l) => l.target),
    (n, x) => (n.depth = x),
  )
  layersOf(
    (n) => n.targetLinks.map((l) => l.source),
    (n, x) => (n.height = x),
  )

  // Columns.
  const depthCount = Math.max(...nodes.map((d) => d.depth)) + 1
  const kx = (x1 - x0 - dx) / (depthCount - 1)
  const columns: N[][] = new Array(depthCount)
  for (const node of nodes) {
    const i = Math.max(
      0,
      Math.min(depthCount - 1, Math.floor(align(how, node, depthCount))),
    )
    node.layer = i
    node.x0 = x0 + i * kx
    node.x1 = node.x0 + dx
    if (columns[i]) columns[i]!.push(node)
    else columns[i] = [node]
  }
  py = Math.min(
    o.dy,
    (y1 - y0) / (Math.max(...columns.map((c) => c.length)) - 1),
  )

  const reorderLinks = (ns: N[]): void => {
    for (const { sourceLinks, targetLinks } of ns) {
      sourceLinks.sort(ascendingTargetBreadth)
      targetLinks.sort(ascendingSourceBreadth)
    }
  }
  const reorderNodeLinks = ({ sourceLinks, targetLinks }: N): void => {
    for (const {
      source: { sourceLinks: s },
    } of targetLinks)
      s.sort(ascendingTargetBreadth)
    for (const {
      target: { targetLinks: t },
    } of sourceLinks)
      t.sort(ascendingSourceBreadth)
  }

  // Initial breadths.
  const ky = Math.min(
    ...columns.map(
      (c) =>
        (y1 - y0 - (c.length - 1) * py) / c.reduce((a, n) => a + n.value, 0),
    ),
  )
  for (const col of columns) {
    let y = y0
    for (const node of col) {
      node.y0 = y
      node.y1 = y + node.value * ky
      y = node.y1 + py
      for (const link of node.sourceLinks) link.width = link.value * ky
    }
    y = (y1 - y + py) / (col.length + 1)
    for (let i = 0; i < col.length; ++i) {
      const node = col[i]!
      node.y0 += y * (i + 1)
      node.y1 += y * (i + 1)
    }
    reorderLinks(col)
  }

  const targetTop = (source: N, target: N): number => {
    let y = source.y0 - ((source.sourceLinks.length - 1) * py) / 2
    for (const { target: node, width } of source.sourceLinks) {
      if (node === target) break
      y += width + py
    }
    for (const { source: node, width } of target.targetLinks) {
      if (node === source) break
      y -= width
    }
    return y
  }
  const sourceTop = (source: N, target: N): number => {
    let y = target.y0 - ((target.targetLinks.length - 1) * py) / 2
    for (const { source: node, width } of target.targetLinks) {
      if (node === source) break
      y += width + py
    }
    for (const { target: node, width } of source.sourceLinks) {
      if (node === target) break
      y -= width
    }
    return y
  }

  const pushDown = (
    ns: N[],
    from: number,
    start: number,
    alpha: number,
  ): void => {
    let y = from
    for (let i = start; i < ns.length; ++i) {
      const node = ns[i]!
      const d = (y - node.y0) * alpha
      if (d > 1e-6) {
        node.y0 += d
        node.y1 += d
      }
      y = node.y1 + py
    }
  }
  const pushUp = (
    ns: N[],
    from: number,
    start: number,
    alpha: number,
  ): void => {
    let y = from
    for (let i = start; i >= 0; --i) {
      const node = ns[i]!
      const d = (node.y1 - y) * alpha
      if (d > 1e-6) {
        node.y0 -= d
        node.y1 -= d
      }
      y = node.y0 - py
    }
  }
  const resolveCollisions = (ns: N[], alpha: number): void => {
    const i = ns.length >> 1
    const subject = ns[i]!
    pushUp(ns, subject.y0 - py, i - 1, alpha)
    pushDown(ns, subject.y1 + py, i + 1, alpha)
    pushUp(ns, y1, ns.length - 1, alpha)
    pushDown(ns, y0, 0, alpha)
  }

  const relaxLeftToRight = (alpha: number, beta: number): void => {
    for (let i = 1; i < columns.length; ++i) {
      const column = columns[i]!
      for (const target of column) {
        let y = 0
        let w = 0
        for (const { source, value } of target.targetLinks) {
          const v = value * (target.layer - source.layer)
          y += targetTop(source, target) * v
          w += v
        }
        if (!(w > 0)) continue
        const d = (y / w - target.y0) * alpha
        target.y0 += d
        target.y1 += d
        reorderNodeLinks(target)
      }
      column.sort(ascendingBreadth)
      resolveCollisions(column, beta)
    }
  }
  const relaxRightToLeft = (alpha: number, beta: number): void => {
    for (let i = columns.length - 2; i >= 0; --i) {
      const column = columns[i]!
      for (const source of column) {
        let y = 0
        let w = 0
        for (const { target, value } of source.sourceLinks) {
          const v = value * (target.layer - source.layer)
          y += sourceTop(source, target) * v
          w += v
        }
        if (!(w > 0)) continue
        const d = (y / w - source.y0) * alpha
        source.y0 += d
        source.y1 += d
        reorderNodeLinks(source)
      }
      column.sort(ascendingBreadth)
      resolveCollisions(column, beta)
    }
  }
  for (let i = 0; i < SANKEY.iterations; ++i) {
    const alpha = Math.pow(0.99, i)
    const beta = Math.max(1 - alpha, (i + 1) / SANKEY.iterations)
    relaxRightToLeft(alpha, beta)
    relaxLeftToRight(alpha, beta)
  }

  // Link breadths.
  for (const node of nodes) {
    let ly0 = node.y0
    let ly1 = ly0
    for (const link of node.sourceLinks) {
      link.y0 = ly0 + link.width / 2
      ly0 += link.width
    }
    for (const link of node.targetLinks) {
      link.y1 = ly1 + link.width / 2
      ly1 += link.width
    }
  }
}

/** Two decimals, without overflowing for values near the double limit. */
function roundValue(v: number): number {
  const r = Math.round(v * 100) / 100
  return Number.isFinite(r) ? r : v
}

const num = (n: number): number => Math.round(n * 1e6) / 1e6

/** Lay a parsed {@link Sankey} out; throws `circular link` for a cycle, as Mermaid does. */
export function layoutSankey(sk: Sankey): PositionedSankey {
  const c = sk.config ?? {}
  const width = c.width ?? SANKEY.width
  const height = c.height ?? SANKEY.height
  const showValues = c.showValues ?? true
  const labelStyle = c.labelStyle ?? 'legacy'
  const prefix = c.prefix ?? ''
  const suffix = c.suffix ?? ''
  const nodeWidth = c.nodeWidth ?? SANKEY.nodeWidth

  const byId = new Map<string, N>()
  const nodes: N[] = sk.nodes.map((id, index) => {
    const n: N = {
      id,
      index,
      sourceLinks: [],
      targetLinks: [],
      value: 0,
      depth: 0,
      height: 0,
      layer: 0,
      x0: 0,
      x1: 0,
      y0: 0,
      y1: 0,
    }
    byId.set(id, n)
    return n
  })
  const links: L[] = sk.links.map((l, index) => ({
    index,
    source: byId.get(l.source)!,
    target: byId.get(l.target)!,
    value: l.value,
    width: 0,
    y0: 0,
    y1: 0,
  }))
  if (nodes.length === 0 || links.length === 0) {
    return {
      width,
      height,
      nodes: [],
      links: [],
      options: { linkColor: 'gradient', labelStyle, showValues },
    }
  }

  sankey(nodes, links, {
    x1: width,
    y1: height,
    dx: nodeWidth,
    dy:
      (c.nodePadding ?? SANKEY.nodePadding) +
      (showValues ? SANKEY.valuePadding : 0),
    how: c.nodeAlignment ?? 'justify',
  })

  // The layer holding the largest node; outlined labels flip around it.
  let maxValue = 0
  let central = 0
  for (const n of nodes) {
    if (n.value > maxValue) {
      maxValue = n.value
      central = n.layer
    }
  }

  const positionedNodes: PositionedSankeyNode[] = nodes.map((n) => {
    const start =
      labelStyle === 'outlined' ? n.layer >= central : n.x0 < width / 2
    const text = showValues
      ? `${n.id} ${prefix}${roundValue(n.value)}${suffix}`
      : n.id
    const node: PositionedSankeyNode = {
      id: n.id,
      index: n.index,
      x0: n.x0,
      y0: n.y0,
      x1: n.x1,
      y1: n.y1,
      value: n.value,
      layer: n.layer,
      label: {
        text,
        x: start ? n.x1 + SANKEY.labelGap : n.x0 - SANKEY.labelGap,
        y: (n.y1 + n.y0) / 2,
        anchor: start ? 'start' : 'end',
      },
    }
    const colors = c.nodeColors
    if (colors && Object.hasOwn(colors, n.id)) node.color = colors[n.id]
    return node
  })
  const positionedLinks: PositionedSankeyLink[] = links.map((l) => ({
    source: l.source.index,
    target: l.target.index,
    value: l.value,
    width: l.width,
    x0: l.source.x1,
    y0: l.y0,
    x1: l.target.x0,
    y1: l.y1,
  }))

  // Bounding box of the drawing: bars, ribbons (no stroke) and labels (SVG
  // text collapses the line break, so the value follows the id on one line).
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const grow = (x0: number, y0: number, x1: number, y1: number): void => {
    minX = Math.min(minX, x0)
    minY = Math.min(minY, y0)
    maxX = Math.max(maxX, x1)
    maxY = Math.max(maxY, y1)
  }
  for (const n of positionedNodes) {
    // An empty rect (a zero or negative flow) adds nothing to `getBBox`.
    if (n.y1 > n.y0) grow(n.x0, n.y0, n.x1, n.y1)
    const w = textWidth(n.label.text, SANKEY.fontSize) * SANKEY.labelFit
    const base = n.label.y + (showValues ? 0 : 0.35 * SANKEY.fontSize)
    const x = n.label.anchor === 'start' ? n.label.x : n.label.x - w
    grow(x, base - SANKEY.ascent, x + w, base + SANKEY.descent)
  }
  for (const l of positionedLinks) {
    grow(l.x0, Math.min(l.y0, l.y1), l.x1, Math.max(l.y0, l.y1))
  }

  // Shift so the viewBox starts at the origin.
  const shift = (v: number, by: number): number => num(v - by)
  for (const n of positionedNodes) {
    n.x0 = shift(n.x0, minX)
    n.x1 = shift(n.x1, minX)
    n.y0 = shift(n.y0, minY)
    n.y1 = shift(n.y1, minY)
    n.label.x = shift(n.label.x, minX)
    n.label.y = shift(n.label.y, minY)
  }
  for (const l of positionedLinks) {
    l.x0 = shift(l.x0, minX)
    l.x1 = shift(l.x1, minX)
    l.y0 = shift(l.y0, minY)
    l.y1 = shift(l.y1, minY)
  }

  return {
    width: num(maxX - minX),
    height: num(maxY - minY),
    nodes: positionedNodes,
    links: positionedLinks,
    options: { linkColor: c.linkColor ?? 'gradient', labelStyle, showValues },
  }
}
