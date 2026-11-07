/**
 * Mindmap SVG: shape sizes, the CoSE-Bilkent layout and the renderer's
 * structure, checked against numbers taken from a real mermaid 12.3.0 render
 * (the agreement test in __tests__/mindmap-agreement.test.ts covers the rest).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { __resetSvgTitleIdCounterForTests } from '@zombie-mermaid/core'
import { parseMindmap } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../../../../src/index.ts'
import {
  basisPath,
  layoutLabel,
  layoutMindmap,
  shapeFor,
} from '../mindmap/layout.ts'
import { coseBilkentLayout } from '../mindmap/cose-bilkent.ts'

beforeEach(() => {
  __resetSvgTitleIdCounterForTests()
})

const BASIC = `mindmap
  root((mindmap))
    Origins
      Long history
    Research
    Tools`

const lay = (src: string) => layoutMindmap(parseMindmap(src))
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length

describe('mindmap shapes, from mermaid 12.3.0 label boxes', () => {
  // Label box (w x h) -> shape box, measured in mermaid 12.3.0.
  it.each([
    ['default', 49.375, 24, 89.375, 34],
    ['rect', 83.265625, 24, 123.265625, 44],
    ['rounded', 61.296875, 24, 91.296875, 54],
    ['hexagon', 60.984375, 24, 102.984375, 44],
  ] as const)('%s', (shape, bw, bh, w, h) => {
    const s = shapeFor(shape, bw, bh)
    expect(s.width).toBeCloseTo(w, 6)
    expect(s.height).toBeCloseTo(h, 6)
  })

  it('circle: half the label diagonal plus 10', () => {
    const s = shapeFor('circle', 41.71875, 24)
    expect(s.radius).toBeCloseTo(34.0647776925245, 9)
    expect(s.width).toBeCloseTo(68.129555385049, 9)
  })

  it('cloud and bang: path extents, anchored at the path origin', () => {
    const cloud = shapeFor('cloud', 40.53125, 24)
    expect(cloud.path).toMatch(/^M-25\.2656 -17 a/)
    expect(cloud.width).toBeGreaterThan(40)
    const bang = shapeFor('bang', 34.234375, 24)
    expect(bang.path).toMatch(/^M-42\.1172 -32 a/)
    expect(bang.height).toBeGreaterThan(40)
    // A bang is never smaller than the label plus 20
    expect(shapeFor('bang', 100, 24).width).toBeGreaterThan(120)
  })
})

describe('mindmap labels', () => {
  it('is as wide as its longest line below 200px, 24px per line', () => {
    const l = layoutLabel('a<br/>bbbb')
    expect(l.lines).toHaveLength(2)
    expect(l.height).toBe(48)
    expect(l.width).toBeLessThan(200)
  })

  it('wraps at 200px into a 200px box', () => {
    const l = layoutLabel(
      'British popular psychology author Tony Buzan and many more words here',
    )
    expect(l.width).toBe(200)
    expect(l.lines.length).toBeGreaterThan(1)
    expect(l.height).toBe(l.lines.length * 24)
  })

  it('wraps a long line made of several styled runs', () => {
    const l = layoutLabel(
      '**bold words here** and *italic words here too* and plain words after them',
    )
    expect(l.lines.length).toBeGreaterThan(1)
  })
})

describe('mindmap layout', () => {
  it('places every node, centres the root nearest the middle, pads by 10', () => {
    const l = lay(BASIC)
    expect(l.nodes).toHaveLength(5)
    expect(l.edges).toHaveLength(4)
    for (const n of l.nodes) {
      expect(n.x + n.boxX).toBeGreaterThanOrEqual(l.originX + 10 - 1e-9)
      expect(n.y + n.boxY).toBeGreaterThanOrEqual(l.originY + 10 - 1e-9)
      expect(n.x + n.boxX + n.width).toBeLessThanOrEqual(
        l.originX + l.width - 10 + 1e-9,
      )
    }
  })

  it('is deterministic', () => {
    expect(lay(BASIC)).toEqual(lay(BASIC))
  })

  it('gives branches sections 0..10 in turn and descendants their parent’s', () => {
    const src = `mindmap\n  r\n${Array.from({ length: 12 }, (_, i) => `    b${i}\n      c${i}`).join('\n')}`
    const l = lay(src)
    expect(l.nodes[0]!.section).toBeUndefined()
    const sections = l.nodes.slice(1).map((n) => n.section)
    expect(sections.slice(0, 4)).toEqual([0, 0, 1, 1])
    expect(sections[22]).toBe(0) // B11 wraps to section 0
    expect(sections[23]).toBe(0)
  })

  it('records edge depth from the parent’s indentation level', () => {
    const l = lay(BASIC)
    expect(l.edges.map((e) => e.depth)).toEqual([1, 1, 1, 3])
  })

  it('draws a one-node mindmap', () => {
    const l = lay('mindmap\n  only')
    expect(l.edges).toEqual([])
    expect(l.nodes).toHaveLength(1)
  })

  it('draws an edge as a basis spline through the 15px-inset ends', () => {
    expect(
      basisPath([
        [0, 0],
        [3, 3],
        [6, 6],
      ]),
    ).toBe('M0,0L0.5,0.5C1,1,2,2,3,3C4,4,5,5,5.5,5.5L6,6')
  })
})

describe('coseBilkentLayout', () => {
  it('lays out nothing, and refuses what is not one tree', () => {
    expect(coseBilkentLayout([], []).size).toBe(0)
    expect(() =>
      coseBilkentLayout(
        [
          { id: 'a', width: 10, height: 10 },
          { id: 'b', width: 10, height: 10 },
        ],
        [],
      ),
    ).toThrow()
  })
})

describe('coseBilkentLayout: trees of every shape', () => {
  const tree = (n: number, parent: (i: number) => number) => ({
    nodes: Array.from({ length: n }, (_, i) => ({
      id: String(i),
      width: 40 + ((i * 37) % 120),
      height: 24 + ((i * 11) % 30),
    })),
    edges: Array.from({ length: n - 1 }, (_, k) => ({
      source: String(parent(k + 1)),
      target: String(k + 1),
    })),
  })
  const shapes: [string, number, (i: number) => number][] = [
    ['chain', 25, (i) => i - 1],
    ['star', 30, () => 0],
    ['binary', 80, (i) => (i - 1) >> 1],
    ['caterpillar', 40, (i) => (i % 2 === 0 ? i - 1 : Math.max(0, i - 2))],
    ['pair', 2, () => 0],
  ]
  it.each(shapes)(
    '%s: finite, deterministic, nodes do not coincide',
    (_n, size, parent) => {
      const { nodes, edges } = tree(size, parent)
      const a = coseBilkentLayout(nodes, edges)
      expect(coseBilkentLayout(nodes, edges)).toEqual(a)
      const seen = new Set<string>()
      for (const n of nodes) {
        const p = a.get(n.id)!
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
        seen.add(`${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      }
      expect(seen.size).toBe(size)
    },
  )

  it('pushes apart nodes far wider than the ideal edge length', () => {
    const wide = (id: string) => ({ id, width: 320, height: 90 })
    const ids = ['r', 'a', 'b', 'c', 'd', 'e', 'f']
    const edges = ids.slice(1).map((target) => ({ source: 'r', target }))
    const out = coseBilkentLayout(ids.map(wide), edges)
    for (const [i, a] of ids.entries()) {
      for (const b of ids.slice(i + 1)) {
        const p = out.get(a)!
        const q = out.get(b)!
        const apart = Math.abs(p.x - q.x) >= 320 || Math.abs(p.y - q.y) >= 90
        expect(apart, `${a} and ${b} overlap`).toBe(true)
      }
    }
  })

  it('refuses an edge to an unknown node and ignores repeats and self loops', () => {
    const n = ['a', 'b'].map((id) => ({ id, width: 40, height: 24 }))
    expect(() =>
      coseBilkentLayout(n, [{ source: 'a', target: 'zzz' }]),
    ).toThrow(/unknown node/)
    const once = coseBilkentLayout(n, [{ source: 'a', target: 'b' }])
    const noisy = coseBilkentLayout(n, [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' },
      { source: 'a', target: 'a' },
    ])
    expect(noisy).toEqual(once)
  })

  it('places a lone node and refuses a cycle', () => {
    expect(
      coseBilkentLayout([{ id: 'a', width: 10, height: 10 }], []).size,
    ).toBe(1)
    const n = ['a', 'b', 'c'].map((id) => ({ id, width: 10, height: 10 }))
    expect(() =>
      coseBilkentLayout(n, [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
        { source: 'c', target: 'a' },
      ]),
    ).toThrow()
  })
})

describe('mindmap SVG', () => {
  it('draws edges then nodes in Mermaid’s order', () => {
    const svg = renderMermaidSVG(BASIC)
    expect(svg).toMatch(/^<svg[^>]*viewBox="0 0 /)
    expect(count(svg, /<path d="M[^"]*" class="mm-edge/g)).toBe(4)
    expect(count(svg, /class="mm-node /g)).toBe(5)
    expect(svg.indexOf('mm-edges')).toBeLessThan(svg.indexOf('mm-nodes'))
    expect(svg).toContain('<circle class="mm-shape"')
    expect(svg).toContain('class="mm-underline"')
    expect(svg).toContain('>Origins</text>')
  })

  it('draws each shape with its element', () => {
    const svg = renderMermaidSVG(`mindmap
  r[sq]
    a(rd)
    b((ci))
    c))bg((
    d)cl(
    e{{hx}}
    f`)
    expect(svg).toMatch(/<rect class="mm-shape" x=/)
    expect(svg).toMatch(/<rect class="mm-shape" rx="5"/)
    expect(svg).toContain('<circle class="mm-shape"')
    // Cloud, bang and the default shape
    expect(count(svg, /<path class="mm-shape"/g)).toBe(3)
    expect(svg).toContain('<polygon class="mm-shape"')
  })

  it('styles bold, italic and user classes, and escapes text', () => {
    const svg = renderMermaidSVG(`mindmap
  r["\`**b** *i* <x>\`"]
    a & b
      :::urgent big
    c
      :::9bad`)
    expect(svg).toContain('<tspan class="mm-bold">b</tspan>')
    expect(svg).toContain('<tspan class="mm-italic">i</tspan>')
    expect(svg).toContain('a &amp; b')
    expect(svg).toMatch(/class="mm-node mm-s0 mm-default urgent big"/)
    expect(svg).not.toContain('9bad')
  })

  it('thins connectors with indentation, 3px once not positive', () => {
    const deep = Array.from(
      { length: 8 },
      (_, i) => `${' '.repeat(2 + i * 2)}n${i}`,
    ).join('\n')
    const svg = renderMermaidSVG(`mindmap\n${deep}`)
    const widths = [...svg.matchAll(/stroke-width="(\d+)"/g)].map((m) =>
      Number(m[1]),
    )
    expect(widths.slice(0, 3)).toEqual([11, 5, 3])
  })

  it('names the diagram from options.title and drops it when decorative', () => {
    expect(renderMermaidSVG(BASIC, { title: 'Plan' })).toContain(
      '>Plan</title>',
    )
    expect(renderMermaidSVG(BASIC, { decorative: true })).toContain(
      'aria-hidden="true"',
    )
  })

  it('rejects what mermaid rejects', () => {
    expect(() => renderMermaidSVG('mindmap\n  r\n  a')).toThrow(/only one root/)
  })
})
