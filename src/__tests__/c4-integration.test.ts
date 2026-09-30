import { describe, it, expect } from 'vitest'
import { renderMermaidSVG, renderMermaidASCII } from '../index.ts'

// End-to-end coverage for C4 diagrams through both front doors (the
// dedicated C4 renderers, not the flowchart pipeline). The fixtures ported
// from lukilabs/beautiful-mermaid#71 live in c4-upstream-integration.test.ts.

const CONTEXT = `C4Context
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
  Rel(banking, mail, "Sends e-mail using")`

const CONTAINER = `C4Container
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
  Rel(api, pay, "Charges cards")`

const COMPONENT = `C4Component
  Container_Boundary(api, "API") {
    Component(ctl, "Controller", "Express", "Routes")
    Component(svc, "Service", "TypeScript", "Rules")
  }
  ContainerDb(db, "Database", "Postgres")
  Rel(ctl, svc, "Uses")
  Rel(svc, db, "Reads")`

describe('C4 SVG rendering', () => {
  for (const [name, src] of [
    ['context', CONTEXT],
    ['container', CONTAINER],
    ['component', COMPONENT],
  ] as const) {
    it(`renders a ${name} diagram`, () => {
      const svg = renderMermaidSVG(src)
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg).toContain('</svg>')
    })
  }

  it('draws element names, type lines and boundary labels', () => {
    const svg = renderMermaidSVG(CONTAINER)
    for (const text of [
      'Web App',
      '[Container: React]',
      '[Container: PostgreSQL]',
      '[Software System]',
      'Shop',
      'Calls',
      '[JSON/HTTPS]',
    ]) {
      expect(svg).toContain(text)
    }
  })

  it('applies the C4 palette to people and external systems', () => {
    const svg = renderMermaidSVG(CONTEXT)
    expect(svg).toContain('#08427b') // person
    expect(svg).toContain('#1168bd') // internal system
    expect(svg).toContain('#999999') // external system
  })

  it('draws a cylinder for Db variants', () => {
    const db = renderMermaidSVG(
      'C4Context\nSystemDb(d, "DB")\nSystem(s, "S")\nRel(s, d, "x")',
    )
    const plain = renderMermaidSVG(
      'C4Context\nSystem(d, "DB")\nSystem(s, "S")\nRel(s, d, "x")',
    )
    // Only the cylinder has elliptical caps.
    expect(db).toContain('<ellipse')
    expect(plain).not.toContain('<ellipse')
  })

  it('honors the direction option', () => {
    const tb = renderMermaidSVG(COMPONENT)
    const lr = renderMermaidSVG(COMPONENT, { direction: 'LR' })
    const size = (s: string) =>
      s
        .match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!
        .slice(1)
        .map(Number) as [number, number]
    const [tbW, tbH] = size(tb)
    const [lrW, lrH] = size(lr)
    expect(lrW / lrH).toBeGreaterThan(tbW / tbH)
  })

  it('surfaces parse errors with a line number', () => {
    expect(() =>
      renderMermaidSVG('C4Context\nSystem(a, "A")\nSystem(a, "B")'),
    ).toThrow(/line 3: duplicate alias/)
  })
})

describe('C4 ASCII rendering', () => {
  for (const [name, src] of [
    ['context', CONTEXT],
    ['container', CONTAINER],
    ['component', COMPONENT],
  ] as const) {
    it(`renders a ${name} diagram`, () => {
      const out = renderMermaidASCII(src)
      expect(out.length).toBeGreaterThan(0)
      expect(out).toMatch(/[┌+]/)
    })
  }

  it('shows element names, type lines and boundary titles', () => {
    const out = renderMermaidASCII(CONTAINER)
    for (const text of ['Web App', '[Container: React]', 'Shop', 'Calls']) {
      expect(out).toContain(text)
    }
  })

  it('is deterministic', () => {
    expect(renderMermaidASCII(COMPONENT)).toBe(renderMermaidASCII(COMPONENT))
  })

  it('surfaces parse errors with a line number', () => {
    expect(() => renderMermaidASCII('C4Context\nBogus(a, "A")')).toThrow(
      /line 2: unknown C4 macro "Bogus"/,
    )
  })
})

describe('Rel_Back arrow direction', () => {
  const src = `C4Context
  System(a, "A")
  System(b, "B")
  Rel_Back(a, b, "Returns")`

  it('puts the SVG arrowhead at the declared "from" end', () => {
    const svg = renderMermaidSVG(src)
    const line = /<polyline class="c4-relationship"[^>]*points="([^"]+)"/.exec(
      svg,
    )![1]!
    const [sx, sy] = line.split(' ')[0]!.split(',').map(Number) as [
      number,
      number,
    ]
    const tip = /<polygon points="([\d.]+),([\d.]+) /.exec(svg)!
    expect(Math.hypot(Number(tip[1]) - sx, Number(tip[2]) - sy)).toBeLessThan(1)
  })

  it('draws exactly one ASCII arrowhead, pointing up at "from"', () => {
    const out = renderMermaidASCII(src)
    expect(out).toContain('▲')
    expect(out).not.toContain('▼')
  })
})
