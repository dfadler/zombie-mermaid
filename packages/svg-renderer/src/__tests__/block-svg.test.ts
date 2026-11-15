import { describe, it, expect } from 'vitest'
import { parseBlock } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../../../../src/index.ts'
import { layoutBlock, BLOCK } from '../block/layout.ts'

const layout = (src: string) => layoutBlock(parseBlock(src))

describe('block layout (Mermaid 12.3.0 figures)', () => {
  it('gives every cell the widest label and 8px of padding', () => {
    // "Alpha" is 49.4px wide in Trebuchet MS 16px; +32 padding, 40px tall.
    const b = layout('block-beta\n  columns 2\n  a["Alpha"] b\n  c')
    const [a, bb, c] = b.nodes
    expect(a!.width).toBe(bb!.width)
    expect([a!.height, c!.y - a!.y]).toEqual([40, 48])
    expect(bb!.x - a!.x).toBe(a!.width + BLOCK.padding)
    // Bounds plus 5px of margin.
    expect(b.viewBox.x).toBe(a!.x - a!.width / 2 - BLOCK.margin)
    expect(b.viewBox.y).toBe(a!.y - a!.height / 2 - BLOCK.margin)
  })

  it('makes a spanning block N cells wide plus the paddings between them', () => {
    const b = layout('block-beta\n  columns 3\n  a b:2')
    const [a, bb] = b.nodes
    expect(bb!.width).toBe(2 * a!.width + BLOCK.padding)
  })

  it('draws a round block 16px narrower than a square one', () => {
    const sq = layout('block-beta\n  a["Alpha"]').nodes[0]!
    const rd = layout('block-beta\n  a("Alpha")').nodes[0]!
    expect(sq.width - rd.width).toBe(16)
  })

  it('adds a 24px line per <br>', () => {
    expect(layout('block-beta\n  a["x<br/>y<br>z"]').nodes[0]!.height).toBe(88)
  })

  it('nests groups, parents before children, and skips spaces', () => {
    const b = layout(
      'block-beta\n  columns 2\n  block:g\n    x y\n  end\n  space',
    )
    expect(b.nodes.map((n) => n.id)).toEqual(['g', 'x', 'y'])
    expect(b.nodes[0]!.type).toBe('composite')
  })

  it('is empty for an empty diagram', () => {
    expect(layout('block-beta')).toEqual({
      nodes: [],
      edges: [],
      viewBox: { x: -5, y: -5, width: 10, height: 10 },
    })
  })
})

describe('block SVG', () => {
  const svg = renderMermaidSVG(
    'block-beta\n  columns 2\n  a("round") b["x & y<br/>z"]\n  block:g:2\n    c\n  end',
  )

  it('draws a rect per block with rounded corners for round blocks', () => {
    expect(svg.match(/class="label-container"/g)).toHaveLength(3)
    expect(svg).toContain('class="composite label-container"')
    expect(svg).toMatch(/rx="5" ry="5"/)
    expect(svg).toContain('rx="0" ry="0"')
  })

  it('escapes and stacks label lines', () => {
    expect(svg).toContain('>x &amp; y</text>')
    expect(svg).toContain('>z</text>')
  })

  it('names the drawing when a title is given and honours decorative', () => {
    expect(renderMermaidSVG('block-beta\n  a', { title: 'Grid' })).toContain(
      '<title id="zm-title-',
    )
    expect(renderMermaidSVG('block-beta\n  a', { decorative: true })).toContain(
      'aria-hidden="true"',
    )
  })

  it('embeds the source on request and renders an empty diagram', () => {
    expect(
      renderMermaidSVG('block-beta\n  a', { embedSource: true }),
    ).toContain('data-src=')
    expect(renderMermaidSVG('block-beta')).toContain('<svg')
  })
})

describe('block links', () => {
  const src =
    'block-beta\n  columns 3\n  a space b\n  a -- "text" --> b\n  a ==> b\n  b -.- a\n  a --x b\n  a --o b\n  b <--> a'
  const d = layout(src)

  it('clips each link to its blocks and offsets an arrow end by 4px', () => {
    const e = d.edges[0]!
    expect(e.id).toBe('1-a-b')
    expect(e.points.map((p) => p.x)).toEqual([
      e.points[0]!.x,
      e.points[1]!.x,
      e.points[2]!.x,
    ])
    const [a, b] = d.nodes
    expect(e.points[0]!.x).toBeCloseTo(a!.x + a!.width / 2, 6)
    expect(e.points[2]!.x).toBeCloseTo(b!.x - b!.width / 2, 6)
    expect(e.path).toMatch(/^M[\d.]+,0L[\d.]+,0C.*L[\d.]+,0$/)
    expect(
      e.path.endsWith(`L${Math.round((e.points[2]!.x - 4) * 1000) / 1000},0`),
    ).toBe(true)
    expect(e.labelX).toBeCloseTo((a!.x + b!.x) / 2, 6)
  })

  it('numbers repeated links and reads thickness, pattern and markers', () => {
    expect(d.edges.map((e) => e.id)).toEqual([
      '1-a-b',
      '2-a-b',
      '1-b-a',
      '3-a-b',
      '4-a-b',
      '2-b-a',
    ])
    expect(d.edges[1]).toMatchObject({
      thickness: 'thick',
      arrowTypeEnd: 'arrow_point',
    })
    expect(d.edges[2]).toMatchObject({
      pattern: 'dotted',
      arrowTypeEnd: '',
      arrowTypeStart: 'arrow_open',
    })
    expect(d.edges[3]!.arrowTypeEnd).toBe('arrow_cross')
    expect(d.edges[4]!.arrowTypeEnd).toBe('arrow_circle')
    expect(d.edges[5]).toMatchObject({
      arrowTypeStart: 'arrow_point',
      arrowTypeEnd: 'arrow_point',
    })
  })

  it('draws paths, markers and a label', () => {
    const svg = renderMermaidSVG(src)
    expect(svg.match(/class="edge-path/g)).toHaveLength(6)
    expect(svg).toMatch(/marker-end="url\(#[\w-]*block-pointEnd\)"/)
    expect(svg).toMatch(/marker-start="url\(#[\w-]*block-pointStart\)"/)
    expect(svg).toMatch(/marker-end="url\(#[\w-]*block-crossEnd\)"/)
    expect(svg).toMatch(/marker-end="url\(#[\w-]*block-circleEnd\)"/)
    expect(svg).toContain('class="edge-path thick"')
    expect(svg).toContain('class="edge-path dotted"')
    expect(svg).toContain('>text</text>')
  })

  it('widens the drawing for a long label', () => {
    const wide = layout(
      'block-beta\n  a space b\n  a -- "a very long label that sticks out of the frame" --> b',
    )
    const plain = layout('block-beta\n  a space b\n  a --> b')
    expect(wide.viewBox.width).toBeGreaterThan(plain.viewBox.width)
  })
})
