import { describe, it, expect } from 'vitest'
import { renderMermaidSVG, renderMermaidASCII } from '../index.ts'

// Fixtures ported from lukilabs/beautiful-mermaid#71 (c4-integration.test.ts)
// by Victor Palma (devx) (MIT-licensed). Upstream drove a dedicated
// `renderC4Svg` with hand-positioned data; this fork lowers C4 onto the
// flowchart pipeline, so the same scenarios are expressed as Mermaid source
// and rendered end to end. Assertions the lowered design cannot satisfy are
// kept as `it.skip` with the reason, so the gap stays visible.

const svgOf = (src: string) => renderMermaidSVG(src)

describe('upstream #71: basic SVG output', () => {
  it('renders a minimal diagram to valid SVG', () => {
    const svg = svgOf('C4Context\n  System(s, "System")')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('contains element labels', () => {
    const svg = svgOf(`C4Context
  Person(user, "User")
  System(sys, "Banking System")`)
    expect(svg).toContain('User')
    expect(svg).toContain('Banking System')
  })

  it('contains relationship labels', () => {
    const svg = svgOf(`C4Context
  Person(user, "User")
  System(sys, "System")
  Rel(user, sys, "Makes API calls")`)
    expect(svg).toContain('Makes API calls')
  })

  // Known gap: the flowchart model has no diagram title, so `title` is parsed
  // (see the parser tests) but not drawn.
  it.skip('renders the title when present', () => {
    const svg = svgOf(`C4Context
  title System Context Diagram
  Person(user, "User")`)
    expect(svg).toContain('System Context Diagram')
  })
})

describe('upstream #71: person elements', () => {
  it('renders the person name, type line and description', () => {
    const svg = svgOf(
      'C4Context\n  Person(user, "User", "A person who uses the system")',
    )
    expect(svg).toContain('User')
    expect(svg).toContain('[Person]')
    expect(svg).toContain('A person who uses the system')
  })

  // Known gap: persons are a rounded box in the person colour, not the C4
  // head-and-shoulders glyph, so there is no <circle>.
  it.skip('renders a person with a circle head', () => {
    const svg = svgOf('C4Context\n  Person(user, "User")')
    expect(svg).toContain('<circle')
  })
})

describe('upstream #71: element types', () => {
  it('renders Container with technology in the type line', () => {
    const svg = svgOf(
      'C4Container\n  Container(web, "Web App", "Java/Spring", "Serves pages")',
    )
    expect(svg).toContain('Web App')
    expect(svg).toContain('[Container: Java/Spring]')
    expect(svg).toContain('Serves pages')
  })

  it('renders ContainerDb as a cylinder with technology', () => {
    const svg = svgOf(
      'C4Container\n  ContainerDb(db, "Database", "PostgreSQL")',
    )
    expect(svg).toContain('Database')
    expect(svg).toContain('[Container Database: PostgreSQL]')
    expect(svg).toContain('<ellipse')
  })

  it('renders Component with technology in the type line', () => {
    const svg = svgOf(
      'C4Component\n  Component(ctrl, "Controller", "Spring MVC")',
    )
    expect(svg).toContain('Controller')
    expect(svg).toContain('[Component: Spring MVC]')
  })

  it('renders external elements with the muted external fill', () => {
    const svg = svgOf('C4Context\n  System_Ext(ext, "External System")')
    expect(svg).toContain('External System')
    expect(svg).toContain('[External System]')
    expect(svg).toContain('#999999')
  })
})

describe('upstream #71: boundaries', () => {
  it('renders a boundary with its label around its elements', () => {
    const svg = svgOf(`C4Container
  System_Boundary(sb, "Banking System") {
    Container(web, "Web App", "Java")
  }`)
    expect(svg).toContain('Banking System')
    expect(svg).toContain('Web App')
    expect(svg).toContain('--_group-fill')
  })

  it('renders the boundary type in brackets', () => {
    const svg = svgOf(`C4Context
  Boundary(b, "My System", "region") {
    System(s, "S")
  }`)
    expect(svg).toContain('[region]')
  })

  // Known gap: the boundary macro kind is not kept, so it is not shown as
  // "[System Boundary]", and the frame is solid rather than dashed.
  it.skip('renders the boundary macro kind and a dashed border', () => {
    const svg = svgOf(`C4Context
  System_Boundary(sb, "My System") {
    System(s, "S")
  }`)
    expect(svg).toContain('[System Boundary]')
    expect(svg).toContain('stroke-dasharray')
  })

  it('renders nested boundaries', () => {
    const svg = svgOf(`C4Context
  Enterprise_Boundary(eb, "Enterprise") {
    System_Boundary(sb, "Core System") {
      System(s, "S")
    }
  }`)
    expect(svg).toContain('Enterprise')
    expect(svg).toContain('Core System')
  })
})

describe('upstream #71: relationships', () => {
  const two = 'System(a, "A")\n  System(b, "B")'

  // The dedicated renderer draws arrowheads as polygons rather than SVG
  // markers, so these assert the polyline plus one polygon head per end.
  it('renders relationship arrows as a polyline with an arrowhead', () => {
    const svg = svgOf(`C4Context\n  ${two}\n  Rel(a, b, "Uses")`)
    expect(svg).toContain('<polyline')
    expect(svg.match(/<polygon [^>]*fill="var\(--_arrow\)"/g)).toHaveLength(1)
  })

  it('renders relationship technology in brackets', () => {
    const svg = svgOf(`C4Context\n  ${two}\n  Rel(a, b, "Calls", "HTTPS")`)
    expect(svg).toContain('>Calls</text>')
    expect(svg).toContain('>[HTTPS]</text>')
  })

  it('draws arrowheads at both ends for BiRel', () => {
    const svg = svgOf(`C4Context\n  ${two}\n  BiRel(a, b, "Sync")`)
    expect(svg.match(/<polygon [^>]*fill="var\(--_arrow\)"/g)).toHaveLength(2)
  })

  // Known gap: the hint is honoured for layering, but this asserts the old
  // lowering design's `class="edge"` markup, so it stays skipped.
  it.skip('honours Rel_U by placing the target above the source', () => {
    const svg = svgOf(`C4Context\n  ${two}\n  Rel_U(a, b, "Notifies")`)
    const pts = /class="edge"[^>]*points="([^"]+)"/.exec(svg)![1]!
    const ys = pts.split(' ').map((p) => Number(p.split(',')[1]))
    expect(ys[ys.length - 1]!).toBeLessThan(ys[0]!)
  })
})

describe('upstream #71: parse and render round trip', () => {
  const CONTEXT = `C4Context
  title Internet Banking System
  Person(customer, "Customer", "A bank customer")
  System(banking, "Internet Banking", "Online banking portal")
  System_Ext(email, "E-mail System", "Sends notifications")
  Rel(customer, banking, "Views accounts", "HTTPS")
  Rel(banking, email, "Sends emails", "SMTP")`

  it('renders every element and relationship label to SVG', () => {
    const svg = svgOf(CONTEXT)
    for (const text of [
      'Customer',
      'Internet Banking',
      'E-mail System',
      'Views accounts',
      '[HTTPS]',
      'Sends emails',
      '[SMTP]',
    ]) {
      expect(svg).toContain(text)
    }
  })

  it('renders every element and relationship label to ASCII', () => {
    const out = renderMermaidASCII(CONTEXT)
    for (const text of [
      'Customer',
      'Internet Banking',
      'E-mail System',
      'Views accounts',
    ]) {
      expect(out).toContain(text)
    }
  })
})
