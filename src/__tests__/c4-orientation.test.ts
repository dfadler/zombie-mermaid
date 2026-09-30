import { describe, it, expect } from 'vitest'
import { renderMermaidSVG, renderMermaidASCII } from '../index.ts'

// Every `RenderOptions.direction` through the dedicated C4 renderers: the
// layout flips with it, and so must the arrowheads, which are placed from the
// route's end points rather than by SVG markers. A regression here (a head on
// the wrong end after a flip, a label landing on another label or on a box)
// only shows up in some orientations, so each check runs in all four.

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

const svgOf = (dir: Dir): string => renderMermaidSVG(SOURCE, { direction: dir })

/** Bounding box per element: a `<rect>`, or a cylinder's ellipses. */
function elementBoxes(svg: string): Map<string, Rect> {
  const out = new Map<string, Rect>()
  const groups = svg.split('<g class="c4-element"').slice(1)
  for (const g of groups) {
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
    const ell =
      /<ellipse cx="([\d.-]+)" cy="([\d.-]+)" rx="([\d.-]+)" ry="([\d.-]+)"/.exec(
        body,
      )
    if (ell) {
      const cx = +ell[1]!
      const rx = +ell[3]!
      const ry = +ell[4]!
      const ys = [...body.matchAll(/ cy="([\d.-]+)"/g)].map((m) => +m[1]!)
      const top = Math.min(...ys) - ry
      const bottom = Math.max(...ys) + ry
      out.set(id, { x: cx - rx, y: top, w: rx * 2, h: bottom - top })
    }
  }
  return out
}

interface Route {
  from: string
  to: string
  points: [number, number][]
}

function routes(svg: string): Route[] {
  return [
    ...svg.matchAll(
      /<polyline class="c4-relationship" data-from="([^"]+)" data-to="([^"]+)"[^>]*?points="([^"]+)"/g,
    ),
  ].map((m) => ({
    from: m[1]!,
    to: m[2]!,
    points: m[3]!
      .split(' ')
      .map((p) => p.split(',').map(Number) as [number, number]),
  }))
}

/** Arrowhead tips (the first vertex of each `var(--_arrow)` polygon). */
function tips(svg: string): [number, number][] {
  return [
    ...svg.matchAll(
      /<polygon points="([\d.-]+),([\d.-]+) [^"]*" fill="var\(--_arrow\)"/g,
    ),
  ].map((m) => [+m[1]!, +m[2]!])
}

const near = (p: [number, number], q: [number, number]): boolean =>
  Math.hypot(p[0] - q[0], p[1] - q[1]) < 1

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe.each(DIRECTIONS)('C4 SVG, direction %s', (dir) => {
  const svg = svgOf(dir)
  const byPair = (from: string, to: string): Route => {
    const r = routes(svg).find((x) => x.from === from && x.to === to)
    if (!r) throw new Error(`no route ${from} -> ${to}`)
    return r
  }
  const tipsNear = (p: [number, number]): number =>
    tips(svg).filter((t) => near(t, p)).length

  it('puts the arrowhead at "to" for Rel', () => {
    const r = byPair('a', 'b')
    expect(tipsNear(r.points.at(-1)!)).toBe(1)
    expect(tipsNear(r.points[0]!)).toBe(0)
  })

  it('puts the arrowhead at "from" for Rel_Back', () => {
    const r = byPair('a', 'd')
    expect(tipsNear(r.points[0]!)).toBe(1)
    expect(tipsNear(r.points.at(-1)!)).toBe(0)
  })

  it('puts an arrowhead at both ends for BiRel', () => {
    const r = byPair('b', 'd')
    expect(tipsNear(r.points[0]!)).toBe(1)
    expect(tipsNear(r.points.at(-1)!)).toBe(1)
  })

  it('draws one arrowhead per Rel and two for BiRel', () => {
    expect(tips(svg)).toHaveLength(1 + 1 + 1 + 2)
  })

  it('lays the Rel chain out along the direction', () => {
    const boxes = elementBoxes(svg)
    const a = boxes.get('a')!
    const b = boxes.get('b')!
    const before = {
      TB: a.y + a.h <= b.y,
      BT: b.y + b.h <= a.y,
      LR: a.x + a.w <= b.x,
      RL: b.x + b.w <= a.x,
    }
    expect(before[dir]).toBe(true)
  })

  it('keeps relationship labels off each other and off the boxes', () => {
    const labels = [
      ...svg.matchAll(
        /<g class="c4-relationship-label"[^>]*>\s*<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/g,
      ),
    ].map((m) => ({ x: +m[1]!, y: +m[2]!, w: +m[3]!, h: +m[4]! }))
    expect(labels).toHaveLength(4)
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        expect(overlap(labels[i]!, labels[j]!)).toBe(false)
      }
      for (const [id, box] of elementBoxes(svg)) {
        expect(overlap(labels[i]!, box), `label ${i} over ${id}`).toBe(false)
      }
    }
  })
})

describe('C4 ASCII orientations', () => {
  const ascii = (dir: Dir): string =>
    renderMermaidASCII(SOURCE, { direction: dir })

  it('draws arrowheads on the right ends in TB', () => {
    const out = ascii('TB')
    // Rel, Rel, and one end each of Rel_Back and BiRel point down; the
    // Rel_Back head and the other BiRel head point up.
    expect([...out].filter((c) => c === '▼')).toHaveLength(3)
    expect([...out].filter((c) => c === '▲')).toHaveLength(2)
  })

  it('reverses the rows and the arrowheads in BT', () => {
    const tb = ascii('TB')
    const bt = ascii('BT')
    expect([...bt].filter((c) => c === '▲')).toHaveLength(
      [...tb].filter((c) => c === '▼').length,
    )
    expect([...bt].filter((c) => c === '▼')).toHaveLength(
      [...tb].filter((c) => c === '▲').length,
    )
    expect(bt.indexOf('[Person]')).toBeGreaterThan(
      bt.indexOf('[Software System]'),
    )
  })

  it('flips the contents of a boundary too in BT', () => {
    const lines = ascii('BT').split('\n')
    const at = (re: RegExp) => lines.findIndex((l) => re.test(l))
    // B -> C flows upward, so C sits above B inside the frame.
    expect(at(/│ +C +│/)).toBeLessThan(at(/│ +B +│/))
  })

  it.each(['TB', 'BT'] as const)(
    'keeps every relationship label in %s, wrapped if it must be',
    (dir) => {
      const out = ascii(dir)
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
    },
  )

  it('is top-to-bottom only: LR and RL render exactly like TB', () => {
    expect(ascii('LR')).toBe(ascii('TB'))
    expect(ascii('RL')).toBe(ascii('TB'))
  })
})
