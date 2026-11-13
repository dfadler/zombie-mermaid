/**
 * #2635: orthogonal edge bends are rounded, as in mermaid@12.3.0 (measured:
 * each bend starts 5·√2 px before the routed corner, as a quadratic fillet).
 * #2636: a flowchart subgraph has a centred title and no header band; a state
 * composite keeps its band.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'
import { MERMAID_CORNER_RADIUS, roundedPath } from '../edge-curves.ts'

const R = MERMAID_CORNER_RADIUS

describe('roundedPath (#2635)', () => {
  it('fillets a bend 5·√2 px either side of the corner', () => {
    const d = roundedPath(
      [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ],
      R,
    )
    expect(d).toBe('M 0 0 L 0 92.93 Q 0 100, 7.07 100 L 100 100')
  })

  it('never consumes more than half a short leg', () => {
    const d = roundedPath(
      [
        { x: 0, y: 0 },
        { x: 0, y: 6 },
        { x: 50, y: 6 },
      ],
      R,
    )
    expect(d).toContain('L 0 3 Q 0 6, 3 6')
  })

  it('draws a two-point edge straight', () => {
    expect(
      roundedPath(
        [
          { x: 1, y: 2 },
          { x: 1, y: 9 },
        ],
        R,
      ),
    ).toBe('M 1 2 L 1 9')
  })
})

describe('edge elements (#2635)', () => {
  const src =
    'flowchart TD\n  A --> B\n  A --> C\n  B --> D\n  C --> D\n  A --> D'
  it('draws every default edge as a <path> and a bend as a Q fillet', () => {
    const svg = renderMermaidSVG(src)
    expect(svg).not.toContain('<polyline')
    expect(svg.match(/<path class="edge"/g)).toHaveLength(5)
    expect(svg).toMatch(/<path class="edge"[^>]* d="[^"]* Q /)
    expect(svg).not.toMatch(/ d="[^"]* C /)
  })
})

describe('subgraph title (#2636)', () => {
  const sub = 'flowchart TD\n  subgraph one [First Title]\n    A --> B\n  end'
  const state =
    'stateDiagram-v2\n  [*] --> Active\n  state Active {\n    [*] --> Idle\n  }'

  it('draws one rect and a centred, regular-weight title', () => {
    const svg = renderMermaidSVG(sub)
    const g = svg.match(/<g class="subgraph"[\s\S]*?<\/g>/)![0]
    expect(g.match(/<rect/g)).toHaveLength(1)
    const rect = /<rect x="([\d.-]+)" y="[\d.-]+" width="([\d.-]+)"/.exec(g)!
    const cx = Number(rect[1]) + Number(rect[2]) / 2
    expect(g).toMatch(
      new RegExp(
        `<text x="${cx}"[^>]*text-anchor="middle"[^>]*font-weight="400"`,
      ),
    )
    expect(g).toContain('First Title')
  })

  it('marks nested flowchart subgraphs alike', () => {
    const svg = renderMermaidSVG(
      'flowchart TD\n  subgraph o [Out]\n    subgraph i [In]\n      A\n    end\n  end',
    )
    expect(svg.match(/<g class="subgraph"/g)).toHaveLength(2)
    expect(svg.match(/<rect[^>]*fill="var\(--_group-hdr\)"/g)).toBeNull()
  })

  it('keeps the header band on a state composite, with a centred regular title (#2651)', () => {
    const svg = renderMermaidSVG(state)
    const g = svg.match(/<g class="subgraph"[\s\S]*?<\/g>/)![0]
    expect(g.match(/<rect/g)).toHaveLength(2)
    const title = g.match(/<text[^>]*>/)![0]
    expect(title).toContain('text-anchor="middle"')
    expect(title).toContain('font-weight="400"')
    const [, x = '0', w = '0'] = g.match(
      /<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/,
    )!
    expect(title).toContain(`x="${+(+x + +w / 2).toFixed(2)}"`)
  })
})

describe('state composite as mermaid@12.3.0 draws it (#2651)', () => {
  const src =
    'stateDiagram-v2\n  [*] --> Active\n  state Active {\n    [*] --> Idle\n    Idle --> Busy\n    Busy --> Idle\n  }\n  Active --> [*]'
  const svg = renderMermaidSVG(src)
  const g = svg.match(/<g class="subgraph"[\s\S]*?<\/g>/)![0]
  const nums = (re: RegExp, s: string) => [...s.matchAll(re)].map((m) => +m[1]!)

  it('rounds the outer rect and insets the body 4px from its bottom edge', () => {
    const [outer, body] = g.match(/<rect[^>]*>/g)!
    expect(outer).toContain('rx="5"')
    expect(body).toContain('rx="0"')
    const yh = (r: string) => [
      Number(/ y="([\d.]+)"/.exec(r)![1]),
      Number(/ height="([\d.]+)"/.exec(r)![1]),
    ]
    const [oy = 0, oh = 0] = yh(outer!)
    const [by = 0, bh = 0] = yh(body!)
    expect(by).toBe(oy + 26)
    expect(by + bh).toBe(oy + oh - 4)
  })

  it('keeps a cycle in source order: Idle above Busy, 14px start dots, 136px boxes', () => {
    const y = (id: string) =>
      Number(
        /<rect x="[\d.]+" y="([\d.]+)"/.exec(
          svg.slice(svg.indexOf(`data-id="${id}"`)),
        )![1],
      )
    expect(y('Idle')).toBeLessThan(y('Busy'))
    expect(
      nums(/<circle[^>]* r="([\d.]+)" fill="var\(--_text\)"/g, svg)[0],
    ).toBe(7)
    expect(svg).toMatch(/<rect[^>]* width="136" height="40"/)
  })

  it('spaces it like mermaid: 184x217 box, 24px between the inner states, 40px above', () => {
    const [outer] = g.match(/<rect[^>]*>/g)!
    expect(outer).toContain('width="184" height="217"')
    const ys = [
      ...svg.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="136" height="40"/g),
    ]
    expect(Number(ys[1]![1]) - Number(ys[0]![1]) - 40).toBe(24)
    const dot =
      /data-id="_start"[^>]*>\s*<circle cx="[\d.]+" cy="([\d.]+)" r="7"/.exec(
        svg,
      )!
    expect(
      Number(/ y="([\d.]+)"/.exec(outer!)![1]) - (Number(dot[1]) + 7),
    ).toBe(40)
  })
})
