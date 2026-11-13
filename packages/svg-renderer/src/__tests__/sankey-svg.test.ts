/**
 * Sankey layout and SVG. Geometry expectations are measured from
 * mermaid@12.3.0 rendering the same sources (d3-sankey's layout, then
 * `setupGraphViewbox`); colours are this library's own.
 */
import { describe, it, expect } from 'vitest'
import { parseSankey } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../index.ts'
import { layoutSankey } from '../sankey/layout.ts'
import { measureTextWidth } from '@zombie-mermaid/core'

const layout = (src: string) => layoutSankey(parseSankey(src))
const BASIC = `sankey-beta
Agricultural 'waste',Bio-conversion,124.729
Bio-conversion,Liquid,0.597
Bio-conversion,Solid,26.862
Bio-conversion,Gas,280.322
Bio-conversion,Losses,3`

describe('layoutSankey', () => {
  it('places nodes and ribbons where d3-sankey does in mermaid', () => {
    const p = layout(BASIC)
    // Mermaid's viewBox is "0 -12.69 600 414.15": labels overhang the bars.
    expect(p.width).toBeCloseTo(600, 1)
    expect(p.height).toBeCloseTo(414.15, 1)
    const top = 12.6936
    const [agri, bio, liquid, solid, gas, losses] = p.nodes
    expect(agri!.x0).toBeCloseTo(0)
    expect(agri!.y0 - 0).toBeCloseTo(69.857 + top, 2)
    expect(agri!.y1 - agri!.y0).toBeCloseTo(128.0276, 3)
    expect(bio!.x0).toBeCloseTo(295)
    expect(bio!.y1 - bio!.y0).toBeCloseTo(319, 3)
    expect(liquid!.x0).toBeCloseTo(590)
    expect(solid!.y0).toBeCloseTo(27.6128 + top, 2)
    expect(gas!.y1 - gas!.y0).toBeCloseTo(287.7355, 3)
    expect(losses!.y0).toBeCloseTo(396.9207 + top, 2)
    expect(p.links[1]!.width).toBeCloseTo(0.6128, 3)
    expect(p.links[0]).toMatchObject({ x0: 10, x1: 295 })
    expect(p.links[0]!.y0).toBeCloseTo(133.871 + top, 2)
  })

  it('labels with the id and rounded value, on the side away from the middle', () => {
    const p = layout(BASIC)
    expect(p.nodes[0]!.label).toMatchObject({
      anchor: 'start',
      text: "Agricultural 'waste' 124.73",
    })
    expect(p.nodes[1]!.label.text).toBe('Bio-conversion 310.78')
    expect(p.nodes[1]!.label.anchor).toBe('start')
    expect(p.nodes[5]!.label.anchor).toBe('end')
    expect(p.nodes[2]!.label.text).toBe('Liquid 0.6')
  })

  it('aligns columns as d3-sankey does', () => {
    const src = (a: string) =>
      `%%{init: {"sankey": {"nodeAlignment": "${a}"}}}%%\nsankey-beta\nA,B,10\nB,C,5\nA,C,2\nA,D,3`
    const layers = (a: string) => layout(src(a)).nodes.map((n) => n.layer)
    expect(layers('left')).toEqual([0, 1, 2, 1])
    expect(layers('right')).toEqual([0, 1, 2, 2])
    expect(layers('justify')).toEqual([0, 1, 2, 2])
    expect(layers('center')).toEqual([0, 1, 2, 1])
  })

  it('honours size, node width and padding, and drops values from labels', () => {
    const p = layout(
      '%%{init: {"sankey": {"width": 300, "height": 200, "nodeWidth": 20, "nodePadding": 30, "showValues": false}}}%%\nsankey-beta\nA,B,10\nA,C,2',
    )
    expect(p.nodes[1]!.x0).toBeCloseTo(p.nodes[0]!.x0 + 280)
    expect(p.nodes[0]!.x1 - p.nodes[0]!.x0).toBe(20)
    expect(p.nodes[0]!.label.text).toBe('A')
  })

  it('flips outlined labels around the layer of the largest node', () => {
    const p = layout(
      '%%{init: {"sankey": {"labelStyle": "outlined"}}}%%\nsankey-beta\nA,B,10\nB,C,5\nA,C,2',
    )
    // The largest node is A (layer 0), so every label sits to the right of its bar.
    expect(p.nodes.map((n) => n.label.anchor)).toEqual([
      'start',
      'start',
      'start',
    ])
    const q = layout(
      '%%{init: {"sankey": {"labelStyle": "outlined"}}}%%\nsankey-beta\nA,B,1\nB,C,9',
    )
    expect(q.nodes.map((n) => n.label.anchor)).toEqual([
      'end',
      'start',
      'start',
    ])
  })

  it('leaves room for an overhanging label in the font it is drawn in', () => {
    const p = layout(
      '%%{init: {"sankey": {"labelStyle": "outlined"}}}%%\nsankey-beta\nA,B,1\nB,C,9',
    )
    // A's label sits left of its bar: its width as Inter is measured, then the gap.
    expect(p.nodes[0]!.x0).toBeCloseTo(measureTextWidth('A 1', 14, 400) + 6, 1)
  })

  it('ignores a flow that is not positive when sizing the drawing', () => {
    const p = layout('sankey-beta\nA,B,0\nA,C,5')
    expect(p.height).toBeGreaterThan(400)
  })
})

