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

describe('block styling', () => {
  const src =
    'block-beta\n  columns 2\n  a b\n  classDef k fill:#66f,stroke:#33a,color:#fff\n  classDef m stroke:#f00\n  class a k\n  class a m\n  style b fill:#969, color:#000\n  block:g\n    c\n  end\n  style g fill:#eee,stroke:#f00\n  style c url(x):y'

  it('merges classDef and style items per property and moves color to the label', () => {
    const d = layout(src)
    const css = (id: string) => d.nodes.find((n) => n.id === id)!.css
    expect(css('a')).toEqual([
      ['fill', '#66f'],
      ['stroke', '#f00'],
      ['color', '#fff'],
    ])
    expect(css('b')).toEqual([
      ['fill', '#969'],
      ['color', '#000'],
    ])
  })

  it('writes inline styles, classes and label colours', () => {
    const svg = renderMermaidSVG(src)
    expect(svg).toContain('<g class="node k m">')
    expect(svg).toContain('style="fill:#66f !important;stroke:#f00 !important"')
    expect(svg).toContain('style="fill:#eee;stroke:#f00;"')
    expect(svg).toContain('style="fill:#fff"')
    expect(svg).not.toContain('url(x)')
  })

  it('drops declarations that are not plain', () => {
    const d = layout(
      'block-beta\n  a\n  style a fill:url(http://x/y),stroke:red,@bad:1,color:expression(1)',
    )
    expect(d.nodes[0]!.css).toEqual([['stroke', 'red']])
  })

  it('sizes blocks and gaps by block.padding', () => {
    const wide = layout(
      '%%{init: {"block": {"padding": 20}}}%%\nblock-beta\n  columns 2\n  a("r") b',
    )
    const plain = layout('block-beta\n  columns 2\n  a("r") b')
    const [a, b] = wide.nodes
    expect(a!.height).toBe(24 + 40)
    expect(a!.width).toBe(b!.width)
    expect(b!.x - a!.x).toBe(b!.width + 20)
    expect(wide.viewBox.width).toBeGreaterThan(plain.viewBox.width)
  })

  describe('shapes and block arrows (Mermaid 12.3.0 figures, "Label" = 38.867px)', () => {
    const one = (decl: string, more = '') =>
      layout(`block-beta\n  columns 1\n  ${decl}${more}`).nodes[0]!
    // Text widths here are Trebuchet advances, within a pixel of the browser's (see known-differences).
    const size = (n: { width: number; height: number }) => [
      Math.round(n.width),
      Math.round(n.height),
    ]

    it('sizes each shape by what Mermaid draws', () => {
      expect(size(one('a{"Label"}'))).toEqual([79, 79])
      expect(size(one('a{{"Label"}}'))).toEqual([63, 32])
      expect(size(one('a[["Label"]]'))).toEqual([63, 32])
      expect(size(one('a[/"Label"/]'))).toEqual([79, 32])
      expect(size(one('a[\\"Label"/]'))).toEqual([95, 40])
      expect(size(one('a<["Label"]>(right)'))).toEqual([67, 40])
    })

    it('keeps a circle and a diamond at their own size in a wider cell and stretches the polygons', () => {
      const wide = (decl: string) =>
        layout(
          `block-beta\n  columns 1\n  ${decl}\n  b["a much wider block here"]`,
        ).nodes[0]!
      const circle = wide('a(("Label"))')
      expect(circle.geometry!.kind).toBe('circle')
      expect(circle.geometry!.r).toBeCloseTo(26.843, 1)
      expect(circle.width).toBeGreaterThan(200)
      const hex = wide('a{{"Label"}}')
      const xs = hex.geometry!.points!.map((p) => p.x)
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(209.328, 0)
    })

    it('draws a double circle 5px wider than its inner ring, and a wide cell grows both', () => {
      const d = layout('block-beta\n  a((("Label")))')
      const g = d.nodes[0]!.geometry!
      expect(g.r! - g.inner!).toBe(5)
      expect(g.r).toBeCloseTo(48.843, 1)
      expect(d.viewBox.width).toBeCloseTo(107.687, 0)
      const wide = layout(
        'block-beta\n  columns 1\n  a((("Label")))\n  b["a much wider block here"]',
      ).nodes[0]!
      expect(wide.geometry!.r).toBeCloseTo(117.664, 0)
    })

    it('clips a link to the shape, not to its cell', () => {
      const d = layout('block-beta\n  a(("x")) space b\n  a --> b')
      const [a] = d.nodes
      expect(d.edges[0]!.points[0]!.x).toBeCloseTo(a!.x + a!.geometry!.r!, 3)
      // On a diagonal the rectangle's corner is farther from the centre than the rim.
      const diag = layout(
        'block-beta\n  columns 2\n  a(("x")) b\n  c d\n  a --> d',
      )
      const p = diag.edges[0]!.points[0]!
      const n = diag.nodes[0]!
      expect(Math.hypot(p.x - n.x, p.y - n.y)).toBeCloseTo(n.geometry!.r!, 3)
      const cyl = layout('block-beta\n  a[("x")] space b\n  a --> b')
      expect(cyl.edges[0]!.points[0]!.x).toBeGreaterThan(cyl.nodes[0]!.x)
    })

    it('draws a polygon, a circle, a path and a label for each kind', () => {
      const svg = renderMermaidSVG(
        'block-beta\n  columns 3\n  a{"x"} b(("y")) c[("z")]\n  d((("w"))) e<["go"]>(right) f(["s"])',
      )
      expect(svg).toContain('<polygon class="label-container"')
      expect(svg).toContain('<circle class="label-container"')
      expect(svg).toContain('class="outer-circle label-container"')
      expect(svg).toContain('class="inner-circle"')
      expect(svg).toContain('<path class="label-container" d="M0,')
      expect(svg).toContain('class="node shape-block_arrow"')
      expect(svg).toContain('>go</text>')
    })

    it('puts styles on the shape and the colour on the label', () => {
      const svg = renderMermaidSVG(
        'block-beta\n  a{"x"}\n  style a fill:#f00,color:#fff',
      )
      expect(svg).toContain('style="fill:#f00 !important"')
      expect(svg).toContain('style="fill:#fff"')
    })

    it('draws a block arrow spanning columns across them, and the other directions as lists', () => {
      const span = layout(
        'block-beta\n  columns 3\n  a<["x"]>(right):3\n  b c d',
      ).nodes[0]!
      const xs = span.geometry!.points!.map((p) => p.x)
      // The arrow's own width is the cell's: its tip is at the right edge of the cell.
      expect(Math.max(...xs)).toBeCloseTo(span.width / 2, 3)
      const every = (list: string) =>
        one(`a<["Label"]>(${list})`).geometry!.points!.length
      expect(every('right, left, up, down')).toBe(16)
      expect(every('right, left')).toBe(10)
      expect(every('up, down')).toBe(10)
      expect(every('x')).toBe(10)
      expect(every('y')).toBe(10)
      expect(every('right')).toBe(9)
      expect(every('left')).toBe(7)
      expect(every('up')).toBe(7)
      expect(every('down')).toBe(7)
      expect(every('right, up')).toBe(3)
      expect(every('right, down')).toBe(3)
      expect(every('left, up')).toBe(3)
      expect(every('left, down')).toBe(3)
      expect(every('right, left, up')).toBe(6)
      expect(every('right, left, down')).toBe(4)
      expect(every('right, up, down')).toBe(4)
      expect(every('left, up, down')).toBe(4)
      // "right " keeps its space and names nothing, so only "down" counts, as in Mermaid.
      expect(every('right down')).toBe(7)
    })
  })

  describe('links in every direction', () => {
    // A 3x3 grid with the shape in the middle, linked to its eight neighbours in both
    // directions, so every side, corner and marker offset of the clipping runs.
    const ring = (centre: string) =>
      `block-beta\n  columns 3\n  a b c\n  d ${centre} f\n  g h i\n` +
      ['a', 'b', 'c', 'd', 'f', 'g', 'h', 'i']
        .flatMap((n) => [`e ${'<-->'} ${n}`, `${n} --x e`, `e --o ${n}`])
        .join('\n')
        .replace(/^/, '  ')
        .replace(/\n/g, '\n  ')

    for (const centre of [
      'e[("db")]',
      'e(("c"))',
      'e{{"hex"}}',
      'e[/"lean"/]',
      'e<["go"]>(x, y)',
      'e["plain"]',
    ]) {
      it(`clips every link around ${centre} onto the shape's outline`, () => {
        const d = layout(ring(centre))
        const mid = d.nodes.find((n) => n.id === 'e')!
        expect(d.edges.length).toBe(24)
        for (const e of d.edges) {
          for (const p of e.points)
            expect(Number.isFinite(p.x + p.y)).toBe(true)
          const [first, , last] = e.points
          const ends = [first!, last!]
          // One end of each link is on the middle block's outline, within its extent.
          const near = ends.some(
            (p) =>
              Math.abs(p.x - mid.x) <= mid.width / 2 + 40 &&
              Math.abs(p.y - mid.y) <= mid.height / 2 + 40,
          )
          expect(near).toBe(true)
        }
        expect(renderMermaidSVG(ring(centre))).toContain('marker-start=')
      })
    }
  })
})
