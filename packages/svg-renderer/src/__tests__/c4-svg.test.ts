import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseC4Diagram } from '@zombie-mermaid/mermaid-parser'
import type { PositionedC4Diagram } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../../../../src/index.ts'
import { layoutC4DiagramSync } from '../c4/layout.ts'

function layout(src: string, direction?: 'LR'): PositionedC4Diagram {
  const d = parseC4Diagram(splitStatements(src))
  return layoutC4DiagramSync(direction ? { ...d, direction } : d)
}

const el = (p: PositionedC4Diagram, alias: string) =>
  p.elements.find((e) => e.alias === alias)!
const centerX = (e: { x: number; width: number }) => e.x + e.width / 2

// The layout follows Mermaid's own C4 renderer: shapes go in rows in
// declaration order, relationships are drawn afterwards and move nothing.
describe('C4 SVG layout (Mermaid grid)', () => {
  const SYSTEMS = (n: number) =>
    `C4Context\n${Array.from({ length: n }, (_, i) => `  System(s${i}, "S${i}")`).join('\n')}`

  it('fills a row left to right in declaration order, four to a row', () => {
    const p = layout(SYSTEMS(5))
    const xs = [0, 1, 2, 3, 4].map((i) => el(p, `s${i}`).x)
    // Columns are one shape plus two margins apart: 216 + 100.
    expect(xs[1]! - xs[0]!).toBeCloseTo(316, 0)
    expect(xs[2]! - xs[1]!).toBeCloseTo(316, 0)
    expect(xs[3]! - xs[2]!).toBeCloseTo(316, 0)
    const ys = [0, 1, 2, 3].map((i) => el(p, `s${i}`).y)
    expect(new Set(ys).size).toBe(1)
    // The fifth wraps to the next row, back under the first.
    expect(el(p, 's4').x).toBeCloseTo(xs[0]!, 0)
    expect(el(p, 's4').y).toBeGreaterThan(ys[0]! + 60)
  })

  it('ignores Rel_U/D/L/R hints and the direction, as Mermaid does', () => {
    const plain = `C4Context
  System(a, "A")
  System(b, "B")
  System(c, "C")
  Rel(a, b, "x")
  Rel(a, c, "y")`
    const hinted = plain
      .replace('Rel(a, b', 'Rel_D(a, b')
      .replace('Rel(a, c', 'Rel_U(a, c')
    const pos = (p: PositionedC4Diagram) =>
      p.elements.map((e) => [e.alias, e.x, e.y])
    expect(pos(layout(hinted))).toEqual(pos(layout(plain)))
    expect(pos(layout(plain, 'LR'))).toEqual(pos(layout(plain)))
  })

  it('widens a shape whose text is wider than the standard width', () => {
    const p = layout(`C4Context
  Person(a, "Personal Banking Customer", "A customer of the bank")
  System(b, "B")`)
    expect(el(p, 'a').width).toBeGreaterThan(216)
    expect(el(p, 'b').width).toBe(216)
    // The next shape moves right by the same amount.
    expect(el(p, 'b').x - (el(p, 'a').x + el(p, 'a').width)).toBeCloseTo(100, 0)
  })

  it('wraps a long name to the text width and grows the box by a line', () => {
    const one = layout('C4Context\nSystem(a, "Banking Banking Banking")')
    const two = layout(
      'C4Context\nSystem(a, "Banking Banking Banking Banking")',
    )
    expect(el(one, 'a').nameLines).toHaveLength(1)
    expect(el(two, 'a').nameLines).toHaveLength(2)
    expect(el(two, 'a').height - el(one, 'a').height).toBeCloseTo(15.35, 1)
  })

  it('gives shapes the heights Mermaid does', () => {
    const p = layout(`C4Container
  System(plain, "Plain")
  System(desc, "Described", "One line")
  ContainerDb(db, "DB", "PG", "Rows")
  ContainerQueue(q, "Q", "Kafka")`)
    expect(el(p, 'plain').height).toBeCloseTo(71.07, 0)
    expect(el(p, 'desc').height).toBeCloseTo(88.2, 0)
    expect(el(p, 'db').height).toBeCloseTo(115.8, 0)
    expect(el(p, 'q').height).toBeCloseTo(41.07, 0)
  })

  it('reproduces the size and frame of a real Mermaid render', () => {
    // The context sample, measured on Mermaid 11.17.2.
    const p = layout(`C4Context
  title System Context for Internet Banking
  Person(customer, "Personal Banking Customer", "A customer of the bank")
  Enterprise_Boundary(b0, "Bank") {
    System(banking, "Internet Banking System", "Lets customers view accounts")
    SystemDb(ledger, "Ledger", "Stores transactions")
  }
  System_Ext(mail, "E-mail System", "Sends e-mails")
  Rel(customer, banking, "Uses", "HTTPS")`)
    expect(p.width).toBeCloseTo(932, -1)
    expect(p.height).toBeCloseTo(888.4, -1)
    const frame = p.boundaries[0]!
    expect(frame.x).toBeCloseTo(150, 0)
    expect(frame.width).toBeCloseTo(632, 0)
    expect(frame.height).toBeCloseTo(265.8, 0)
    expect(centerX(el(p, 'banking'))).toBeCloseTo(308, 0)
    expect(centerX(el(p, 'ledger'))).toBeCloseTo(624, 0)
  })

  it('puts two boundaries on a row and keeps nested elements inside', () => {
    const p = layout(`C4Container
  Boundary(outer, "Outer", "System") {
    Boundary(inner, "Inner") {
      Container(a, "A", "Go")
    }
    Container(b, "B", "Go")
  }
  Boundary(other, "Other") {
    Container(c, "C", "Go")
  }
  Boundary(third, "Third") {
    Container(d, "D", "Go")
  }
  Rel(a, b, "x")`)
    const by = (alias: string) => p.boundaries.find((b) => b.alias === alias)!
    const outer = by('outer')
    const inner = by('inner')
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
    // Mermaid lays boundaries out two to a row: the third starts a new row.
    expect(by('other').y).toBeCloseTo(outer.y, 0)
    expect(by('other').x).toBeGreaterThan(outer.x + outer.width)
    expect(by('third').y).toBeGreaterThan(outer.y + outer.height)
  })

  it('draws the first relationship straight and later ones as curves', () => {
    const p = layout(`C4Context
  System(a, "A")
  System(b, "B")
  System(c, "C")
  Rel(a, b, "first")
  Rel(a, c, "second")
  Rel(b, c, "third")`)
    const [first, second, third] = p.relationships
    expect(first!.curve).toBeUndefined()
    const [s, e] = second!.points
    expect(second!.curve).toEqual({
      x: s!.x + (e!.x - s!.x) / 4,
      y: s!.y + (e!.y - s!.y) / 2,
    })
    expect(third!.curve).toBeDefined()
  })

  it('starts a relationship label at the middle of its chord', () => {
    const p = layout(`C4Context
  System(a, "A")
  System(b, "B")
  Rel(a, b, "label", "tech")`)
    const rel = p.relationships[0]!
    const [s, e] = rel.points
    const midX = (s!.x + e!.x) / 2
    // Mermaid gives its text routine the midpoint as the block's left edge, so
    // the label is centred half its own width to the right of it.
    expect(rel.labelPosition!.x).toBeGreaterThan(midX + 5)
    expect(rel.labelPosition!.x).toBeLessThan(midX + 40)
    expect(rel.labelPosition!.y).toBeCloseTo((s!.y + e!.y) / 2, 5)
    // The technology is centred on its own, at least as far along.
    expect(rel.technologyX!).toBeGreaterThanOrEqual(rel.labelPosition!.x)
  })

  it('leaves a person along the drawn head and pill, not the box around them', () => {
    const p = layout(`C4Context
  Person(u, "Customer", "Buys things")
  System(s, "Shop", "Online store")
  Rel(u, s, "Orders from")`)
    const u = el(p, 'u')
    const start = p.relationships[0]!.points[0]!
    const headCx = u.x + u.width / 2
    const headCy = u.y + 49.68
    // Mermaid's line leaves on the head circle (in its own drawing, at 295.7),
    // well inside the box's right edge rather than in the air beside the head.
    expect(start.x).toBeLessThan(u.x + u.width - 40)
    expect(Math.hypot(start.x - headCx, start.y - headCy)).toBeCloseTo(49.68, 0)
  })

  it('routes a relationship that ends on a populated boundary to its frame', () => {
    const p = layout(`C4Context
  System(o, "O")
  Boundary(b, "B") {
    System(s, "S")
  }
  Rel(o, b, "into the boundary")`)
    const rel = p.relationships[0]!
    const b = p.boundaries[0]!
    const end = rel.points[rel.points.length - 1]!
    const onFrame =
      Math.abs(end.x - b.x) < 1 ||
      Math.abs(end.x - (b.x + b.width)) < 1 ||
      Math.abs(end.y - b.y) < 1 ||
      Math.abs(end.y - (b.y + b.height)) < 1
    expect(onFrame).toBe(true)
  })

  it('shifts everything below a title, as Mermaid does', () => {
    const plain = layout('C4Context\nSystem(a, "A")')
    const titled = layout('C4Context\ntitle T\nSystem(a, "A")')
    expect(el(titled, 'a').y - el(plain, 'a').y).toBeCloseTo(60, 0)
    expect(titled.titlePosition).toBeDefined()
    expect(titled.height - plain.height).toBeCloseTo(60, 0)
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

  it('draws a person as a pill with a round head, only for persons', () => {
    const svg = renderMermaidSVG(SRC)
    // One circle per person (the user and the external partner).
    expect(svg.match(/<circle/g)).toHaveLength(2)
    expect(svg).not.toContain('c4-person-glyph')
    expect(renderMermaidSVG('C4Context\nSystem(s, "S")')).not.toContain(
      '<circle',
    )
  })

  it('draws cylinders for databases and pipes for queues', () => {
    const svg = renderMermaidSVG(SRC)
    expect(svg.match(/<ellipse/g)).toHaveLength(2) // one cap each: db, queue
    expect(svg).toContain('data-shape="db"')
    expect(svg).toContain('data-shape="queue"')
  })

  it("shows a queue's ellipse face at its right end, as Mermaid does", () => {
    const svg = renderMermaidSVG('C4Container\nContainerQueue(q, "Events")')
    expect(svg).toContain('data-shape="queue"')
    const ell = /<ellipse cx="([\d.-]+)" cy="[\d.-]+" rx="([\d.-]+)"/.exec(svg)!
    const path = /<path d="M ([\d.-]+) [\d.-]+ H ([\d.-]+) A/.exec(svg)!
    const cx = +ell[1]!
    const rx = +ell[2]!
    // The body starts at the face centre (right) and runs left to its
    // rounded end.
    expect(+path[1]!).toBeCloseTo(cx, 1)
    expect(+path[2]!).toBeLessThan(cx - rx)
  })

  it('uses Mermaid’s palette by kind, lighter for external elements', () => {
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
    expect(svg).toContain('[Person]')
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

  it('draws the first relationship as a line and the rest as quadratic curves', () => {
    const svg = renderMermaidSVG(`C4Context
  System(a, "A")
  System(b, "B")
  System(c, "C")
  Rel(a, b, "one")
  Rel(a, c, "two")`)
    const ds = [
      ...svg.matchAll(/<path class="c4-relationship"[^>]* d="([^"]+)"/g),
    ]
    expect(ds).toHaveLength(2)
    expect(ds[0]![1]).toMatch(/^M [\d.-]+,[\d.-]+ L /)
    expect(ds[1]![1]).toMatch(/^M [\d.-]+,[\d.-]+ Q /)
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
