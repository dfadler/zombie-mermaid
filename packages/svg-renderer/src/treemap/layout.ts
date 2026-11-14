// ============================================================================
// Treemap layout
//
// Turns a parsed Treemap into absolute SVG geometry, following Mermaid's own
// treemap renderer (packages/mermaid/src/diagrams/treemap/renderer.ts), checked
// against mermaid@12.3.0. Mermaid lays the tree out with d3-hierarchy's
// squarified treemap, ported below:
//
//   - the canvas is 1000 x 400 (`nodeWidth` x `nodeHeight` x 10), the root an
//     unnamed node holding the top-level rows, children sorted by value (largest
//     first, a stable sort)
//   - a section reserves a 25px header plus 10px above its children and 10px
//     left, right and bottom; siblings are 10px apart; coordinates are rounded
//   - colours are an ordinal scale over names, assigned in breadth-first order
//     (the unnamed root takes slot 0, which is transparent) and wrapping after
//     12; a leaf takes its parent section's colour
//   - section labels truncate with "..." to fit beside the value; a leaf label
//     starts at 38px (16px with more than 20 leaves) and shrinks until it fits,
//     hiding when it cannot, with its value 0.6 times as large under it
//   - the viewBox is the bounding box of the drawn rects (and the title) plus 8px
//
// Text widths come from Trebuchet MS advances (Mermaid's default stack) rather
// than the browser's `getComputedTextLength`, so truncation points and font
// sizes can still differ by a step from Mermaid's for non-ASCII text or bold.
// ============================================================================

import { measureTextWidth } from '@zombie-mermaid/core'
import { trebuchetAdvance } from '../pie/trebuchet-metrics.ts'
import { formatTreemapValue } from '@zombie-mermaid/mermaid-parser'
import type {
  PositionedTreemap,
  PositionedTreemapLeaf,
  PositionedTreemapSection,
  Treemap,
  TreemapNode,
  TreemapStyle,
} from '@zombie-mermaid/mermaid-parser'

/** Mermaid's constants for the treemap diagram, in px. */
export const TREEMAP = {
  width: 1000,
  height: 400,
  padding: 10,
  sectionHeader: 25,
  sectionPadding: 10,
  diagramPadding: 8,
  titleHeight: 30,
  titleFontSize: 14,
  sectionLabelFontSize: 12,
  sectionValueFontSize: 10,
  /** Slots in Mermaid's colour range (slot 0 is transparent). */
  colorSlots: 13,
} as const

interface HNode {
  data: TreemapNode
  depth: number
  parent?: HNode
  children?: HNode[]
  value: number
  x0: number
  y0: number
  x1: number
  y1: number
}

const PHI = (1 + Math.sqrt(5)) / 2

/** d3.hierarchy(root).sum(value).sort(by value, descending). */
function hierarchy(data: TreemapNode, depth = 0, parent?: HNode): HNode {
  const node: HNode = {
    data,
    depth,
    ...(parent && { parent }),
    value: data.value ?? 0,
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
  }
  if (data.children && data.children.length > 0) {
    node.children = data.children.map((c) => hierarchy(c, depth + 1, node))
    node.value += node.children.reduce((s, c) => s + c.value, 0)
    node.children.sort((a, b) => b.value - a.value)
  }
  return node
}

function dice(p: HNode, x0: number, y0: number, x1: number, y1: number): void {
  const k = p.value && (x1 - x0) / p.value
  let x = x0
  for (const n of p.children!) {
    n.y0 = y0
    n.y1 = y1
    n.x0 = x
    x += n.value * k
    n.x1 = x
  }
}

function slice(p: HNode, x0: number, y0: number, x1: number, y1: number): void {
  const k = p.value && (y1 - y0) / p.value
  let y = y0
  for (const n of p.children!) {
    n.x0 = x0
    n.x1 = x1
    n.y0 = y
    y += n.value * k
    n.y1 = y
  }
}

