// ============================================================================
// Ishikawa layout
//
// A port of Mermaid's ishikawa renderer (packages/mermaid/src/diagrams/
// ishikawa/ishikawaRenderer.ts, mermaid@12.3.0). The geometry is Mermaid's:
//
//   - the spine runs left from the head; causes alternate above (even index)
//     and below (odd index) it, one pair per step along the spine, each bone
//     slanting 82° away from the spine, with a boxed label at its far end
//   - the bone length shares a pool of 2 × 250px between the two sides by the
//     number of descendants each holds, at least 2 label heights per
//     descendant of the busiest bone
//   - sub-causes sit on their bone at even spacing: depth 2 as a horizontal
//     stub, depth 3 as a bone parallel to its parent, alternating from there
//   - the next pair starts where the leftmost text of the pair before ends
//
// Mermaid measures text in the browser (`getBBox`); here widths come from
// the library's text metrics, so positions differ by the font's advance.
// ============================================================================

import { measureTextWidth } from '@zombie-mermaid/core'
import type { Ishikawa, IshikawaNode } from '@zombie-mermaid/mermaid-parser'

/** Mermaid's constants. */
export const ISHIKAWA = {
  fontSize: 16,
  headFontSize: 14,
  spineLength: 250,
  boneStub: 30,
  boneBase: 60,
  bonePerChild: 5,
  padding: 20,
  angle: (82 * Math.PI) / 180,
} as const

const COS_A = Math.cos(ISHIKAWA.angle)
const SIN_A = Math.sin(ISHIKAWA.angle)

/** Height of one line of text, as a fraction of its font size (browser `getBBox`). */
const LINE_BOX = 1.17

