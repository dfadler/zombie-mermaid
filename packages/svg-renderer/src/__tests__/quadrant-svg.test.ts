/**
 * Quadrant chart SVG: Mermaid's geometry (quadrantBuilder.ts defaults,
 * mermaid@12.2.0), checked against numbers taken from a real Mermaid render of
 * the same source, plus the renderer's structure, colours and accessibility.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { __resetSvgTitleIdCounterForTests } from '@zombie-mermaid/core'
import { parseQuadrantChart } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../../../../src/index.ts'
import { layoutQuadrantChart } from '../quadrant/layout.ts'

beforeEach(() => {
  __resetSvgTitleIdCounterForTests()
})

const BASIC = `quadrantChart
    title Reach and engagement of campaigns
    x-axis Low Reach --> High Reach
    y-axis Low Engagement --> High Engagement
    quadrant-1 We should expand
    quadrant-2 Need to promote
    quadrant-3 Re-evaluate
    quadrant-4 May be improved
    Campaign A: [0.3, 0.6]
    Campaign F: [0.35, 0.78]`

const lay = (src: string) => layoutQuadrantChart(parseQuadrantChart(src))
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length

describe('quadrant layout: Mermaid geometry', () => {
  // Numbers from mermaid@12.2.0's own SVG for the full campaigns sample.
  const l = lay(BASIC)

  it('is 500 x 500 with four cells in quadrant-1..4 order', () => {
    expect([l.width, l.height]).toEqual([500, 500])
    expect(l.quadrants.map((q) => [q.x, q.y, q.width, q.height])).toEqual([
      [263, 45, 232, 212],
      [31, 45, 232, 212],
      [31, 257, 232, 212],
      [263, 257, 232, 212],
    ])
  })

  it('puts labels on the cells’ top row once there are points', () => {
    expect(
      l.quadrants.map((q) => [q.text.x, q.text.y, q.text.baseline]),
    ).toEqual([
      [379, 50, 'hanging'],
      [147, 50, 'hanging'],
      [147, 262, 'hanging'],
      [379, 262, 'hanging'],
    ])
  })

  it('places points at (x, 1 - y) with the label 5px below, last point first', () => {
    expect(
      l.points.map((p) =>
        [p.x, p.y, p.text.y].map((n) => Math.round(n * 100) / 100),
      ),
    ).toEqual([
      [193.4, 138.28, 143.28],
      [170.2, 214.6, 219.6],
    ])
    expect(l.points[0]!.text.text).toBe('Campaign F')
  })

  it('draws the title and axis labels where Mermaid does', () => {
    expect([l.title!.x, l.title!.y, l.title!.fontSize]).toEqual([250, 10, 20])
    expect(l.axisLabels.map((a) => [a.text, a.x, a.y, a.rotation])).toEqual([
      ['Low Reach', 147, 479, 0],
      ['High Reach', 379, 479, 0],
      ['Low Engagement', 5, 363, -90],
      ['High Engagement', 5, 151, -90],
    ])
  })

  it('has the six border lines', () => {
    expect(l.lines.map((x) => [x.x1, x.y1, x.x2, x.y2, x.strokeWidth])).toEqual(
      [
        [30, 45, 496, 45, 2],
        [495, 46, 495, 468, 2],
        [30, 469, 496, 469, 2],
        [31, 46, 31, 468, 2],
        [263, 46, 263, 468, 1],
        [32, 257, 494, 257, 1],
      ],
    )
  })
})

describe('quadrant layout: no points', () => {
  it('centres the quadrant labels and puts the x axis on top', () => {
    const l = lay(
      'quadrantChart\n  x-axis A --> B\n  y-axis C --> D\n  quadrant-1 Q',
    )
    expect(l.quadrants[0]!.text.baseline).toBe('middle')
    expect(l.quadrants[0]!.text.y).toBe(l.quadrants[0]!.y + 116)
    // Axis space (26px) above the plot, none below.
    expect(l.quadrants[0]!.y).toBe(5 + 26)
    expect(l.axisLabels[0]!.y).toBe(5)
  })

  it('omits the title and axes space when absent', () => {
    const l = lay('quadrantChart')
    expect(l.title).toBeUndefined()
    expect(l.axisLabels).toEqual([])
    expect([l.quadrants[1]!.x, l.quadrants[1]!.y]).toEqual([5, 5])
  })
})

describe('quadrant layout: one-sided axes', () => {
  it('anchors the label at the plot corner', () => {
    const l = lay(
      'quadrantChart\n  x-axis Left\n  y-axis Bottom\n  A: [0.5, 0.5]',
    )
    const [x, y] = l.axisLabels
    expect([x!.anchor, x!.x]).toEqual(['start', 31])
    expect([y!.anchor, y!.y, y!.rotation]).toEqual(['start', 469, -90])
  })
})

describe('quadrant SVG: structure and styling', () => {
  const svg = renderMermaidSVG(BASIC)

  it('paints quadrants, borders, points, labels, title in Mermaid’s order', () => {
    const order = [
      'class="quadrants"',
      'class="border"',
      'class="data-points"',
      'class="labels"',
      'class="title"',
    ]
    const at = order.map((s) => svg.indexOf(s))
    expect(at.every((i) => i > 0)).toBe(true)
    expect(at).toEqual([...at].sort((a, b) => a - b))
  })

  it('has one rect + label per quadrant, a line each, a circle + label per point', () => {
    expect(count(svg, /<rect [^>]*class="quadrant-cell-\d"/g)).toBe(4)
    expect(count(svg, /<line /g)).toBe(6)
    expect(count(svg, /<circle /g)).toBe(2)
    expect(count(svg, /class="data-point"/g)).toBe(2)
    expect(count(svg, /quadrant-axis-label/g)).toBe(4)
  })

  it('uses theme variables, not literal colours, for the defaults', () => {
    expect(svg).toContain('.quadrant-point { fill: var(--fg);')
    expect(svg).toContain('.quadrant-text { fill: var(--_text); }')
    expect(svg).toMatch(
      /\.quadrant-cell-0 \{ fill: color-mix\(in srgb, var\(--accent, #[0-9a-f]{6}\) 14%, var\(--bg\)\); \}/,
    )
    expect(svg).not.toContain('NaN')
  })

  it('renders custom point styles as CSS rules, not attributes', () => {
    const s = renderMermaidSVG(
      'quadrantChart\n  classDef c1 color: #ff3300, radius: 10\n  A:::c1: [0.5, 0.5] stroke-color: #00ff33, stroke-width: 5px\n  B: [0, 0]',
    )
    // Last point first: B (plain) is index 0, A index 1.
    expect(s).toContain(
      '.quadrant-point-1 { fill: #ff3300; stroke: #00ff33; stroke-width: 5px; }',
    )
    expect(s).toContain('r="10" class="quadrant-point quadrant-point-1"')
    expect(s).toContain('r="5" class="quadrant-point"/>')
    expect(count(s, /\.quadrant-point-\d \{/g)).toBe(1)
  })

  it('escapes text', () => {
    const s = renderMermaidSVG(
      'quadrantChart\n  title A <b> & "c"\n  "x<y": [0.5, 0.5]',
    )
    expect(s).toContain('A &lt;b&gt; &amp; &quot;c&quot;')
    expect(s).toContain('x&lt;y')
  })
})

describe('quadrant SVG: accessibility', () => {
  it('names the chart by options.title, else accTitle, never the visible title', () => {
    expect(
      renderMermaidSVG(
        'quadrantChart\n  title Shown\n  accTitle: Spoken\n  accDescr: Details',
      ),
    ).toMatch(
      /aria-labelledby="zm-title-1"[^>]*>[\s\S]*<title id="zm-title-1">Spoken<\/title>[\s\S]*<desc id="zm-desc-1">Details<\/desc>/,
    )
    expect(
      renderMermaidSVG('quadrantChart\n  accTitle: Spoken', {
        title: 'Option',
      }),
    ).toContain('>Option</title>')
    expect(renderMermaidSVG('quadrantChart\n  title Shown')).not.toContain(
      '<title',
    )
  })

  it('is decorative on request', () => {
    expect(
      renderMermaidSVG('quadrantChart\n  title Shown', { decorative: true }),
    ).not.toContain('<title')
  })

  it('stamps the source when asked and renders on a transparent background', () => {
    const s = renderMermaidSVG('quadrantChart', {
      embedSource: true,
      transparent: true,
    })
    expect(s).toContain('data-src=')
  })
})