describe('renderMermaidSVG sankey', () => {
  it("draws bars, labels and gradient ribbons in mermaid's structure", () => {
    const svg = renderMermaidSVG(BASIC)
    expect(svg.match(/<g class="node" /g)).toHaveLength(6)
    expect(svg.match(/<linearGradient /g)).toHaveLength(5)
    expect(svg.match(/<path d="M/g)).toHaveLength(5)
    expect(svg).toContain('class="nodes"')
    expect(svg).toContain('class="node-labels" font-size="14"')
    expect(svg).toContain('Agricultural &#39;waste&#39; 124.73')
    expect(svg).toMatch(/stroke="url\(#[^"]*sankey-[a-z0-9]+-link-0\)"/)
    expect(svg).toMatch(/stroke-width="128\.03"/)
    // The thinnest ribbon is at least one pixel wide.
    expect(svg).toContain('stroke-width="1"')
  })

  it('paints ribbons in the source or target colour or a fixed colour', () => {
    const run = (c: string) =>
      renderMermaidSVG(
        `%%{init: {"sankey": {"linkColor": "${c}"}}}%%\nsankey-beta\nA,B,1\nB,C,1`,
      )
    expect(run('source')).not.toContain('linearGradient')
    expect(run('source')).toMatch(/<path d="M[^"]*" class="sk-s0"/)
    expect(run('target')).toMatch(/<path d="M[^"]*" class="sk-s1"/)
    expect(run('#00ff00')).toContain('stroke="#00ff00"')
  })

  it('uses nodeColors as given and ignores ones that could fetch a resource', () => {
    const svg = renderMermaidSVG(
      '%%{init: {"sankey": {"nodeColors": {"A": "red", "B": "url(/x.svg#p)"}}}}%%\nsankey-beta\nA,B,1',
    )
    expect(svg).toContain('fill="red"')
    expect(svg).toContain('stop-color="red"')
    expect(svg).not.toContain('url(/x.svg')
  })

  it('draws outlined labels twice, as halo and text', () => {
    const svg = renderMermaidSVG(
      '%%{init: {"sankey": {"labelStyle": "outlined"}}}%%\nsankey-beta\nA,B,1',
    )
    expect(svg.match(/class="sankey-label-bg"/g)).toHaveLength(2)
    expect(svg.match(/class="sankey-label-fg"/g)).toHaveLength(2)
  })

  it('shifts the label baseline when values are hidden', () => {
    const svg = renderMermaidSVG(
      '%%{init: {"sankey": {"showValues": false}}}%%\nsankey-beta\nA,B,1',
    )
    expect(svg).toContain('dy="0.35em"')
  })

  it('does not mistake node names such as `constructor` for configured colours', () => {
    const svg = renderMermaidSVG(
      '%%{init: {"sankey": {"nodeColors": {"A": "red"}}}}%%\nsankey-beta\nconstructor,toString,1\nA,constructor,1',
    )
    expect(svg).toContain('fill="red"')
    expect(svg).not.toContain('function')
    expect(svg).not.toContain('NaN')
  })

  it('ignores inherited properties when a caller passes a plain nodeColors object', () => {
    const p = layoutSankey({
      nodes: ['constructor', 'B'],
      links: [{ source: 'constructor', target: 'B', value: 1 }],
      config: { nodeColors: { B: 'red' } },
    })
    expect(p.nodes.map((n) => n.color)).toEqual([undefined, 'red'])
  })

  it('draws an empty graph for nodes without links, and formats huge values', () => {
    const p = layoutSankey({ nodes: ['A'], links: [] })
    expect(Number.isFinite(p.width) && Number.isFinite(p.height)).toBe(true)
    expect(layout('sankey-beta\nA,B,1e307').nodes[0]!.label.text).toBe(
      'A 1e+307',
    )
  })

  it('scopes gradient ids to the diagram', () => {
    const id = (src: string) =>
      /linearGradient id="([^"]+)"/.exec(renderMermaidSVG(src))![1]
    expect(id('sankey-beta\nA,B,1')).not.toBe(id('sankey-beta\nA,B,2'))
  })

  it('throws "circular link" for a cycle', () => {
    expect(() => renderMermaidSVG('sankey-beta\nA,B,1\nB,A,1')).toThrow(
      /circular link/,
    )
  })

  it('is named by accTitle-less sources only through options.title', () => {
    const svg = renderMermaidSVG('sankey-beta\nA,B,1', { title: 'Flows' })
    expect(svg).toContain('<title')
    expect(svg).toContain('Flows')
  })
})
