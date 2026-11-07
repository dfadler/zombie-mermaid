/**
 * Class edges: rounded bends (#2852) and markerless `--` / `..` links (#2771),
 * both as measured in mermaid@12.3.0 (radius 5, `Q` corner; no marker on a
 * plain link).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '../index.ts'

const rel = (svg: string) =>
  [...svg.matchAll(/<path class="class-relationship"[^>]*>/g)].map((m) => m[0])

describe('class edge corners', () => {
  const svg = renderMermaidSVG(
    'classDiagram\n A <|-- B\n A <|-- C\n C --> D\n B --> D',
  )
  it('draws edges as <path> with a Q fillet, not a <polyline>', () => {
    expect(svg).not.toContain('<polyline class="class-relationship"')
    // Fillet starts 5*sqrt(2) before the corner (the Q control point)
    const fillets = rel(svg).flatMap((p) =>
      [...p.matchAll(/L ([\d.]+) ([\d.]+) Q ([\d.]+) ([\d.]+),/g)].map((m) =>
        Math.hypot(+m[1]! - +m[3]!, +m[2]! - +m[4]!),
      ),
    )
    expect(fillets.length).toBeGreaterThan(0)
    expect(Math.max(...fillets)).toBeCloseTo(5 * Math.SQRT2, 1)
  })
})

describe('plain class links draw no marker', () => {
  it.each([
    ['--', 'solid'],
    ['..', 'dashed'],
  ])('%s: no marker, %s line, cardinalities parsed', (arrow, kind) => {
    const svg = renderMermaidSVG(`classDiagram\n A "1" ${arrow} "2" B`)
    const [p] = rel(svg)
    expect(p).toBeDefined()
    expect(p).not.toMatch(/marker-(start|end)/)
    expect(p!.includes('stroke-dasharray')).toBe(kind === 'dashed')
  })

  it('still draws the marker on --> and ..>', () => {
    const svg = renderMermaidSVG('classDiagram\n A --> B\n C ..> D')
    expect(rel(svg).every((p) => p.includes('marker-end'))).toBe(true)
  })

  it.each([
    'classDiagram\n A -- B\n B -- C\n C -- A',
    'classDiagram\n B -- A\n A -- C\n C .. B',
    'classDiagram\n A -- B\n A -- C\n A -- D\n B .. D\n C -- D',
    'classDiagram\n A -- B\n B -- C\n C -- D\n D -- A\n A .. C',
    'classDiagram\n D -- A\n C -- A\n A -- A',
  ])('ASCII: no arrowhead in any routing shape (%#)', (src) => {
    for (const dir of ['TB', 'BT', 'LR', 'RL']) {
      const [head, ...rest] = src.split('\n')
      const out = renderMermaidASCII(
        [head, ` direction ${dir}`, ...rest].join('\n'),
      )
      expect(out).not.toMatch(/[v^<>]/)
    }
  })

  it('ASCII: no arrowhead glyph on a plain link', () => {
    const plain = renderMermaidASCII('classDiagram\n A -- B')
    const arrow = renderMermaidASCII('classDiagram\n A --> B')
    expect(arrow).toMatch(/^\s*v\s*$/m)
    expect(plain).not.toMatch(/^\s*v\s*$/m)
    const lr = renderMermaidASCII('classDiagram\n direction LR\n A -- B')
    expect(lr).not.toContain('>')
    expect(
      renderMermaidASCII('classDiagram\n direction LR\n A --> B'),
    ).toContain('>')
  })
})
