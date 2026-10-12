import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import {
  c4BoundaryTypeLine,
  parseC4Diagram,
} from '@zombie-mermaid/mermaid-parser'
import type { PositionedC4Diagram } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../../../../src/index.ts'
import { layoutC4DiagramSync } from '../c4/layout.ts'
import { personPath } from '../c4/renderer.ts'
import {
  C4,
  c4PersonGeometry,
  c4PositionedLabelLines,
  c4RelLabelBoxes,
  c4TextWidth,
} from '../c4/metrics.ts'

// A relationship label must not sit on a shape, on a boundary's dashed frame
// or heading, or on another label (#1908); the person glyph is one outline.
const layout = (src: string): PositionedC4Diagram =>
  layoutC4DiagramSync(parseC4Diagram(splitStatements(src)))

const SOURCES: Record<string, string> = {
  context: `C4Context
  title System Context for Internet Banking
  Person(customer, "Personal Banking Customer", "A customer of the bank")
  Enterprise_Boundary(b0, "Bank") {
    System(banking, "Internet Banking System", "Lets customers view accounts")
    SystemDb(ledger, "Ledger", "Stores transactions")
  }
  System_Ext(mail, "E-mail System", "Sends e-mails")
  Rel(customer, banking, "Uses", "HTTPS")
  Rel(banking, ledger, "Reads from and writes to")
  Rel_Back(customer, mail, "Sends e-mails to")
  Rel(banking, mail, "Sends e-mail using")`,
  container: `C4Container
  Person(user, "User")
  System_Boundary(sys, "Shop") {
    Container(web, "Web App", "React", "Storefront")
    Container(api, "API", "Node.js", "Business logic")
    ContainerDb(db, "Database", "PostgreSQL", "Orders")
    ContainerQueue(q, "Events", "Kafka")
  }
  System_Ext(pay, "Payments")
  Rel(user, web, "Browses")
  Rel(web, api, "Calls", "JSON/HTTPS")
  Rel(api, db, "Reads/writes", "SQL")
  BiRel(api, q, "Publishes", "AMQP")
  Rel(api, pay, "Charges cards")`,
  component: `C4Component
  Container_Boundary(api, "API Application") {
    Boundary(web, "Web Layer") {
      Component(ctl, "Controller", "Express", "Routes requests")
    }
    Component(svc, "Service", "TypeScript", "Business rules")
  }
  ContainerDb(db, "Database", "Postgres")
  Rel(ctl, svc, "Uses")
  BiRel(svc, db, "Reads and writes", "SQL")`,
  dynamic: `C4Dynamic
  Person(u, "User")
  System(a, "App")
  System(b, "Backend")
  Rel(u, a, "Clicks")
  Rel(a, b, "Requests")
  Rel_Back(b, a, "Responds")
  BiRel(u, b, "Streams")`,
  deployment: `C4Deployment
  Deployment_Node(dc, "DC", "Ubuntu") {
    Deployment_Node(k, "K8s", "Kubernetes") {
      Container(app, "App", "Java")
    }
  }
  Deployment_Node(empty, "Empty", "x")
  ContainerDb(db, "DB", "Pg")
  Rel(app, db, "reads")
  Rel(db, empty, "to empty")`,
}

interface Box {
  what: string
  x0: number
  x1: number
  y0: number
  y1: number
}

/** Everything a label must keep off: shapes, frame lines, headings. */
function fixtures(d: PositionedC4Diagram): Box[] {
  const out: Box[] = d.elements.map((e) => ({
    what: `shape ${e.alias}`,
    x0: e.x,
    x1: e.x + e.width,
    y0: e.y,
    y1: e.y + e.height,
  }))
  for (const b of d.boundaries) {
    const line = (
      side: string,
      x0: number,
      x1: number,
      y0: number,
      y1: number,
    ) => out.push({ what: `frame ${b.alias} ${side}`, x0, x1, y0, y1 })
    line('top', b.x, b.x + b.width, b.y, b.y)
    line('bottom', b.x, b.x + b.width, b.y + b.height, b.y + b.height)
    line('left', b.x, b.x, b.y, b.y + b.height)
    line('right', b.x + b.width, b.x + b.width, b.y, b.y + b.height)
    const text = (what: string, label: string, y: number, size: number) => {
      const w = c4TextWidth(label, size, 400)
      const cx = b.x + b.width / 2
      out.push({
        what: `heading ${b.alias} ${what}`,
        x0: cx - w / 2,
        x1: cx + w / 2,
        y0: b.y + y - size / 2,
        y1: b.y + y + size / 2,
      })
    }
    text('title', b.label, b.labelY ?? 8, C4.boundarySize + 2)
    const type = c4BoundaryTypeLine({
      ...b,
      elementAliases: [],
      children: [],
    })
    if (type && b.typeY !== undefined) {
      text('type', type, b.typeY, C4.boundarySize)
    }
  }
  return out
}