export interface IshikawaLine {
  cls: 'ishikawa-spine' | 'ishikawa-branch' | 'ishikawa-sub-branch'
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface IshikawaText {
  cls: 'cause' | 'align' | 'up' | 'down'
  lines: string[]
  x: number
  /** Y of the first line. */
  y: number
}

export interface PositionedIshikawa {
  width: number
  height: number
  /** The viewBox is `0 0 width height`; everything below is already shifted into it. */
  spine: IshikawaLine
  head: {
    /** The path of the head, translated to its place. */
    d: string
    x: number
    y: number
    lines: string[]
    textX: number
    textY: number
  }
  /** Bones, boxes and labels in Mermaid's paint order. */
  items: Array<
    | { kind: 'line'; line: IshikawaLine }
    | { kind: 'box'; x: number; y: number; width: number; height: number }
    | { kind: 'text'; text: IshikawaText }
  >
}

const splitLines = (text: string): string[] => text.split(/<br\s*\/?>|\n/)

/** Mermaid's `wrapText`: greedy word wrap at `maxChars`. */
export function wrapIshikawaText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const lines: string[] = []
  for (const word of text.split(/\s+/)) {
    const last = lines.length - 1
    if (last >= 0 && lines[last]!.length + 1 + word.length <= maxChars)
      lines[last] += ' ' + word
    else lines.push(word)
  }
  return lines.join('\n')
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

interface Box {
  x0: number
  x1: number
  y0: number
  y1: number
}

const emptyBox = (): Box => ({
  x0: Infinity,
  x1: -Infinity,
  y0: Infinity,
  y1: -Infinity,
})
function grow(b: Box, x: number, y: number): void {
  b.x0 = Math.min(b.x0, x)
  b.x1 = Math.max(b.x1, x)
  b.y0 = Math.min(b.y0, y)
  b.y1 = Math.max(b.y1, y)
}

interface Extent {
  x: number
  y: number
  width: number
  height: number
}

/** The box a text occupies, as the browser's `getBBox` would give it. */
function textExtent(
  t: IshikawaText,
  anchor: 'middle' | 'end',
  size: number,
  weight = 400,
): Extent {
  const lh = size * 1.05
  const one = size * LINE_BOX
  const width = Math.max(
    ...t.lines.map((l) => measureTextWidth(l, size, weight)),
  )
  const height = one + (t.lines.length - 1) * lh
  const x = anchor === 'middle' ? t.x - width / 2 : t.x - width
  // `dominant-baseline`: middle for cause and align, baseline for up, hanging for down.
  const top =
    t.cls === 'up' ? t.y - one * 0.8 : t.cls === 'down' ? t.y : t.y - one / 2
  return { x, y: top, width, height }
}

interface Entry {
  depth: number
  text: string
  parentIndex: number
  childCount: number
}

function flattenTree(
  children: IshikawaNode[],
  direction: -1 | 1,
): { entries: Entry[]; yOrder: number[] } {
  const entries: Entry[] = []
  const yOrder: number[] = []
  const walk = (nodes: IshikawaNode[], pid: number, depth: number): void => {
    const ordered = direction === -1 ? [...nodes].reverse() : nodes
    for (const child of ordered) {
      const idx = entries.length
      entries.push({
        depth,
        text: wrapIshikawaText(child.text, 15),
        parentIndex: pid,
        childCount: child.children.length,
      })
      if (depth % 2 === 0) {
        yOrder.push(idx)
        if (child.children.length) walk(child.children, idx, depth + 1)
      } else {
        if (child.children.length) walk(child.children, idx, depth + 1)
        yOrder.push(idx)
      }
    }
  }
  walk(children, -1, 2)
  return { entries, yOrder }
}

function sideStats(nodes: IshikawaNode[]): { total: number; max: number } {
  const count = (n: IshikawaNode): number =>
    n.children.reduce((s, c) => s + 1 + count(c), 0)
  return nodes.reduce(
    (st, n) => {
      const d = count(n)
      return { total: st.total + d, max: Math.max(st.max, d) }
    },
    { total: 0, max: 0 },
  )
}

/** Lay out a parsed ishikawa diagram; undefined when it has no root. */
export function layoutIshikawa(d: Ishikawa): PositionedIshikawa | undefined {
  const root = d.root
  if (!root) return undefined
  const fs = ISHIKAWA.fontSize
  const bounds = emptyBox()
  const items: PositionedIshikawa['items'] = []
  const causes = root.children

  // Head text: wrapped at 110px (Mermaid sizes this by the 16px base font, not the head's 14px).
  const maxChars = Math.max(6, Math.floor(110 / (fs * 0.6)))
  const headLines = splitLines(wrapIshikawaText(root.text, maxChars))
  const headW = Math.max(
    ...headLines.map((l) => measureTextWidth(l, ISHIKAWA.headFontSize, 600)),
  )
  const headH =
    ISHIKAWA.headFontSize * LINE_BOX + (headLines.length - 1) * fs * 1.05
  const hw = Math.max(60, headW + 6)
  const hh = Math.max(40, headH * 2 + 40)

  let spineX = 0
  let spineY: number = ISHIKAWA.spineLength
  let spineLeft = 0

  const pushText = (
    t: IshikawaText,
    anchor: 'middle' | 'end',
    pair: Box,
  ): void => {
    items.push({ kind: 'text', text: t })
    const e = textExtent(t, anchor, fs)
    grow(bounds, e.x, e.y)
    grow(bounds, e.x + e.width, e.y + e.height)
    grow(pair, e.x, e.y)
  }
  const pushLine = (line: IshikawaLine): void => {
    items.push({ kind: 'line', line })
    grow(bounds, line.x1, line.y1)
    grow(bounds, line.x2, line.y2)
  }

  const drawBranch = (
    node: IshikawaNode,
    startX: number,
    startY: number,
    direction: -1 | 1,
    length: number,
    pair: Box,
  ): void => {
    const kids = node.children
    const lineLen = length * (kids.length ? 1 : 0.2)
    const endX = startX - COS_A * lineLen
    const endY = startY + SIN_A * lineLen * direction
    pushLine({
      cls: 'ishikawa-branch',
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY,
    })
    // Cause label: a box around the text, 20px wider each side.
    const label: IshikawaText = {
      cls: 'cause',
      lines: splitLines(node.text),
      x: endX,
      y: endY + 11 * direction,
    }
    const e = textExtent(label, 'middle', fs)
    const box = {
      x: e.x - 20,
      y: e.y - 2,
      width: e.width + 40,
      height: e.height + 4,
    }
    items.push({ kind: 'box', ...box })
    grow(bounds, box.x, box.y)
    grow(bounds, box.x + box.width, box.y + box.height)
    pushText(label, 'middle', pair)
    if (!kids.length) return

    const { entries, yOrder } = flattenTree(kids, direction)
    const ys = new Array<number>(entries.length)
    for (const [slot, idx] of yOrder.entries())
      ys[idx] = startY + (endY - startY) * ((slot + 1) / (entries.length + 1))
    const bones = new Map<
      number,
      {
        x0: number
        y0: number
        x1: number
        y1: number
        childCount: number
        drawn: number
      }
    >()
    bones.set(-1, {
      x0: startX,
      y0: startY,
      x1: endX,
      y1: endY,
      childCount: kids.length,
      drawn: 0,
    })
    const diagX = -COS_A
    const diagY = SIN_A * direction
    for (const [i, en] of entries.entries()) {
      const y = ys[i]!
      const par = bones.get(en.parentIndex)!
      const lines = splitLines(en.text)
      let bx0: number
      let by0: number
      let bx1: number
      if (en.depth % 2 === 0) {
        const dyP = par.y1 - par.y0
        bx0 = lerp(par.x0, par.x1, dyP ? (y - par.y0) / dyP : 0.5)
        by0 = y
        bx1 =
          bx0 -
          (en.childCount > 0
            ? ISHIKAWA.boneBase + en.childCount * ISHIKAWA.bonePerChild
            : ISHIKAWA.boneStub)
        pushLine({ cls: 'ishikawa-sub-branch', x1: bx0, y1: y, x2: bx1, y2: y })
        pushText(
          {
            cls: 'align',
            lines,
            x: bx1,
            y: y - ((lines.length - 1) * fs * 1.05) / 2,
          },
          'end',
          pair,
        )
      } else {
        const k = par.drawn++
        bx0 = lerp(par.x0, par.x1, (par.childCount - k) / (par.childCount + 1))
        by0 = par.y0
        bx1 = bx0 + diagX * ((y - by0) / diagY)
        pushLine({
          cls: 'ishikawa-sub-branch',
          x1: bx0,
          y1: by0,
          x2: bx1,
          y2: y,
        })
        pushText(
          {
            cls: direction < 0 ? 'up' : 'down',
            lines,
            x: bx1,
            y: y - ((lines.length - 1) * fs * 1.05) / 2,
          },
          'end',
          pair,
        )
      }
      if (en.childCount > 0)
        bones.set(i, {
          x0: bx0,
          y0: by0,
          x1: bx1,
          y1: y,
          childCount: en.childCount,
          drawn: 0,
        })
    }
  }

  if (causes.length) {
    spineX -= 20
    const upper = causes.filter((_, i) => i % 2 === 0)
    const lower = causes.filter((_, i) => i % 2 === 1)
    const us = sideStats(upper)
    const ls = sideStats(lower)
    const total = us.total + ls.total
    let upperLen: number = ISHIKAWA.spineLength
    let lowerLen: number = ISHIKAWA.spineLength
    if (total > 0) {
      const pool = ISHIKAWA.spineLength * 2
      const minLen = ISHIKAWA.spineLength * 0.3
      upperLen = Math.max(minLen, pool * (us.total / total))
      lowerLen = Math.max(minLen, pool * (ls.total / total))
    }
    const minSpacing = fs * 2
    upperLen = Math.max(upperLen, us.max * minSpacing)
    lowerLen = Math.max(lowerLen, ls.max * minSpacing)
    spineY = Math.max(upperLen, ISHIKAWA.spineLength)

    for (let p = 0; p < Math.ceil(causes.length / 2); p++) {
      const pair = emptyBox()
      const sides: Array<[IshikawaNode | undefined, -1 | 1, number]> = [
        [causes[p * 2], -1, upperLen],
        [causes[p * 2 + 1], 1, lowerLen],
      ]
      for (const [cause, dir, len] of sides) {
        if (!cause) continue
        drawBranch(cause, spineX, spineY, dir, len, pair)
      }
      spineX = pair.x0
    }
    spineLeft = spineX
  }

  // The spine, then the head at its right end.
  const spine: IshikawaLine = {
    cls: 'ishikawa-spine',
    x1: spineLeft,
    y1: spineY,
    x2: 0,
    y2: spineY,
  }
  grow(bounds, spine.x1, spine.y1)
  grow(bounds, spine.x2, spine.y2)
  grow(bounds, 0, spineY - hh / 2)
  grow(bounds, 1.2 * hw, spineY + hh / 2)

  const pad = ISHIKAWA.padding
  const ox = pad - bounds.x0
  const oy = pad - bounds.y0
  const shift = (l: IshikawaLine): IshikawaLine => ({
    ...l,
    x1: l.x1 + ox,
    y1: l.y1 + oy,
    x2: l.x2 + ox,
    y2: l.y2 + oy,
  })
  return {
    width: bounds.x1 - bounds.x0 + pad * 2,
    height: bounds.y1 - bounds.y0 + pad * 2,
    spine: shift(spine),
    head: {
      d: `M 0 ${-hh / 2} L 0 ${hh / 2} Q ${hw * 2.4} 0 0 ${-hh / 2} Z`,
      x: ox,
      y: spineY + oy,
      lines: headLines,
      textX: hw / 2 + 3,
      textY: -((headLines.length - 1) * fs * 1.05) / 2,
    },
    items: items.map((it) => {
      if (it.kind === 'line') return { kind: 'line', line: shift(it.line) }
      if (it.kind === 'box') return { ...it, x: it.x + ox, y: it.y + oy }
      return {
        kind: 'text',
        text: { ...it.text, x: it.text.x + ox, y: it.text.y + oy },
      }
    }),
  }
}
