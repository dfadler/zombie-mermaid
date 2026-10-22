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

describe('pie SVG: init textPosition', () => {
  const src = (init: string) => `${init}\npie\n  "A" : 1\n  "B" : 1`
  // Two equal slices: the first label sits right of centre (225) at
  // 225 + 185 * textPosition * sin(90deg).
  const firstLabelX = (svg: string) =>
    Number(/<text x="([\d.]+)"[^>]*class="pie-slice-label"/.exec(svg)![1])

  it('moves labels toward the centre for a smaller textPosition', () => {
    const def = firstLabelX(renderMermaidSVG(src('')))
    const inner = firstLabelX(
      renderMermaidSVG(src('%%{init: {"pie": {"textPosition": 0.25}}}%%')),
    )
    expect(def).toBeGreaterThan(inner)
    expect(inner).toBeGreaterThan(225)
  })

  it.each(['"x"', 'true', 'null'])(
    'ignores a non-numeric textPosition (%s)',
    (v) => {
      const bad = renderMermaidSVG(
        src(`%%{init: {"pie": {"textPosition": ${v}}}}%%`),
      )
      expect(firstLabelX(bad)).toBe(firstLabelX(renderMermaidSVG(src(''))))
    },
  )
})

describe('pie SVG: init donutHole', () => {
  const src = (init: string) => `${init}\npie\n  "A" : 1\n  "B" : 1`
  const hole = (v: string) =>
    renderMermaidSVG(src(`%%{init: {"pie": {"donutHole": ${v}}}}%%`))
  const slicePath = (svg: string) =>
    /<path d="([^"]+)" class="pie-slice/.exec(svg)![1]

  it('cuts an inner arc at donutHole * radius', () => {
    // Radius 185 * 0.5 = 92.5 inner arc, drawn back the other way (sweep 0)
    expect(slicePath(hole('0.5'))).toContain('A92.5,92.5,0,0,0,')
  })

  it('cuts a hole through a single full-circle slice', () => {
    const svg = renderMermaidSVG(
      '%%{init: {"pie": {"donutHole": 0.5}}}%%\npie\n  "A" : 1',
    )
    expect(slicePath(svg)).toContain('A92.5,92.5,0,1,0,')
  })

  it('keeps the labels at textPosition', () => {
    const x = (svg: string) =>
      /<text x="([\d.]+)"[^>]*class="pie-slice-label"/.exec(svg)![1]
    expect(x(hole('0.5'))).toBe(x(renderMermaidSVG(src(''))))
  })

  it.each(['0', '0.95', '-1', '"x"'])('draws a plain pie for %s', (v) => {
    expect(hole(v)).toBe(renderMermaidSVG(src('')))
  })

  it('accepts the 0.9 upper bound', () => {
    expect(slicePath(hole('0.9'))).toContain('A166.5,166.5,')
  })
})

