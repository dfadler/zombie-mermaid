/**
 * #1713: `state x <<choice>>`, `<<fork>>` and `<<join>>` used to render as
 * ordinary rounded boxes labeled with their id. They are now an unlabeled
 * diamond (choice) and bar (fork/join), as in mermaid.js.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid, renderMermaidASCII, renderMermaidSVG } from '../index.ts'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'

const SRC = `stateDiagram-v2
    state f <<fork>>
    state j <<join>>
    state c <<choice>>
    [*] --> f
    f --> A
    f --> B
    A --> c
    c --> j
    B --> j
    j --> [*]`

describe('state choice/fork/join pseudo-states (#1713)', () => {
  it('maps the three kinds to an unlabeled diamond and bars', () => {
    const g = parseMermaid(SRC)
    expect(g.nodes.get('f')).toMatchObject({ shape: 'fork-join', label: '' })
    expect(g.nodes.get('j')).toMatchObject({ shape: 'fork-join', label: '' })
    expect(g.nodes.get('c')).toMatchObject({ shape: 'diamond', label: '' })
  })

  it('accepts the [[...]] spelling and any letter case', () => {
    const g = parseMermaid(
      'stateDiagram-v2\n  state c [[choice]]\n  state F <<FORK>>\n  [*] --> c\n  c --> F',
    )
    expect(g.nodes.get('c')!.shape).toBe('diamond')
    expect(g.nodes.get('F')!.shape).toBe('fork-join')
  })

  it('does not pin a declared pseudo-state ahead of the states it follows', () => {
    // The declarations come first in the source but the join must still lay
    // out below A and B, not above them.
    const g = layoutGraphSync(parseMermaid(SRC))
    const y = (id: string) => g.nodes.find((n) => n.id === id)!.y
    expect(y('f')).toBeLessThan(y('A'))
    expect(y('j')).toBeGreaterThan(y('A'))
    expect(y('j')).toBeGreaterThan(y('c'))
  })

  it('creates a declared pseudo-state that no transition mentions', () => {
    expect(
      parseMermaid('stateDiagram-v2\n  state c <<choice>>').nodes.get('c'),
    ).toMatchObject({ shape: 'diamond' })
  })

  it('SVG draws no id text and sizes the bar and diamond like mermaid.js', () => {
    const g = layoutGraphSync(parseMermaid(SRC))
    const size = (id: string) => {
      const n = g.nodes.find((x) => x.id === id)!
      return [n.width, n.height]
    }
    expect(size('f')).toEqual([70, 10])
    expect(size('c')).toEqual([28, 28])
    const svg = renderMermaidSVG(SRC)
    for (const id of ['f', 'j', 'c']) expect(svg).not.toContain(`>${id}<`)
    expect(svg).toContain('>A<')
  })

  it('ASCII draws a solid bar and an empty diamond, not id-labeled boxes', () => {
    const out = renderMermaidASCII(SRC)
    expect(out).toContain('█████████')
    expect(out).toContain('◇')
    expect(out).not.toMatch(/│\s+[fjc]\s+│/)
    expect(renderMermaidASCII(SRC, { useAscii: true })).toContain('#########')
  })
})
