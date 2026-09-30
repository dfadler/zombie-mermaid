import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseC4Diagram } from '@zombie-mermaid/mermaid-parser'
import type { PositionedC4Diagram } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../../../../src/index.ts'
import { layoutC4DiagramSync, routeManualEdge } from '../c4/layout.ts'

function layout(src: string, direction?: 'LR'): PositionedC4Diagram {
  const d = parseC4Diagram(splitStatements(src))
  return layoutC4DiagramSync(direction ? { ...d, direction } : d)
}

const el = (p: PositionedC4Diagram, alias: string) =>
  p.elements.find((e) => e.alias === alias)!
const centerY = (e: { y: number; height: number }) => e.y + e.height / 2
const centerX = (e: { x: number; width: number }) => e.x + e.width / 2

describe('C4 SVG layout', () => {
  it('places Rel_D targets below and Rel_U targets above their source', () => {
    const p = layout(`C4Context
  System(a, "A")
  System(b, "B")
  System(c, "C")
  Rel_D(a, b, "down")
  Rel_U(a, c, "up")`)
    expect(centerY(el(p, 'b'))).toBeGreaterThan(centerY(el(p, 'a')))
    expect(centerY(el(p, 'c'))).toBeLessThan(centerY(el(p, 'a')))
  })

  it('puts Rel_R / Rel_L pairs side by side in the same row, in hint order', () => {
    const right = layout(`C4Context
  Person(p, "P")
  System(a, "A")
  System(b, "B")
  Rel(p, a, "x")
  Rel_R(a, b, "right")`)
    expect(centerY(el(right, 'a'))).toBeCloseTo(centerY(el(right, 'b')), 0)
    expect(centerX(el(right, 'a'))).toBeLessThan(centerX(el(right, 'b')))

    const left = layout(`C4Context
  Person(p, "P")
  System(a, "A")
  System(b, "B")
  Rel(p, a, "x")
  Rel_L(a, b, "left")`)
    expect(centerY(el(left, 'a'))).toBeCloseTo(centerY(el(left, 'b')), 0)
    expect(centerX(el(left, 'b'))).toBeLessThan(centerX(el(left, 'a')))
  })

  it('leaves room for a side-by-side hint label between the two boxes', () => {
    const p = layout(`C4Context
  System(a, "A")
  System(b, "B")
  Rel_R(a, b, "a fairly long relationship label")`)
    const a = el(p, 'a')
    const b = el(p, 'b')
    expect(b.x - (a.x + a.width)).toBeGreaterThan(150)
    const [start, end] = p.relationships[0]!.points
    expect(start!.x).toBeCloseTo(a.x + a.width, 0)
    expect(end!.x).toBeCloseTo(b.x, 0)
  })

  it('swaps the meaning of the axes when laid out left to right', () => {
    const p = layout(
      `C4Context
  System(a, "A")
  System(b, "B")
  Rel_R(a, b, "r")`,
      'LR',
    )
    // Along the flow axis: a hint is a layering constraint, so no manual route.
    expect(centerX(el(p, 'b'))).toBeGreaterThan(centerX(el(p, 'a')))
  })

  it('keeps nested elements inside their boundaries', () => {
    const p = layout(`C4Container
  Boundary(outer, "Outer", "System") {
    Boundary(inner, "Inner") {
      Container(a, "A", "Go")
    }
    Container(b, "B", "Go")
  }
  Rel(a, b, "x")`)
    const outer = p.boundaries.find((b) => b.alias === 'outer')!
    const inner = p.boundaries.find((b) => b.alias === 'inner')!
    expect(outer.depth).toBe(0)
    expect(inner.depth).toBe(1)
    // Outer boundaries are listed first so inner ones paint on top.
    expect(p.boundaries.indexOf(outer)).toBeLessThan(
      p.boundaries.indexOf(inner),
    )
    const inside = (
      o: { x: number; y: number; width: number; height: number },
      i: { x: number; y: number; width: number; height: number },
    ) =>
      i.x >= o.x &&
      i.y >= o.y &&
      i.x + i.width <= o.x + o.width &&
      i.y + i.height <= o.y + o.height
    expect(inside(outer, inner)).toBe(true)
    expect(inside(inner, el(p, 'a'))).toBe(true)
    expect(inside(outer, el(p, 'b'))).toBe(true)
    expect(inside(inner, el(p, 'b'))).toBe(false)
  })

  it('routes a relationship that ends on a populated boundary', () => {
    const p = layout(`C4Context
  System(o, "O")
  Boundary(b, "B") {
    System(s, "S")
  }
  Rel(o, b, "into the boundary")`)
    const rel = p.relationships[0]!
    const b = p.boundaries[0]!
    const end = rel.points[rel.points.length - 1]!
    expect(rel.points.length).toBeGreaterThanOrEqual(2)
    expect(end.y).toBeCloseTo(b.y, 0)
  })

  it('shifts everything below a title', () => {
    const plain = layout('C4Context\nSystem(a, "A")')
    const titled = layout('C4Context\ntitle T\nSystem(a, "A")')
    expect(el(titled, 'a').y).toBeGreaterThan(el(plain, 'a').y)
    expect(titled.titlePosition).toBeDefined()
    expect(titled.height).toBeGreaterThan(plain.height)
  })

  it('places every relationship label inside the canvas', () => {
    const p = layout(`C4Context
  System(a, "A")
  System(b, "B")
  Rel(a, b, "label", "tech")`)
    const rel = p.relationships[0]!
    expect(rel.labelPosition).toBeDefined()
    expect(rel.labelPosition!.x).toBeLessThanOrEqual(p.width)
    expect(rel.labelPosition!.y).toBeLessThanOrEqual(p.height)
  })
})