/** Port of d3-hierarchy's `treemapSquarify` with the golden ratio. */
function squarify(
  parent: HNode,
  left: number,
  top: number,
  x1: number,
  y1: number,
): void {
  let x0 = left
  let y0 = top
  const nodes = parent.children!
  const n = nodes.length
  let i0 = 0
  let i1 = 0
  let value = parent.value
  while (i0 < n) {
    const dx = x1 - x0
    const dy = y1 - y0
    // Find the next non-empty node.
    let sumValue: number
    do sumValue = nodes[i1++]!.value
    while (!sumValue && i1 < n)
    let minValue = sumValue
    let maxValue = sumValue
    const alpha = Math.max(dy / dx, dx / dy) / (value * PHI)
    let beta = sumValue * sumValue * alpha
    let minRatio = Math.max(maxValue / beta, beta / minValue)
    // Keep adding nodes while the aspect ratio maintains or improves.
    for (; i1 < n; ++i1) {
      const nodeValue = nodes[i1]!.value
      sumValue += nodeValue
      if (nodeValue < minValue) minValue = nodeValue
      if (nodeValue > maxValue) maxValue = nodeValue
      beta = sumValue * sumValue * alpha
      const newRatio = Math.max(maxValue / beta, beta / minValue)
      if (newRatio > minRatio) {
        sumValue -= nodeValue
        break
      }
      minRatio = newRatio
    }
    const row = { value: sumValue, children: nodes.slice(i0, i1) } as HNode
    if (dx < dy) {
      dice(row, x0, y0, x1, value ? (y0 += (dy * sumValue) / value) : y1)
    } else {
      slice(row, x0, y0, value ? (x0 += (dx * sumValue) / value) : x1, y1)
    }
    value -= sumValue
    i0 = i1
  }
}

/** Port of d3's `treemap().size().paddingInner/Top/...().round(true)`. */
function layoutTree(root: HNode, w: number, h: number, inner: number): void {
  const header = TREEMAP.sectionHeader + TREEMAP.sectionPadding
  const pad = TREEMAP.sectionPadding
  root.x0 = 0
  root.y0 = 0
  root.x1 = w
  root.y1 = h
  const position = (node: HNode): void => {
    const p = node.depth === 0 ? 0 : inner / 2
    let x0 = node.x0 + p
    let y0 = node.y0 + p
    let x1 = node.x1 - p
    let y1 = node.y1 - p
    if (x1 < x0) x0 = x1 = (x0 + x1) / 2
    if (y1 < y0) y0 = y1 = (y0 + y1) / 2
    node.x0 = x0
    node.y0 = y0
    node.x1 = x1
    node.y1 = y1
    if (node.children) {
      const q = inner / 2
      x0 += pad - q
      y0 += header - q
      x1 -= pad - q
      y1 -= pad - q
      if (x1 < x0) x0 = x1 = (x0 + x1) / 2
      if (y1 < y0) y0 = y1 = (y0 + y1) / 2
      squarify(node, x0, y0, x1, y1)
      node.children.forEach(position)
    }
  }
  position(root)
  const round = (node: HNode): void => {
    node.x0 = Math.round(node.x0)
    node.y0 = Math.round(node.y0)
    node.x1 = Math.round(node.x1)
    node.y1 = Math.round(node.y1)
    node.children?.forEach(round)
  }
  round(root)
}

/**
 * Width of `text` in Mermaid's default stack (Trebuchet MS), which is what its
 * fitting measures; characters outside printable ASCII fall back to the
 * library's Inter estimate. Bold is measured as regular.
 */
const w = (text: string, size: number): number => {
  let total = 0
  for (const ch of text) {
    total += trebuchetAdvance(ch, size) ?? measureTextWidth(ch, size, 400)
  }
  return total
}

/** Mermaid's section-label truncation: drop characters until `...` fits. */
function truncate(text: string, size: number, avail: number): string {
  if (w(text, size) <= avail) return text
  for (let len = text.length - 1; len >= 0; len--) {
    if (len === 0) return w('...', size) > avail ? '' : '...'
    const t = `${text.slice(0, len)}...`
    if (w(t, size) <= avail) return t
  }
  return ''
}

