import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

// Fixtures ported from lukilabs/beautiful-mermaid#71
// (src/__tests__/archimate-integration.test.ts and examples/archimate-*.svg)
// by Victor Palma (devx), MIT-licensed; the ArchiMate DSL and renderer they
// exercise come from #34 (kristjanakkermann). Upstream tested a bespoke
// dagre-based renderer with hand-positioned data; this fork lowers ArchiMate
// to the flowchart model (docs/decisions/archimate-lowering-1167.md), so the
// assertions are re-expressed against `renderMermaidSVG` output. Assertions
// that pin upstream's bespoke markup are kept as `it.skip` with the reason,
// so the gap stays visible.

const svgOf = (src: string): string => renderMermaidSVG(src)

const PAIR = (type: string) => `archimate-layered
  business:
    actor A
    actor B
  A -->|${type}| B`

/** The `<path>`/`<polyline>` elements drawn for the diagram's edges. */
function edgeElements(svg: string): string[] {
  return svg.match(/<(?:path|polyline)\b[^>]*class="edge"[^>]*>/g) ?? []
}

describe('upstream #71: basic SVG output', () => {
  it('renders a minimal diagram to valid SVG', () => {
    const svg = svgOf('archimate-layered\nbusiness:\n  actor A')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('contains element labels in SVG text', () => {
    const svg = svgOf(`archimate-layered
  business:
    actor Customer
    service "Online Banking" as OB`)
    expect(svg).toContain('Customer')
    expect(svg).toContain('Online Banking')
  })
})

describe('upstream #71: layer bands', () => {
  it('renders layer label text', () => {
    expect(svgOf('archimate-layered\nbusiness:\n  actor A')).toContain(
      'Business',
    )
  })

  it('renders multiple layer bands', () => {
    const svg = svgOf(`archimate-layered
  business:
    actor Customer
  application:
    component WebApp`)
    expect(svg).toContain('Business')
    expect(svg).toContain('Application')
  })

  it('renders all seven layer labels when present', () => {
    const svg = svgOf(`archimate-layered
  strategy:
    capability C
  motivation:
    goal G
  business:
    actor A
  application:
    component App
  technology:
    node N
  physical:
    equipment E
  implementation:
    workPackage W`)
    for (const label of [
      'Strategy',
      'Motivation',
      'Business',
      'Application',
      'Technology',
      'Physical',
      'Implementation &amp; Migration',
    ]) {
      expect(svg).toContain(label)
    }
  })

  // Upstream draws bands as `color-mix` tinted <rect>s with a fixed layer
  // palette; here bands are flowchart subgraph boxes styled by the theme.
  it.skip('renders layer band background rectangles with a color-mix tint', () => {
    expect(svgOf('archimate-layered\nbusiness:\n  actor A')).toContain(
      'color-mix',
    )
  })
})

describe('upstream #71: element boxes', () => {
  it('renders the element type indicator', () => {
    expect(
      svgOf('archimate-layered\napplication:\n  component WebApp'),
    ).toContain('Component')
  })

  it('renders camelCase types as spaced words', () => {
    expect(
      svgOf('archimate-layered\napplication:\n  dataObject Records'),
    ).toContain('Data Object')
  })

  // Upstream draws every element as a `rx="4"` rounded rectangle; here the
  // shape follows the element type (service is a stadium, artifact a card).
  it.skip('renders element boxes as rounded rectangles', () => {
    expect(svgOf('archimate-layered\nbusiness:\n  actor A')).toContain('rx="4"')
  })
})

describe('upstream #71: relationships', () => {
  it('renders relationship lines', () => {
    expect(edgeElements(svgOf(PAIR('serving'))).length).toBeGreaterThan(0)
  })

  it('renders the relationship type as a label', () => {
    expect(svgOf(PAIR('serving'))).toContain('serving')
  })

  it.each(['realization', 'access', 'influence', 'flow'])(
    'renders a dashed line for %s',
    (type) => {
      expect(svgOf(PAIR(type))).toMatch(/stroke-dasharray/)
    },
  )

  it('renders a solid line for serving (no dasharray on the edge)', () => {
    for (const el of edgeElements(svgOf(PAIR('serving')))) {
      expect(el).not.toContain('stroke-dasharray')
    }
  })

  it('renders an arrowhead for serving and none for association', () => {
    const serving = svgOf(PAIR('serving'))
    const association = svgOf(PAIR('association'))
    expect(serving).toMatch(/marker-end/)
    expect(association).not.toMatch(/marker-end|marker-start/)
  })

  // The next five assert upstream's bespoke marker vocabulary. The flowchart
  // edge model has no diamond, hollow-triangle or dot terminators, so these
  // relationships are told apart by their label (see the decision doc).
  it.skip('uses a filled diamond marker for composition', () => {
    expect(svgOf(PAIR('composition'))).toContain('archimate-diamond-filled')
  })
  it.skip('uses an open diamond marker for aggregation', () => {
    expect(svgOf(PAIR('aggregation'))).toContain('archimate-diamond-open')
  })
  it.skip('uses an open triangle marker for specialization', () => {
    expect(svgOf(PAIR('specialization'))).toContain('archimate-triangle-open')
  })
  it.skip('uses a filled circle + filled arrow for assignment', () => {
    expect(svgOf(PAIR('assignment'))).toContain('archimate-circle-filled')
  })
  it.skip('declares the archimate-* markers in <defs>', () => {
    expect(svgOf(PAIR('serving'))).toContain('archimate-arrow-filled')
  })

  // Not an upstream assertion: the substitute for the skipped marker tests,
  // proving each of the eleven types stays distinguishable in the output.
  it.each([
    'composition',
    'aggregation',
    'assignment',
    'realization',
    'serving',
    'access',
    'influence',
    'triggering',
    'flow',
    'specialization',
  ])('names the %s relationship in the rendered SVG', (type) => {
    expect(svgOf(PAIR(type))).toContain(`>${type}<`)
  })
})

describe('upstream #71: parser round-trip', () => {
  it('parses and renders a multi-layer diagram', () => {
    const svg = svgOf(`archimate-layered
      business:
        actor Customer
        service "Online Banking" as OB
      application:
        component "Web App" as WA
      technology:
        node "App Server" as AS
      Customer -->|serving| OB
      OB -->|realization| WA
      WA -->|assignment| AS`)
    for (const text of [
      'Business',
      'Application',
      'Technology',
      'Customer',
      'Online Banking',
      'Web App',
      'App Server',
    ]) {
      expect(svg).toContain(text)
    }
    expect(edgeElements(svg).length).toBeGreaterThan(0)
  })
})

// ----------------------------------------------------------------------------
// examples/archimate-*.svg from #71: reconstruct each diagram's source from
// the labels in the example and require every text label the upstream render
// shows to appear in this fork's render too.
// ----------------------------------------------------------------------------

const fixture = (name: string): string =>
  readFileSync(
    new URL(
      `./fixtures/upstream-beautiful-mermaid-71/${name}`,
      import.meta.url,
    ),
    'utf8',
  )

const labelsOf = (svg: string): string[] =>
  [...svg.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]!.trim())

// The example labels a relationship "serves"; that is not one of the eleven
// ArchiMate relationship types the parser accepts (upstream's own doc comment
// uses "serves"/"realizes" but its parser drops them), so the reconstruction
// uses the spec name and the label check maps it.
const RENAMED: Record<string, string> = { serves: 'serving' }

const LAYERED = `archimate-layered
  business:
    actor Customer
    service "Online Banking" as OB
  application:
    component "Web App" as WA
    service "Auth Service" as AUTH
  technology:
    node "AWS EC2" as EC2
  Customer -->|serving| OB
  OB -->|realization| WA
  WA -->|assignment| EC2`

const FULL_STACK = `archimate-layered
  business:
    actor Customer
    service "Banking Service" as BS
    process Payment
    process "Account Mgmt" as AM
  application:
    component "Mobile App" as MA
    component "Web Portal" as WP
    component "Core Banking" as CB
    dataObject "Account Data" as AD
  technology:
    node "App Server" as AS
    node "Database Server" as DS
    artifact Docker
    device "Load Balancer" as LB
  Customer -->|serving| BS
  BS -->|realization| MA
  BS -->|realization| WP
  Payment -->|serving| CB
  AM -->|serving| CB
  CB -->|access| AD
  MA -->|serving| Payment
  WP -->|serving| AM
  AS -->|assignment| CB
  DS -->|assignment| AD
  Docker -->|realization| AS
  LB -->|assignment| AS`

describe.each([
  ['archimate-layered.svg', LAYERED],
  ['archimate-full-stack.svg', FULL_STACK],
])('upstream #71 example %s', (file, source) => {
  it('is fully covered by this fork render of the same diagram', () => {
    const ours = svgOf(source).replace(/&amp;/g, '&')
    const upstreamLabels = labelsOf(fixture(file))
    expect(upstreamLabels.length).toBeGreaterThan(10)
    for (const label of upstreamLabels) {
      expect(ours).toContain(RENAMED[label] ?? label)
    }
  })
})
