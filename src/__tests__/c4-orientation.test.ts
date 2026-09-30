import { describe, it, expect } from 'vitest'
import { renderMermaidSVG, renderMermaidASCII } from '../index.ts'

// Every `RenderOptions.direction` through the C4 lowering: C4 is lowered to a
// flowchart and drawn by the flowchart pipeline, so an orientation regression
// would be in how the lowered edges (`Rel_Back` has its arrowhead at the
// source end, `BiRel` at both) and labels come out when the layout flips. Each
// check runs in all four directions.

const DIRECTIONS = ['TB', 'BT', 'LR', 'RL'] as const
type Dir = (typeof DIRECTIONS)[number]

const SOURCE = `C4Context
  Person(a, "A")
  Enterprise_Boundary(b0, "Bank") {
    System(b, "B")
    SystemDb(c, "C")
  }
  System_Ext(d, "D")
  Rel(a, b, "Uses", "HTTPS")
  Rel(b, c, "Reads from and writes to")
  Rel_Back(a, d, "Sends to")
  BiRel(b, d, "Syncs")`

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** Bounding box per node: its `<rect>`, or a cylinder's ellipses. */
function nodeBoxes(svg: string): Map<string, Rect> {
  const out = new Map<string, Rect>()
  for (const g of svg.split('<g class="node').slice(1)) {
    const id = /data-id="([^"]+)"/.exec(g)![1]!
    const body = g.slice(0, g.indexOf('</g>'))
    const rect =
      /<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/.exec(
        body,
      )
    if (rect) {
      out.set(id, { x: +rect[1]!, y: +rect[2]!, w: +rect[3]!, h: +rect[4]! })
      continue
    }
    const ells = [
      ...body.matchAll(
        /<ellipse cx="([\d.-]+)" cy="([\d.-]+)" rx="([\d.-]+)" ry="([\d.-]+)"/g,
      ),
    ].map((m) => ({ cx: +m[1]!, cy: +m[2]!, rx: +m[3]!, ry: +m[4]! }))
    if (ells.length > 0) {
      const top = Math.min(...ells.map((e) => e.cy - e.ry))
      const bottom = Math.max(...ells.map((e) => e.cy + e.ry))
      const e0 = ells[0]!
      out.set(id, { x: e0.cx - e0.rx, y: top, w: e0.rx * 2, h: bottom - top })
    }
  }
  return out
}

interface Edge {
  from: string
  to: string
  start: boolean
  end: boolean
  markerStart: boolean
  markerEnd: boolean
}

function edges(svg: string): Edge[] {
  return [...svg.matchAll(/<polyline class="edge"([^>]*)>/g)].map((m) => {
    const attrs = m[1]!
    const get = (k: string) => new RegExp(`${k}="([^"]*)"`).exec(attrs)?.[1]
    return {
      from: get('data-from')!,
      to: get('data-to')!,
      start: get('data-arrow-start') === 'true',
      end: get('data-arrow-end') === 'true',
      markerStart: attrs.includes('marker-start='),
      markerEnd: attrs.includes('marker-end='),
    }
  })
}

describe.each(DIRECTIONS)('C4 SVG, direction %s', (dir) => {
  const svg = renderMermaidSVG(SOURCE, { direction: dir })
  const edge = (from: string, to: string): Edge => {
    const e = edges(svg).find((x) => x.from === from && x.to === to)
    if (!e) throw new Error(`no edge ${from} -> ${to}`)
    return e
  }

  it('draws Rel with the arrowhead at "to" only', () => {
    expect(edge('a', 'b')).toMatchObject({
      start: false,
      end: true,
      markerStart: false,
      markerEnd: true,
    })
  })

  it('draws Rel_Back with the arrowhead at "from" only', () => {
    expect(edge('a', 'd')).toMatchObject({
      start: true,
      end: false,
      markerStart: true,
      markerEnd: false,
    })
  })

  it('draws BiRel with an arrowhead at both ends', () => {
    expect(edge('b', 'd')).toMatchObject({
      start: true,
      end: true,
      markerStart: true,
      markerEnd: true,
    })
  })

  it('lays the Rel chain out along the direction', () => {
    const boxes = nodeBoxes(svg)
    const a = boxes.get('a')!
    const b = boxes.get('b')!
    const inOrder = {
      TB: a.y + a.h <= b.y,
      BT: b.y + b.h <= a.y,
      LR: a.x + a.w <= b.x,
      RL: b.x + b.w <= a.x,
    }
    expect(inOrder[dir]).toBe(true)
  })

  it('keeps every relationship label, off each other and off the boxes', () => {
    const labels = [
      ...svg.matchAll(
        /<g class="edge-label"[^>]*>\s*<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/g,
      ),
    ].map((m) => ({ x: +m[1]!, y: +m[2]!, w: +m[3]!, h: +m[4]! }))
    expect(labels).toHaveLength(4)
    const boxes = nodeBoxes(svg)
    expect(boxes.size).toBe(4)
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        expect(overlap(labels[i]!, labels[j]!)).toBe(false)
      }
      for (const [id, box] of boxes) {
        expect(overlap(labels[i]!, box), `label ${i} over ${id}`).toBe(false)
      }
    }
  })
})

describe.each(DIRECTIONS)('C4 ASCII, direction %s', (dir) => {
  const out = renderMermaidASCII(SOURCE, { direction: dir })

  it('keeps every relationship label', () => {
    for (const word of [
      'Uses',
      '[HTTPS]',
      'Reads',
      'from',
      'and',
      'writes',
      'to',
      'Sends',
      'Syncs',
    ]) {
      expect(out, word).toContain(word)
    }
  })

  it('draws one arrowhead per Rel and two for BiRel', () => {
    // Rel, Rel, Rel_Back (head at "from") and BiRel (both ends).
    expect([...out].filter((c) => '▲▼◄►'.includes(c))).toHaveLength(5)
  })
})

describe('C4 ASCII row order', () => {
  const rowOf = (out: string, needle: string): number[] =>
    out.split('\n').flatMap((l, i) => (l.includes(needle) ? [i] : []))

  it('puts the person above the systems in TB and below them in BT', () => {
    const tb = renderMermaidASCII(SOURCE, { direction: 'TB' satisfies Dir })
    const bt = renderMermaidASCII(SOURCE, { direction: 'BT' satisfies Dir })
    expect(rowOf(tb, '[Person]')[0]!).toBeLessThan(
      Math.min(...rowOf(tb, '[Software System]')),
    )
    expect(rowOf(bt, '[Person]')[0]!).toBeGreaterThan(
      Math.max(...rowOf(bt, '[Software System]')),
    )
  })
})