/** Lay out a parsed treemap. */
export function layoutTreemap(treemap: Treemap): PositionedTreemap {
  const root = hierarchy({
    name: '',
    styles: [],
    children: treemap.roots,
  })
  layoutTree(root, TREEMAP.width, TREEMAP.height, TREEMAP.padding)

  // Breadth-first (d3's iterator) for the sections and their colour slots.
  const bfs: HNode[] = [root]
  for (let i = 0; i < bfs.length; i++) bfs.push(...(bfs[i]!.children ?? []))
  const slot = new Map<string, number>([['', 0]])
  // The scale is ordinal: the nth distinct name takes the nth slot, wrapping.
  const index = (name: string): number => {
    if (!slot.has(name)) slot.set(name, slot.size)
    return slot.get(name)! % TREEMAP.colorSlots
  }

  const sections: PositionedTreemapSection[] = bfs
    .filter((n) => n.children)
    .map((n): PositionedTreemapSection => {
      const width = n.x1 - n.x0
      const styles: TreemapStyle[] = n.data.styles
      const sec: PositionedTreemapSection = {
        name: n.data.name,
        depth: n.depth,
        x: n.x0,
        y: n.y0,
        width,
        height: n.y1 - n.y0,
        color: index(n.data.name),
        value: n.value,
        styles,
        label: { text: '', x: 6, y: TREEMAP.sectionHeader / 2, fontSize: 12 },
      }
      if (n.depth > 0) {
        const avail = Math.max(
          15,
          n.value ? width - 10 - 30 - 10 - 6 : width - 6 - 6,
        )
        sec.label.text = truncate(
          n.data.name,
          TREEMAP.sectionLabelFontSize,
          avail,
        )
        if (n.value) {
          sec.valueLabel = {
            text: formatTreemapValue(n.value),
            x: width - 10,
            y: TREEMAP.sectionHeader / 2,
            fontSize: TREEMAP.sectionValueFontSize,
          }
        }
      }
      return sec
    })

  // Pre-order (d3's `leaves()`): a childless section is a leaf of value 0.
  const leafNodes: HNode[] = []
  const walk = (n: HNode): void => {
    if (n.children) n.children.forEach(walk)
    else leafNodes.push(n)
  }
  walk(root)

  const complex = leafNodes.length > 20
  const baseLabel = complex ? 16 : 38
  const baseValue = complex ? 14 : 28
  const minLabel = complex ? 4 : 8
  const minValue = complex ? 4 : 6
  const pad = complex ? 2 : 4
  const minShow = complex ? 8 : 10
  const gap = complex ? 1 : 2

  const leaves = leafNodes.map((n): PositionedTreemapLeaf => {
    const width = n.x1 - n.x0
    const height = n.y1 - n.y0
    const leaf: PositionedTreemapLeaf = {
      name: n.data.name,
      x: n.x0,
      y: n.y0,
      width,
      height,
      color: index(n.parent ? n.parent.data.name : n.data.name),
      value: n.value,
      styles: n.data.styles,
    }
    const availW = width - 2 * pad
    const availH = height - 2 * pad
    if (availW < minShow || availH < minShow || n.data.name === '') return leaf

    let size = baseLabel
    const nameWidth = (): number => w(n.data.name, size)
    while (nameWidth() > availW && size > minLabel) size--
    const valueSize = (): number =>
      Math.max(minValue, Math.min(baseValue, Math.round(size * 0.6)))
    while (size + gap + valueSize() > availH && size > minLabel) size--
    const hidden = complex
      ? size < minLabel || availH < minLabel
      : nameWidth() > availW || size < minLabel || availH < size
    if (hidden) return leaf
    leaf.label = {
      text: n.data.name,
      x: width / 2,
      y: height / 2,
      fontSize: size,
    }
    const text = n.value ? formatTreemapValue(n.value) : ''
    const vs = valueSize()
    const top = height / 2 + size / 2 + gap
    if (text && w(text, vs) <= availW && top + vs <= height - 4) {
      leaf.valueLabel = { text, x: width / 2, y: top, fontSize: vs }
    }
    return leaf
  })

  // The viewBox hugs the drawn rects (not the hidden root) and the title.
  const offsetY = treemap.title ? TREEMAP.titleHeight : 0
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
  for (const s of sections) {
    if (s.depth > 0)
      grow(s.x, s.y + offsetY, s.x + s.width, s.y + offsetY + s.height)
  }
  for (const l of leaves) {
    grow(l.x, l.y + offsetY, l.x + l.width, l.y + offsetY + l.height)
  }
  let title: PositionedTreemap['title']
  if (treemap.title) {
    const half = w(treemap.title, TREEMAP.titleFontSize) / 2
    title = {
      text: treemap.title,
      x: TREEMAP.width / 2,
      y: TREEMAP.titleHeight / 2,
    }
    // A 14px line is about 18.7px tall in Mermaid's headless render.
    grow(title.x - half, title.y - 9.34, title.x + half, title.y + 9.34)
  }
  const d = TREEMAP.diagramPadding
  return {
    width: maxX - minX + 2 * d,
    height: maxY - minY + 2 * d,
    ...(title && { title }),
    offsetX: d - minX,
    offsetY: d - minY,
    treeOffsetY: offsetY,
    sections,
    leaves,
  }
}
