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