describe('pie SVG: init legendPosition', () => {
  const src = (
    pos: string,
    body = '"Dogs" : 386\n  "Cats" : 85\n  "Rats" : 15',
  ) => `%%{init: {"pie": {"legendPosition": ${pos}}}}%%\npie title T\n  ${body}`
  const geo = (svg: string) => {
    const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)!
    const rects = [...svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)"/g)].map(
      (m) => ({ x: Number(m[1]), y: Number(m[2]) }),
    )
    const c = /<circle cx="([\d.]+)" cy="([\d.]+)"/.exec(svg)!
    const t = /<text x="([\d.]+)" y="([\d.]+)"[^>]*class="pie-title"/.exec(svg)!
    return {
      w: Number(vb[1]),
      h: Number(vb[2]),
      rects,
      cx: Number(c[1]),
      cy: Number(c[2]),
      title: { x: Number(t[1]), y: Number(t[2]) },
    }
  }
  const def = geo(renderMermaidSVG(src('"right"')))

  it('keeps the default layout for right, an unknown value and a non-string', () => {
    const plain = renderMermaidSVG(
      'pie title T\n  "Dogs" : 386\n  "Cats" : 85\n  "Rats" : 15',
    )
    expect(renderMermaidSVG(src('"right"'))).toBe(plain)
    expect(renderMermaidSVG(src('"nope"'))).toBe(plain)
    expect(renderMermaidSVG(src('3'))).toBe(plain)
  })

  it('left: legend column at the left edge, pie shifted right, frame as wide as right', () => {
    const g = geo(renderMermaidSVG(src('"left"')))
    expect(g.rects.map((r) => r.x)).toEqual([18, 18, 18])
    expect(g.rects.map((r) => r.y)).toEqual([192, 214, 236])
    expect(g.cx).toBeGreaterThan(225)
    expect(g.w).toBe(Math.ceil(g.cx + 265))
    expect(g.w).toBe(def.w)
    expect(g.h).toBe(450)
    // The title stays centred on the frame, not on the shifted pie
    expect(g.title).toEqual({ x: 225, y: 25 })
  })

  it('top: legend above the pie, pie pushed down, frame taller by one row each', () => {
    const g = geo(renderMermaidSVG(src('"top"')))
    expect(g.h).toBe(450 + 3 * 22)
    expect(g.w).toBe(490)
    expect(g.cy).toBe(225 + 4 * 22)
    expect(g.rects.map((r) => r.y)).toEqual([40, 62, 84])
    expect(g.rects[0]!.x).toBeLessThan(225)
    expect(g.title).toEqual({ x: 225, y: 25 })
  })

  it('bottom: legend below the pie, pie stays put, frame taller', () => {
    const g = geo(renderMermaidSVG(src('"bottom"')))
    expect(g.h).toBe(450 + 3 * 22)
    expect(g.w).toBe(490)
    expect(g.cy).toBe(225)
    expect(g.rects.map((r) => r.y)).toEqual([432, 454, 476])
  })

  it('center: legend over the middle of the pie, frame unchanged', () => {
    const svg = renderMermaidSVG(src('"center"'))
    const g = geo(svg)
    expect({ w: g.w, h: g.h, cx: g.cx, cy: g.cy }).toEqual({
      w: 490,
      h: 450,
      cx: 225,
      cy: 225,
    })
    expect(g.rects.map((r) => r.y)).toEqual([192, 214, 236])
    // Painted after the slices, so it sits on top of them
    expect(svg.indexOf('class="pie-legend"')).toBeGreaterThan(
      svg.lastIndexOf('class="pie-slice '),
    )
  })

  it('grows the viewBox for a top legend wider than the frame instead of clipping it', () => {
    const g = geo(renderMermaidSVG(src('"top"', `"${'W'.repeat(80)}" : 1`)))
    expect(g.rects[0]!.x).toBeGreaterThanOrEqual(0)
    expect(g.w).toBeGreaterThan(490)
  })

  it('does nothing for a chart with no slices', () => {
    expect(
      renderMermaidSVG('%%{init: {"pie": {"legendPosition": "left"}}}%%\npie'),
    ).toBe(renderMermaidSVG('pie'))
  })
})

describe('pie SVG: init highlightSlice', () => {
  const src = (v: string) =>
    `%%{init: {"pie": {"highlightSlice": ${v}}}}%%\npie\n  "Dogs" : 386\n  "Cats" : 85\n  "Rats" : 15`
  const plain = renderMermaidSVG(
    'pie\n  "Dogs" : 386\n  "Cats" : 85\n  "Rats" : 15',
  )
  const paths = (svg: string) =>
    [
      ...svg.matchAll(
        /<path d="([^"]+)" class="([^"]+)" data-label="([^"]+)"/g,
      ),
    ].map((m) => ({ d: m[1]!, cls: m[2]!, label: m[3]! }))

  it('grows only the named slice by 5% about the pie centre and makes it opaque', () => {
    const svg = renderMermaidSVG(src('"Cats"'))
    const [dogs, cats, rats] = paths(svg)
    expect(cats!.cls).toContain('pie-highlight')
    expect(dogs!.cls).not.toContain('pie-highlight')
    expect(rats!.cls).not.toContain('pie-highlight')
    // 185 * 1.05 = 194.25; the others keep radius 185
    expect(cats!.d).toContain('A194.25,194.25')
    expect(dogs!.d).toContain('A185,185')
    expect(svg).toContain('.pie-slice.pie-highlight { opacity: 1; }')
  })

  it('leaves a chart without a match byte-identical to the plain one', () => {
    expect(renderMermaidSVG(src('"Fish"'))).toBe(plain)
    expect(renderMermaidSVG(src('"cats"'))).toBe(plain) // Labels match exactly
    expect(renderMermaidSVG(src('""'))).toBe(plain)
    expect(renderMermaidSVG(src('7'))).toBe(plain)
  })

  it('ignores "hover": a static image has no pointer', () => {
    expect(renderMermaidSVG(src('"hover"'))).toBe(plain)
  })

  it('does not treat a slice labelled "hover" as highlighted', () => {
    const s =
      '%%{init: {"pie": {"highlightSlice": "hover"}}}%%\npie\n  "hover" : 1\n  "b" : 1'
    expect(renderMermaidSVG(s)).toBe(
      renderMermaidSVG('pie\n  "hover" : 1\n  "b" : 1'),
    )
  })

  it('scales the donut ring with the slice', () => {
    const s = `%%{init: {"pie": {"highlightSlice": "A", "donutHole": 0.5}}}%%\npie\n  "A" : 1\n  "B" : 1`
    expect(renderMermaidSVG(s)).toContain('A97.13,97.13,') // 92.5 * 1.05
  })
})