function labelBoxes(d: PositionedC4Diagram) {
  return d.relationships.flatMap((r) =>
    c4RelLabelBoxes(r).map((b) => ({
      rel: `${r.from}->${r.to}`,
      x0: b.cx - b.w / 2,
      x1: b.cx + b.w / 2,
      y0: b.cy - b.h / 2,
      y1: b.cy + b.h / 2,
    })),
  )
}

const hit = (a: Omit<Box, 'what'>, b: Omit<Box, 'what'>) =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

describe('C4 relationship labels keep clear of shapes, frames and each other (#1908)', () => {
  for (const [name, src] of Object.entries(SOURCES)) {
    it(`${name}: no label lands on a shape, frame line or heading`, () => {
      const d = layout(src)
      const things = fixtures(d)
      const hits = labelBoxes(d).flatMap((l) =>
        things.filter((t) => hit(l, t)).map((t) => `${l.rel} on ${t.what}`),
      )
      expect(hits).toEqual([])
    })

    it(`${name}: no two labels overlap`, () => {
      const boxes = labelBoxes(layout(src))
      for (const [i, a] of boxes.entries()) {
        for (const b of boxes.slice(i + 1)) {
          if (a.rel === b.rel) continue
          expect(hit(a, b), `${a.rel} vs ${b.rel}`).toBe(false)
        }
      }
    })
  }

  it('wraps a label too wide for the gap between two shapes', () => {
    const d = layout(SOURCES.context!)
    const rel = d.relationships.find((r) => r.to === 'ledger')!
    expect(rel.labelLines).toEqual(['Reads from', 'and writes to'])
    expect(c4PositionedLabelLines(rel)).toEqual(rel.labelLines)
  })

  it('leaves a label that already fits unwrapped', () => {
    const d = layout(`C4Context
  System(a, "A")
  System(b, "B")
  Rel(a, b, "Uses")`)
    expect(d.relationships[0]!.labelLines).toBeUndefined()
  })

  it('sets every label on a background plate, drawn after all the lines', () => {
    const svg = renderMermaidSVG(SOURCES.context!)
    expect(svg.match(/class="c4-label-plate"/g)).toHaveLength(4)
    expect(svg.lastIndexOf('class="c4-relationship"')).toBeLessThan(
      svg.indexOf('class="c4-label-plate"'),
    )
  })
})

describe('C4 person glyph (#1908)', () => {
  const person = () => {
    const d = layout('C4Context\nPerson(p, "Pat", "A customer")')
    return d.elements[0]!
  }
  const numbers = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number)

  it('is one outline, with no circle cutting across the body', () => {
    const svg = renderMermaidSVG('C4Context\nPerson(p, "Pat", "A customer")')
    expect(svg).not.toContain('<circle')
    expect(svg.match(/class="c4-person-shape"/g)).toHaveLength(1)
  })

  it('runs the head arc from one end of the pill top to the other', () => {
    const el = person()
    const g = c4PersonGeometry(el.width, el.height)
    const top = el.y + g.pillTop
    const cx = el.x + el.width / 2
    const d = personPath(el)
    // M x y H x1 A r r 0 1 1 x2 y ...
    const arc =
      /H ([\d.-]+) A ([\d.-]+) ([\d.-]+) 0 1 1 ([\d.-]+) ([\d.-]+)/.exec(d)!
    const [x1, rx, ry, x2, y2] = arc.slice(1).map(Number) as number[]
    expect(rx).toBeCloseTo(g.headRadius, 1)
    expect(ry).toBeCloseTo(g.headRadius, 1)
    expect(y2).toBeCloseTo(top, 1)
    // Both ends lie on the head's circle and on the pill's top edge.
    const onCircle = (x: number) =>
      Math.hypot(x - cx, top - (el.y + g.headRadius))
    expect(onCircle(x1!)).toBeCloseTo(g.headRadius, 1)
    expect(onCircle(x2!)).toBeCloseTo(g.headRadius, 1)
    expect(x1!).toBeLessThan(cx)
    expect(x2!).toBeGreaterThan(cx)
  })

  it('stays inside the element box, head at the top and pill at the bottom', () => {
    const el = person()
    const g = c4PersonGeometry(el.width, el.height)
    const xs = numbers(personPath(el))
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
    expect(el.y + g.headRadius * 2 - el.y).toBeLessThanOrEqual(el.height)
    // The pill's top is below the head's top: the head rises out of it.
    expect(g.pillTop).toBeGreaterThan(g.headRadius)
    expect(g.pillTop).toBeLessThan(2 * g.headRadius)
  })
})
