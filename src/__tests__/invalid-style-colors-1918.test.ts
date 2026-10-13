import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

// An invalid `fill` / `stroke` / `color` value used to be copied into the SVG
// as `fill="notacolor"`, which a browser paints black (or strokes as none).
// Mermaid ignores the bad declaration, so we do too (#1918).

const BAD = /notacolor|rgb\(x\)|#12345/

// Marker ids carry a per-render random prefix.
const norm = (svg: string) => svg.replace(/\bzm[a-z0-9]+-/g, 'zm-')

const FLOW = 'flowchart LR\n  A[Hello] --> B[World]\n'

describe('invalid colours are ignored in every style placement (#1918)', () => {
  const cases: Array<[string, string]> = [
    ['flowchart style fill', FLOW + '  style A fill:notacolor'],
    ['flowchart style fill rgb(x)', FLOW + '  style A fill:rgb(x)'],
    ['flowchart style fill 5-digit hex', FLOW + '  style A fill:#12345'],
    ['flowchart style stroke', FLOW + '  style A stroke:notacolor'],
    ['flowchart style color', FLOW + '  style A color:notacolor'],
    [
      'flowchart classDef',
      FLOW + '  classDef hot fill:notacolor\n  class A hot',
    ],
    ['flowchart classDef default', FLOW + '  classDef default fill:notacolor'],
    ['flowchart linkStyle index', FLOW + '  linkStyle 0 stroke:notacolor'],
    [
      'flowchart linkStyle default',
      FLOW + '  linkStyle default stroke:notacolor',
    ],
    [
      'state classDef',
      'stateDiagram-v2\n  Idle --> Busy\n  classDef hot fill:notacolor\n  class Idle hot',
    ],
    [
      'class style',
      'classDiagram\n  class A\n  class B\n  A --> B\n  style A fill:notacolor',
    ],
    [
      'class classDef',
      'classDiagram\n  class A\n  class B\n  A --> B\n  classDef hot fill:notacolor,color:notacolor\n  cssClass "A" hot',
    ],
  ]

  it.each(cases)('%s', async (_name, source) => {
    const svg = await renderMermaidSVG(source)
    expect(svg).not.toMatch(BAD)
  })

  it('drops only the bad declaration and keeps the rest of the rule', async () => {
    const svg = await renderMermaidSVG(
      FLOW + '  style A fill:#ff0000,stroke:notacolor,stroke-width:4px',
    )
    expect(svg).toContain('fill="#ff0000"')
    expect(svg).toContain('stroke-width="4px"')
    expect(svg).not.toContain('notacolor')
    // The stroke falls back to the theme border, not to "none".
    expect(svg).toMatch(
      /<rect[^>]*fill="#ff0000"[^>]*stroke="var\(--_node-stroke\)"/,
    )
  })

  it('keeps a valid linkStyle and tints its arrow marker', async () => {
    const svg = await renderMermaidSVG(
      FLOW + '  linkStyle 0 stroke:#d33,stroke-width:3px',
    )
    expect(svg).toContain('stroke="#d33"')
    expect(svg).toContain('stroke-width="3px"')
  })

  it('does not tint an arrow marker for a bad linkStyle stroke', async () => {
    const good = await renderMermaidSVG(FLOW + '  linkStyle 0 stroke:#d33')
    const bad = await renderMermaidSVG(FLOW + '  linkStyle 0 stroke:notacolor')
    const plain = await renderMermaidSVG(FLOW)
    expect(norm(good)).not.toBe(norm(plain))
    expect(norm(bad)).toBe(norm(plain))
  })

  it('renders an ignored declaration exactly like the diagram without it', async () => {
    const withBad = await renderMermaidSVG(
      FLOW +
        '  style A fill:notacolor,stroke:rgb(x)\n  linkStyle 0 stroke:notacolor',
    )
    expect(norm(withBad)).toBe(norm(await renderMermaidSVG(FLOW)))
  })

  it.each([
    'fill:#fff',
    'fill:red',
    'fill:rgb(255 0 0 / 50%)',
    'fill:hsl(120deg 100% 50%)',
    'fill:oklch(0.5 0.2 120)',
    'fill:transparent',
    'fill:none',
    'fill:var(--accent)',
    'stroke:#00ff0080',
    'color:currentColor',
  ])('still paints the valid value %s', async (decl) => {
    const [prop, ...rest] = decl.split(':')
    const value = rest.join(':')
    const svg = await renderMermaidSVG(FLOW + `  style A ${decl}`)
    const attr = prop === 'color' ? 'fill' : prop
    expect(svg).toContain(`${attr}="${value}"`)
  })
})
