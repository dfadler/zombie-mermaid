/**
 * quadrantChart `%%{init}%%` config and `quadrant*` theme variables (#2438).
 * Numbers in the geometry test come from real mermaid@12.2.0 (also npm latest)
 * rendering the same source through scripts/lib/real-mermaid.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  __resetSvgTitleIdCounterForTests,
  extractInitConfig,
} from '@zombie-mermaid/core'
import { parseQuadrantChart } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG, renderMermaidASCII } from '../../../../src/index.ts'
import { layoutQuadrantChart } from '../quadrant/layout.ts'

beforeEach(() => {
  __resetSvgTitleIdCounterForTests()
})

const BODY = `quadrantChart
    title T
    x-axis Low --> High
    y-axis Lo --> Hi
    quadrant-1 A
    quadrant-2 B
    quadrant-3 C
    quadrant-4 D
    P1: [0.3, 0.6]`
const withInit = (init: string, body = BODY) => `%%{init: ${init}}%%\n${body}`
const CFG = withInit(
  '{"quadrantChart": {"chartWidth": 400, "chartHeight": 300, "pointRadius": 9, "titleFontSize": 30, "yAxisPosition": "right"}}',
)
const lay = (src: string) => layoutQuadrantChart(parseQuadrantChart(src))
const round = (n: number) => Math.round(n * 100) / 100

describe('quadrantChart init config: parsing', () => {
  it('keeps numbers and known positions, drops the rest', () => {
    const { quadrant } = extractInitConfig([
      '%%{init: {"quadrantChart": {"chartWidth": 400, "pointRadius": "9", "titleFontSize": -1, "pointTextPadding": null, "xAxisPosition": "bottom", "yAxisPosition": "middle"}}}%%',
    ])
    expect(quadrant).toEqual({ chartWidth: 400, xAxisPosition: 'bottom' })
  })

  it('merges later directives over earlier ones', () => {
    const { quadrant } = extractInitConfig([
      '%%{init: {"quadrantChart": {"chartWidth": 400, "pointRadius": 2}}}%%',
      '%%{init: {"quadrantChart": {"chartWidth": 300}}}%%',
    ])
    expect(quadrant).toEqual({ chartWidth: 300, pointRadius: 2 })
  })

  it('reads quadrant colours under every theme and drops bad colours', () => {
    const { themeVariables } = extractInitConfig([
      '%%{init: {"theme": "dark", "themeVariables": {"quadrant1Fill": "#ff0000", "quadrantTitleFill": "url(x)", "quadrantPointFill": "red"}}}%%',
      '%%{init: {"themeVariables": {"quadrant2Fill": "#00ff00"}}}%%',
    ])
    expect(themeVariables?.quadrant).toEqual({
      quadrant1Fill: '#ff0000',
      quadrantPointFill: 'red',
      quadrant2Fill: '#00ff00',
    })
  })

  it('puts the config and colours on the parsed chart', () => {
    const chart = parseQuadrantChart(
      withInit(
        '{"quadrantChart": {"pointRadius": 7}, "themeVariables": {"quadrant3Fill": "#123456"}}',
      ),
    )
    expect(chart.config).toEqual({ pointRadius: 7 })
    expect(chart.themeColors).toEqual({ quadrant3Fill: '#123456' })
    expect(parseQuadrantChart('quadrantChart').config).toBeUndefined()
  })
})

describe('quadrantChart init config: geometry matches mermaid', () => {
  const l = lay(CFG)

  it('sizes the frame and cells', () => {
    expect([l.width, l.height]).toEqual([400, 300])
    expect(l.quadrants.map((q) => [q.x, q.y, q.width, q.height])).toEqual([
      [187, 55, 182, 107],
      [5, 55, 182, 107],
      [5, 162, 182, 107],
      [187, 162, 182, 107],
    ])
  })

  it('applies pointRadius, titleFontSize and the centred title', () => {
    expect(l.points.map((p) => [round(p.x), round(p.y), p.radius])).toEqual([
      [114.2, 140.6, 9],
    ])
    expect(l.title).toMatchObject({ x: 200, y: 10, fontSize: 30 })
  })

  it('puts the y axis on the right and the x axis below the plot', () => {
    expect(l.axisLabels.map((a) => [a.text, a.x, a.y, a.rotation])).toEqual([
      ['Low', 96, 279, 0],
      ['High', 278, 279, 0],
      ['Lo', 379, 215.5, -90],
      ['Hi', 379, 108.5, -90],
    ])
  })

  it('xAxisPosition only counts while the chart has no points', () => {
    const empty = `quadrantChart\n  x-axis L --> R`
    const top = lay(empty).axisLabels[0]!.y
    const bottom = lay(
      withInit('{"quadrantChart": {"xAxisPosition": "bottom"}}', empty),
    ).axisLabels[0]!.y
    expect(top).toBe(5)
    expect(bottom).toBeGreaterThan(400)
    expect(
      lay(withInit('{"quadrantChart": {"xAxisPosition": "top"}}'))
        .axisLabels[0]!.y,
    ).toBe(479)
  })

  it('is byte-identical to the default without a config', () => {
    expect(lay(BODY)).toEqual(lay(withInit('{"quadrantChart": {}}', BODY)))
    expect([lay(BODY).width, lay(BODY).height]).toEqual([500, 500])
  })

  it('reaches the SVG', () => {
    const svg = renderMermaidSVG(CFG)
    expect(svg).toContain('viewBox="0 0 400 300"')
    expect(svg).toContain('r="9"')
  })
})

describe('quadrant theme variables', () => {
  const TV = withInit(
    '{"themeVariables": {"quadrant1Fill": "#ff0000", "quadrant1TextFill": "#abcdef", "quadrantPointFill": "#00ff00", "quadrantPointTextFill": "#fedcba", "quadrantXAxisTextFill": "#111111", "quadrantYAxisTextFill": "#222222", "quadrantTitleFill": "#0000ff", "quadrantInternalBorderStrokeFill": "#123456", "quadrantExternalBorderStrokeFill": "#654321"}}',
  )

  it('are ignored unless honorThemeVariables is set', () => {
    expect(renderMermaidSVG(TV)).toBe(renderMermaidSVG(BODY))
  })

  it('paint the chart when honoured', () => {
    const svg = renderMermaidSVG(TV, { honorThemeVariables: true })
    for (const rule of [
      '.quadrant-cell-0 { fill: #ff0000; }',
      '.quadrant:nth-child(1) .quadrant-label { fill: #abcdef; }',
      '.quadrant-point { fill: #00ff00; stroke: #00ff00; }',
      '.quadrant-point-label { fill: #fedcba; }',
      '[transform$="rotate(0)"] { fill: #111111; }',
      '[transform$="rotate(-90)"] { fill: #222222; }',
      '.quadrant-title { fill: #0000ff; }',
      '.quadrant-line-internal { stroke: #123456; }',
      '.quadrant-line-external { stroke: #654321; }',
    ]) {
      expect(svg).toContain(rule)
    }
  })

  it('leave a point’s own colour in charge', () => {
    const svg = renderMermaidSVG(
      withInit(
        '{"themeVariables": {"quadrantPointFill": "#00ff00"}}',
        `quadrantChart\n  P: [0.5, 0.5] radius: 4, color: #ff00ff`,
      ),
      { honorThemeVariables: true },
    )
    expect(svg.indexOf('.quadrant-point { fill: #00ff00')).toBeLessThan(
      svg.indexOf('.quadrant-point-0 { fill: #ff00ff;'),
    )
  })
})

describe('quadrantChart init config: ASCII', () => {
  // Mermaid has no ASCII output, so there is no sized or recoloured analogue:
  // the config is read and the grid stays the same.
  it('does not change the grid', () => {
    const opts = { colorMode: 'none' } as const
    expect(renderMermaidASCII(CFG, opts)).toBe(renderMermaidASCII(BODY, opts))
  })
})
