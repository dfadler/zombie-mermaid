import { describe, expect, it } from 'vitest'
import { parseRequirementDiagram } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../../../../src/index.ts'
import {
  layoutRequirementDiagramSync,
  REQUIREMENT,
} from '../requirement/layout.ts'
import { trebuchetKerning } from '../requirement/kerning.ts'

const BASIC = `requirementDiagram
requirement test_req {
id: 1
text: the test text.
risk: high
verifymethod: test
}
element test_entity {
type: simulation
}
test_entity - satisfies -> test_req`

const layout = (src: string, direction?: 'LR' | 'RL' | 'BT') =>
  layoutRequirementDiagramSync(parseRequirementDiagram(src), { direction })

describe('requirement layout', () => {
  // Numbers from mermaid@12.3.0 rendering BASIC: 157.73 x 184 and 138.1 x 112
  // boxes, 104px apart, in a 173.73 x 416 view box.
  it('sizes boxes and the canvas as Mermaid does', () => {
    const d = layout(BASIC)
    const req = d.nodes.find((n) => n.id === 'test_req')!
    const el = d.nodes.find((n) => n.id === 'test_entity')!
    expect(req.width).toBeCloseTo(157.73, 0)
    expect(req.height).toBe(184)
    expect(el.width).toBeCloseTo(138.1, 0)
    expect(el.height).toBe(112)
    expect(req.y - (el.y + el.height)).toBe(104)
    expect(d.width).toBeCloseTo(173.73, 0)
    expect(d.height).toBe(416)
    expect(req.dividerY).toBe(req.y + 68)
  })

  // Box centres (viewBox origin at 0,0, so minus the 4px margin) read from
  // mermaid@12.3.0, which lays requirement diagrams out with ELK (#2966).
  const BOX = (id: string) =>
    `requirement ${id} {\nid: ${id}\ntext: t${id}\nrisk: low\nverifymethod: test\n}`
  const centres = (rels: string[], ids: string[]) => {
    const d = layout(
      `requirementDiagram\n${ids.map(BOX).join('\n')}\n${rels.join('\n')}`,
    )
    return {
      d,
      at: (id: string) => {
        const n = d.nodes.find((x) => x.id === id)!
        return [n.x + n.width / 2, n.y + n.height / 2] as const
      },
    }
  }

  it.each([
    [
      'shared targets (a diamond)',
      [
        'a - contains -> b',
        'a - contains -> c',
        'd - satisfies -> b',
        'd - satisfies -> c',
      ],
      ['a', 'b', 'c', 'd'],
      { a: [111.7, 100], b: [167.8, 408], c: [353.1, 408], d: [409.2, 100] },
      [518.51, 508],
    ],
    [
      'two relationships between one pair',
      ['a - contains -> b', 'a - contains -> b'],
      ['a', 'b'],
      { a: [111.7, 100], b: [111.7, 388] },
      [222.69, 488],
    ],
    [
      'a cycle',
      ['a - contains -> b', 'b - contains -> a'],
      ['a', 'b'],
      { a: [111.7, 100], b: [111.7, 388] },
      [222.69, 488],
    ],
  ] as const)(
    'puts boxes where Mermaid does: %s',
    (_n, rels, ids, want, size) => {
      const { d, at } = centres([...rels], [...ids])
      for (const [id, [x, y]] of Object.entries(want)) {
        expect(at(id)[0]).toBeCloseTo(x, 0)
        expect(at(id)[1]).toBeCloseTo(y, 0)
      }
      expect(d.width).toBeCloseTo(size[0], 0)
      expect(d.height).toBeCloseTo(size[1], 0)
    },
  )

  it('draws a box with no properties as just its two rows, with no divider', () => {
    const d = layout('requirementDiagram\nrequirement r {\n}')
    expect(d.nodes[0]).toMatchObject({ height: 68, rows: [] })
    expect(d.nodes[0]!.dividerY).toBeUndefined()
  })

  it('runs against the arrow for BT and across for LR / RL', () => {
    const src = BASIC
    const top = (d: ReturnType<typeof layout>, id: string) =>
      d.nodes.find((n) => n.id === id)!
    const bt = layout(src, 'BT')
    expect(top(bt, 'test_entity').y).toBeGreaterThan(top(bt, 'test_req').y)
    const lr = layout(src, 'LR')
    expect(top(lr, 'test_req').x).toBeGreaterThan(top(lr, 'test_entity').x)
    const rl = layout(src, 'RL')
    expect(top(rl, 'test_req').x).toBeLessThan(top(rl, 'test_entity').x)
  })

  it('lets a `direction` statement choose, and the render option override it', () => {
    const lr = `${BASIC}\ndirection LR`
    expect(layout(lr).width).toBeGreaterThan(layout(lr).height)
    expect(layout(lr, 'BT').height).toBeGreaterThan(layout(lr, 'BT').width)
  })

  it('loops a self-relationship out of the left side', () => {
    const d = layout(
      'requirementDiagram\nrequirement r {\n}\nr - contains -> r',
    )
    const e = d.edges[0]!
    const box = d.nodes[0]!
    expect(e.points[0]!.x).toBe(box.x)
    expect(e.points[1]!.x).toBe(box.x - REQUIREMENT.loopOut)
    expect(e.labelPoint.x).toBeLessThan(e.points[1]!.x)
    // 278.55 wide in mermaid@12.3.0.
    expect(d.width).toBeCloseTo(278.55, 0)
  })

  it('is an empty 16px canvas for no boxes', () => {
    expect(layout('requirementDiagram')).toEqual({
      width: 16,
      height: 16,
      nodes: [],
      edges: [],
    })
  })

  it('kerns text as the browser does', () => {
    expect(trebuchetKerning('Te')).toBeLessThan(0)
    expect(trebuchetKerning('Te', true)).toBeLessThan(0)
    expect(trebuchetKerning('ab')).toBe(0)
  })
})

