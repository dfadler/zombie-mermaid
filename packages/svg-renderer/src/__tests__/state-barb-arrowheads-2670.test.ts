/**
 * mermaid@12.3.0 draws a state diagram with `stateDiagram-barbEnd-margin`
 * arrowheads (20x14, `M 19,7 L11,14 L13,7 L11,0 Z`, refX 17) on edges that stop
 * 5.5px short of the box, and 5px-radius state boxes (#2670).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG, renderSvg } from '@zombie-mermaid/svg-renderer'
import { layoutFlowchartSync } from '../layout-engine.ts'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'

const STATE = 'stateDiagram-v2\n  A --> B\n  B --> C'

describe('state diagram barbs and radius (#2670)', () => {
  it('uses the barbed marker and 5px boxes', async () => {
    const svg = await renderMermaidSVG(STATE)
    expect(svg).toContain('d="M 19,7 L11,14 L13,7 L11,0 Z"')
    expect(svg).toContain('refX="17"')
    expect(svg).not.toContain('<polygon')
    expect(svg).toContain('rx="5" ry="5"')
    expect(svg).not.toContain('rx="6"')
    // The first edge ends 5.5px above B's top border
    const ys = [
      ...svg.matchAll(
        /class="edge"[^>]* d="M [\d.]+ ([\d.]+) L [\d.]+ ([\d.]+)"/g,
      ),
    ]
    const b = /data-id="B"[\s\S]*?<rect x="[\d.]+" y="([\d.]+)"/.exec(svg)!
    expect(Number(ys[0]![2])).toBeCloseTo(Number(b[1]) - 5.5)
  })

  it('leaves flowcharts alone', async () => {
    const svg = await renderMermaidSVG('graph TD\n  A(x) --> B')
    expect(svg).toContain('<polygon')
    expect(svg).toContain('rx="6"')
  })

  it('pulls a start arrow back too', () => {
    const g = layoutFlowchartSync(parseMermaid(STATE))
    g.edges[0]!.hasArrowStart = true
    const first = g.edges[0]!.points[0]!
    const svg = renderSvg(g, { bg: '#fff', fg: '#000' })
    const m = /data-from="A"[^>]* d="M ([\d.]+) ([\d.]+)/.exec(svg)!
    expect(Number(m[2])).toBeCloseTo(first.y + 5.5)
  })

  it('leaves a too-short edge alone', () => {
    const g = layoutFlowchartSync(parseMermaid(STATE))
    g.edges[0]!.points = [
      { x: 0, y: 0 },
      { x: 0, y: 3 },
    ]
    expect(() => renderSvg(g, { bg: '#fff', fg: '#000' })).not.toThrow()
  })

  it('draws a barb in a linkStyle colour', async () => {
    const svg = await renderMermaidSVG(`${STATE}\n  linkStyle 0 stroke:#f00`)
    expect(svg).toMatch(/<marker id="[^"]*arrowhead-[^"]*"[^>]*refX="17"/)
  })
})
