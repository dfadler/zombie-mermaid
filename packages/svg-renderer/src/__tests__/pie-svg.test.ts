import { describe, it, expect, beforeEach } from 'vitest'
import { __resetSvgTitleIdCounterForTests, THEMES } from '@zombie-mermaid/core'
import { getSeriesColor } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../../../../src/index.ts'

beforeEach(() => {
  __resetSvgTitleIdCounterForTests()
})

const BASIC = `pie title Pets adopted by volunteers
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15`

const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length

describe('pie SVG: structure', () => {
  const svg = renderMermaidSVG(BASIC)

  it('draws the outline circle, one path per slice, a label each, the title and a legend row each', () => {
    expect(count(svg, /class="pie-outer"/g)).toBe(1)
    expect(count(svg, /<path [^>]*class="pie-slice /g)).toBe(3)
    expect(count(svg, /class="pie-slice-label"/g)).toBe(3)
    expect(count(svg, /class="pie-title"/g)).toBe(1)
    expect(count(svg, /<g class="pie-legend">/g)).toBe(3)
  })

  it("paints in Mermaid's order: circle, slices, labels, title, legend", () => {
    const order = [
      'class="pie-outer"',
      'class="pie-slice ',
      'class="pie-slice-label"',
      'class="pie-title"',
      'class="pie-legend"',
    ].map((m) => svg.indexOf(m))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(order.every((i) => i > 0)).toBe(true)
  })

  it('writes whole-number percentage labels', () => {
    const labels = [...svg.matchAll(/class="pie-slice-label">([^<]*)</g)].map(
      (m) => m[1],
    )
    // 386/486, 85/486, 15/486
    expect(labels).toEqual(['79%', '17%', '3%'])
  })

  it('draws no callout lines', () => {
    expect(svg).not.toMatch(/<polyline|<line /)
  })

  it('tags slices with their label and value', () => {
    expect(svg).toContain('data-label="Dogs" data-value="386"')
  })

  it('sizes the root to the layout', () => {
    expect(svg).toMatch(
      /^<svg [^>]*viewBox="0 0 \d+ 450" width="\d+" height="450"/,
    )
  })

  it('escapes labels and titles', () => {
    const out = renderMermaidSVG('pie title A <b> & "c"\n  "x<y & \\"z\\"" : 1')
    expect(out).toContain(
      'class="pie-title">A &lt;b&gt; &amp; &quot;c&quot;</text>',
    )
    expect(out).toContain('data-label="x&lt;y &amp; &quot;z&quot;"')
    expect(out).toContain(
      'class="pie-legend-text">x&lt;y &amp; &quot;z&quot;</text>',
    )
  })

  it('renders an empty chart as the outline circle and title only', () => {
    const out = renderMermaidSVG('pie title Empty')
    expect(count(out, /class="pie-outer"/g)).toBe(1)
    expect(out).not.toContain('class="pie-slice')
    expect(out).not.toContain('class="pie-legend"')
    expect(out).toContain('class="pie-title">Empty</text>')
  })

  it('renders a bare `pie` with no title', () => {
    const out = renderMermaidSVG('pie')
    expect(out).toContain('class="pie-outer"')
    expect(out).not.toContain('class="pie-title"')
  })
})

describe('pie SVG: styling and theme', () => {
  it("uses Mermaid's 0.7 slice opacity, 2px strokes and text sizes", () => {
    const svg = renderMermaidSVG(BASIC)
    expect(svg).toContain(
      '.pie-slice { stroke: var(--fg); stroke-width: 2px; opacity: 0.7; }',
    )
    expect(svg).toContain(
      '.pie-outer { fill: none; stroke: var(--fg); stroke-width: 2px; }',
    )
    expect(svg).toMatch(/\.pie-title \{[^}]*font-size: 25px/)
    expect(svg).toMatch(/\.pie-slice-label \{[^}]*font-size: 17px/)
    expect(svg).toMatch(/\.pie-legend-text \{[^}]*font-size: 17px/)
  })

  it('fills slot 0 with the live theme accent and later slots with series shades', () => {
    const svg = renderMermaidSVG(BASIC, {
      bg: '#ffffff',
      fg: '#111111',
      accent: '#e11d48',
    })
    expect(svg).toContain('--pie-color-0: var(--accent, #3b82f6);')
    expect(svg).toContain(
      `--pie-color-1: ${getSeriesColor(1, '#e11d48', '#ffffff')};`,
    )
    expect(svg).toContain(
      `--pie-color-2: ${getSeriesColor(2, '#e11d48', '#ffffff')};`,
    )
    expect(svg).toContain('.pie-color-1 { fill: var(--pie-color-1); }')
    expect(svg).toContain('rect.pie-color-1 { stroke: var(--pie-color-1); }')
  })

  it('adapts the series shades to a dark background', () => {
    const dark = THEMES['tokyo-night']!
    const svg = renderMermaidSVG(BASIC, dark)
    expect(svg).toContain(
      `--pie-color-1: ${getSeriesColor(1, dark.accent ?? '#3b82f6', dark.bg)};`,
    )
    expect(svg).toContain(`--bg:${dark.bg}`)
    // Light vs dark backgrounds pick different shades for the same slot.
    expect(getSeriesColor(1, '#3b82f6', '#ffffff')).not.toBe(
      getSeriesColor(1, '#3b82f6', dark.bg),
    )
  })

  it('defines colour variables only for palette slots in use, wrapping after 12', () => {
    const lines = Array.from({ length: 14 }, (_, i) => `  "S${i}" : 10`)
    const svg = renderMermaidSVG(`pie\n${lines.join('\n')}`)
    expect(count(svg, /--pie-color-\d+:/g)).toBe(12)
    expect(svg).not.toContain('--pie-color-12')
    expect(count(svg, /class="pie-slice pie-color-0"/g)).toBe(2)
  })

  it('resolves to concrete colours with resolveColors', () => {
    const svg = renderMermaidSVG(BASIC, { resolveColors: true })
    expect(svg).not.toMatch(/var\(--pie-color/)
  })

  it('honours nonce and styleAttribute: false', () => {
    const svg = renderMermaidSVG(BASIC, { nonce: 'abc', styleAttribute: false })
    expect(count(svg, /<style nonce="abc">/g)).toBe(2)
    expect(svg).not.toMatch(/<style>/)
    expect(svg.slice(0, svg.indexOf('>'))).not.toContain('style=')
  })
})

describe('pie SVG: accessibility', () => {
  it('uses accTitle as the accessible name and accDescr as the description', () => {
    const svg = renderMermaidSVG(
      'pie\n  accTitle: Pet adoptions\n  accDescr: Dogs lead by far\n  "Dogs" : 3\n  "Cats" : 1',
    )
    expect(svg).toMatch(
      /^<svg [^>]*role="img" aria-labelledby="zm-title-1" aria-describedby="zm-desc-1"/,
    )
    expect(svg).toContain('<title id="zm-title-1">Pet adoptions</title>')
    expect(svg).toContain('<desc id="zm-desc-1">Dogs lead by far</desc>')
  })

  it('lets options.title override accTitle', () => {
    const svg = renderMermaidSVG('pie\n  accTitle: From source\n  "A" : 1', {
      title: 'From caller',
    })
    expect(svg).toContain('>From caller</title>')
    expect(svg).not.toContain('From source')
  })

  it('does not use the visible title as the accessible name', () => {
    const svg = renderMermaidSVG(BASIC)
    expect(svg).toMatch(/^<svg [^>]*role="img"/)
    expect(svg).not.toContain('<title')
  })

  it('drops the name and description for decorative output', () => {
    const svg = renderMermaidSVG(
      'pie\n  accTitle: T\n  accDescr: D\n  "A" : 1',
      { decorative: true },
    )
    expect(svg).toMatch(/^<svg [^>]*aria-hidden="true"/)
    expect(svg).not.toMatch(
      /<title|<desc|aria-labelledby|aria-describedby|role=/,
    )
  })

  it('embeds the source when asked', () => {
    const svg = renderMermaidSVG(BASIC, { embedSource: true })
    expect(svg).toMatch(/^<svg data-src="pie title Pets/)
  })
})