describe('routeManualEdge', () => {
  const box = (x: number, y: number) => ({ x, y, width: 100, height: 50 })
  it('runs straight between side-by-side boxes', () => {
    expect(routeManualEdge(box(0, 0), box(200, 10))).toEqual([
      { x: 100, y: 30 },
      { x: 200, y: 30 },
    ])
    expect(routeManualEdge(box(200, 10), box(0, 0))).toEqual([
      { x: 200, y: 30 },
      { x: 100, y: 30 },
    ])
  })
  it('runs straight between stacked boxes', () => {
    expect(routeManualEdge(box(0, 0), box(10, 200))).toEqual([
      { x: 55, y: 50 },
      { x: 55, y: 200 },
    ])
    expect(routeManualEdge(box(10, 200), box(0, 0))).toEqual([
      { x: 55, y: 200 },
      { x: 55, y: 50 },
    ])
  })
  it('bends between diagonal boxes', () => {
    const wide = routeManualEdge(box(0, 0), box(400, 100))
    expect(wide).toHaveLength(4)
    expect(wide[0]!.x).toBe(100)
    expect(wide[3]!.x).toBe(400)
    const tall = routeManualEdge(box(0, 0), box(150, 400))
    expect(tall).toHaveLength(4)
    expect(tall[0]!.y).toBe(50)
    expect(tall[3]!.y).toBe(400)
    // Mirrored: target up-left of source.
    expect(routeManualEdge(box(400, 100), box(0, 0))[0]!.x).toBe(400)
    expect(routeManualEdge(box(150, 400), box(0, 0))[0]!.y).toBe(400)
  })
})

describe('C4 SVG rendering', () => {
  const SRC = `C4Container
  title Shop
  Person(u, "User")
  Person_Ext(x, "Partner")
  System_Boundary(sys, "Shop") {
    Container(web, "Web App", "React", "Storefront")
    ContainerDb(db, "Database", "PostgreSQL")
    ContainerQueue(q, "Events", "Kafka")
    Component(c, "Comp", "TS")
  }
  Rel(u, web, "Browses", "HTTPS")
  BiRel(web, q, "Publishes")
  Rel(web, db, "Reads")`

  it('draws a person glyph (head + shoulders) only for persons', () => {
    const svg = renderMermaidSVG(SRC)
    expect(svg.match(/class="c4-person-glyph"/g)).toHaveLength(2)
    expect(svg).toContain('<circle')
    expect(renderMermaidSVG('C4Context\nSystem(s, "S")')).not.toContain(
      'c4-person-glyph',
    )
  })

  it('draws cylinders for databases and pipes for queues', () => {
    const svg = renderMermaidSVG(SRC)
    expect(svg.match(/<ellipse/g)).toHaveLength(2) // one cap each: db, queue
    expect(svg).toContain('data-shape="db"')
    expect(svg).toContain('data-shape="queue"')
  })

  it('uses the C4 palette by kind, lighter for external elements', () => {
    const svg = renderMermaidSVG(SRC)
    expect(svg).toContain('#08427b') // person
    expect(svg).toContain('#686868') // external person
    expect(svg).toContain('#438dd5') // container
    expect(svg).toContain('#85bbf0') // component
  })

  it('draws the diagram title, boundary title and technology text', () => {
    const svg = renderMermaidSVG(SRC)
    expect(svg).toContain('class="c4-title"')
    expect(svg).toContain('>Shop</text>')
    expect(svg).toContain('[HTTPS]')
    expect(svg).toContain('[Container: React]')
    expect(svg).toContain('[External Person]')
  })

  it('puts arrowheads at both ends of a BiRel and one end otherwise', () => {
    const svg = renderMermaidSVG(
      'C4Context\nSystem(a, "A")\nSystem(b, "B")\nRel(a, b, "one")',
    )
    const bi = renderMermaidSVG(
      'C4Context\nSystem(a, "A")\nSystem(b, "B")\nBiRel(a, b, "two")',
    )
    expect(svg.match(/<polygon/g)).toHaveLength(1)
    expect(bi.match(/<polygon/g)).toHaveLength(2)
  })

  it('escapes user text', () => {
    const svg = renderMermaidSVG(
      'C4Context\nSystem(a, "A <b> & \\"q\\"")\nSystem(b, "B")\nRel(a, b, "x<y")',
    )
    expect(svg).not.toContain('A <b>')
    expect(svg).toContain('x&lt;y')
  })

  it('uses the diagram title as the accessible name when no title option is set', () => {
    expect(renderMermaidSVG(SRC)).toContain('<title')
    expect(renderMermaidSVG(SRC, { title: 'Mine' })).toContain('>Mine</title>')
  })

  it('renders empty and boundary-only diagrams', () => {
    expect(renderMermaidSVG('C4Context')).toContain('<svg')
    const svg = renderMermaidSVG('C4Context\nBoundary(b, "Empty", "Type")')
    expect(svg).toContain('class="c4-boundary"')
  })

  it('is deterministic', () => {
    // The accessible-name id counter advances per render; everything else is fixed.
    const strip = (svg: string) => svg.replace(/zm-title-\d+/g, 'zm-title')
    expect(strip(renderMermaidSVG(SRC))).toBe(strip(renderMermaidSVG(SRC)))
  })
})