describe('requirement SVG', () => {
  it('draws the boxes, text, divider, line, arrow and label', () => {
    const svg = renderMermaidSVG(BASIC)
    expect(svg).toContain('data-id="test_req"')
    expect(svg).toContain('&lt;&lt;Requirement&gt;&gt;')
    expect(svg).toContain('&lt;&lt;Element&gt;&gt;')
    expect(svg).toContain('Text: the test text.')
    expect(svg).toContain('Verification: Test')
    expect(svg).toContain('Type: simulation')
    expect(svg).toContain('&lt;&lt;satisfies&gt;&gt;')
    // One divider (the element has a body too: two).
    expect(
      svg.match(/stroke-width="[\d.]+" \/>\n<\/g>|<line x1/g),
    ).not.toBeNull()
    expect(svg.match(/<line /g)).toHaveLength(2)
    expect(svg).toContain('stroke-dasharray="10 7"')
    expect(svg).toContain('data-type="satisfies"')
  })

  it('draws `contains` solid with a circle-plus and no arrow', () => {
    const svg = renderMermaidSVG(
      'requirementDiagram\nrequirement a {\n}\nrequirement b {\n}\na - contains -> b',
    )
    expect(svg).not.toContain('stroke-dasharray')
    expect(svg).toContain('<circle')
    // The two plus strokes, and no dividers (no body rows).
    expect(svg.match(/<line /g)).toHaveLength(2)
  })

  it('escapes names and text', () => {
    const svg = renderMermaidSVG(
      'requirementDiagram\nrequirement "a<b>&c" {\ntext: "x<y"\n}',
    )
    expect(svg).toContain('a&lt;b&gt;&amp;c')
    expect(svg).not.toContain('a<b>')
  })

  it('applies classDef, class and style, and a safe class name', () => {
    const svg = renderMermaidSVG(
      'requirementDiagram\nclassDef big fill:#ff0,stroke:#f00,color:#00f\n' +
        'requirement a:::big {\nid: 1\n}\nrequirement b {\n}\nstyle b fill:#0f0',
    )
    expect(svg).toContain('class="requirement-node big"')
    expect(svg).toMatch(/fill="#ff0" stroke="#f00"/)
    expect(svg).toContain('fill="#00f"')
    expect(svg).toContain('fill="#0f0"')
  })

  it('applies styles in source order and keeps every class (mermaid 12.3.0)', () => {
    const src = (body: string) =>
      'requirementDiagram\nrequirement a:::c1,c2 {\nid: 1\n}\n' + body
    // Mermaid 12.3.0: `style` before `class` loses, after it wins; classDef
    // defined after the class still lands at its own position.
    const before = renderMermaidSVG(
      src('style a fill:#00f\nclassDef c1 fill:#f00,stroke:#0f0\nclass a c1'),
    )
    expect(before).toContain('class="requirement-node c1 c2 c1"')
    expect(before).toMatch(/fill="#f00" stroke="#0f0"/)
    const after = renderMermaidSVG(
      src('classDef c1 fill:#f00\nclass a c1\nstyle a fill:#00f'),
    )
    expect(after).toMatch(/fill="#00f"/)
    const late = renderMermaidSVG(
      src('style a fill:#00f\nclassDef c2 fill:#f00'),
    )
    expect(late).toMatch(/fill="#f00"/)
  })

  it('drops an unsafe class name from the class attribute', () => {
    const svg = renderMermaidSVG(
      'requirementDiagram\nrequirement a:::9x,ok {\n}',
    )
    expect(svg).toContain('class="requirement-node ok"')
  })

  it('rounds relationship corners (mermaid 12.3.0 L/Q path)', () => {
    const svg = renderMermaidSVG(
      'requirementDiagram\nrequirement a {\n}\nrequirement b {\n}\nrequirement c {\n}\n' +
        'a - contains -> b\na - contains -> c',
    )
    expect(svg).toMatch(
      /<path class="requirement-relationship"[^>]* d="M[\d.,]+L[\d.,]+Q[\d.,]+ [\d.,]+L/,
    )
    expect(svg).not.toContain('<polyline class="requirement-relationship"')
  })

  it('draws a front matter title', () => {
    expect(renderMermaidSVG('---\ntitle: My Reqs\n---\n' + BASIC)).toContain(
      'My Reqs',
    )
  })

  it('names the root for assistive tech from accTitle', () => {
    const svg = renderMermaidSVG(
      'requirementDiagram\naccTitle: Reqs\nrequirement a {\n}',
    )
    expect(svg).toContain('Reqs')
  })

  it('throws a parse error for a relationship to nothing', () => {
    expect(() =>
      renderMermaidSVG(
        'requirementDiagram\nrequirement a {\n}\na - traces -> z',
      ),
    ).toThrow(/unknown "z"/)
  })
})
