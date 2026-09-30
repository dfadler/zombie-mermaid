import { describe, it, expect } from 'vitest'
import { renderMermaidSVG, renderMermaidASCII } from '../index.ts'

// End-to-end coverage for ArchiMate diagrams through both front doors,
// written for this fork's flowchart-lowering design. The fixtures ported from
// lukilabs/beautiful-mermaid#71 live in archimate-upstream-integration.test.ts.

// Relationships deliberately point "upward" (lower layer serves higher one),
// the way real ArchiMate views draw them.
const STACK = `archimate-layered
  business:
    actor Customer
    service "Online Banking" as OB
  application:
    component "Web App" as WA
  technology:
    node "App Server" as AS
  Customer -->|serving| OB
  WA -->|realization| OB
  AS -->|serving| WA`

/** First `y` of the `<text>` whose content starts with `label`. */
function textY(svg: string, label: string): number {
  const m = svg.match(
    new RegExp(`<text[^>]*\\by="([\\d.]+)"[^>]*>(?:<tspan[^>]*>)?${label}`),
  )
  if (!m) throw new Error(`no <text> for "${label}"`)
  return Number(m[1])
}

describe('ArchiMate SVG rendering', () => {
  const svg = renderMermaidSVG(STACK)

  it('draws the layers top to bottom even when relationships point upward', () => {
    const y = ['Business', 'Application', 'Technology'].map((l) =>
      textY(svg, l),
    )
    expect(y[0]).toBeLessThan(y[1]!)
    expect(y[1]).toBeLessThan(y[2]!)
  })

  it('orders unconnected layers canonically, whatever order they are written in', () => {
    const out = renderMermaidSVG(
      'archimate-layered\ntechnology:\n  node N\nbusiness:\n  actor A\nphysical:\n  equipment E',
    )
    const y = ['Business', 'Technology', 'Physical'].map((l) => textY(out, l))
    expect(y[0]).toBeLessThan(y[1]!)
    expect(y[1]).toBeLessThan(y[2]!)
  })

  it('puts the arrowhead on the relationship target, not the layout target', () => {
    // AS serves WA: the drawn edge runs WA -> AS in layout terms, so the
    // marker must be at its start.
    expect(svg).toMatch(/marker-start/)
  })

  it('tints each layer with the ArchiMate convention colours', () => {
    expect(svg).toContain('#ffffb5')
    expect(svg).toContain('#b5ffff')
    expect(svg).toContain('#c9e7b7')
  })

  it('escapes markup in labels', () => {
    const out = renderMermaidSVG(
      'archimate-layered\nbusiness:\n  actor "<b>&</b>" as A',
    )
    expect(out).not.toContain('<b>')
  })

  it('applies theme options', () => {
    expect(renderMermaidSVG(STACK, { bg: '#101010', fg: '#eeeeee' })).toContain(
      '#101010',
    )
  })

  it('names the parse error line for a bad relationship type', () => {
    expect(() =>
      renderMermaidSVG(
        'archimate-layered\nbusiness:\n  actor A\nA -->|serves| A',
      ),
    ).toThrow(/line 4: unknown relationship type "serves"/)
  })

  it('handles an empty diagram', () => {
    expect(renderMermaidSVG('archimate-layered')).toContain('<svg')
  })
})

describe('ArchiMate ASCII rendering', () => {
  const ascii = renderMermaidASCII(STACK)

  it('shows every element, stereotype and relationship name', () => {
    for (const text of [
      'Customer',
      'Online Banking',
      'Web App',
      'App Server',
      '«Actor»',
      '«Business Service»',
      '«Component»',
      '«Node»',
      'serving',
      'realization',
    ]) {
      expect(ascii).toContain(text)
    }
  })

  it('lists the layers top to bottom', () => {
    const at = (s: string) => ascii.indexOf(s)
    expect(at('Online Banking')).toBeLessThan(at('Web App'))
    expect(at('Web App')).toBeLessThan(at('App Server'))
  })

  it('renders the multi-layer diagram without throwing', () => {
    const full = `archimate-layered
  strategy:
    capability Payments
  motivation:
    goal Growth
  business:
    actor Customer
  physical:
    facility DC
  implementation:
    workPackage Migrate
  Growth -->|influence| Payments
  DC -->|serving| Customer`
    expect(renderMermaidASCII(full)).toContain('«Work Package»')
  })

  it('throws a line-numbered parse error', () => {
    expect(() =>
      renderMermaidASCII('archimate-layered\nwizard Gandalf'),
    ).toThrow(/line 2/)
  })
})
