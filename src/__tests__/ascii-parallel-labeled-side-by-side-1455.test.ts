/**
 * #1455: labeled parallel edges are drawn side by side too (as the SVG does).
 * Vertical labels stagger onto their own rows so neighbours never overprint;
 * a group with more label lines than gap rows keeps the side lanes.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const ascii = (src: string): string =>
  renderMermaidASCII(src, { colorMode: 'none' })

const td = 'graph TD\n  A -->|one| B\n  A -->|two| B'
const lr = 'graph LR\n  A -->|one| B\n  A -->|two| B'

describe('labeled parallel edges side by side (#1455)', () => {
  it('SVG: draws both labeled edges as separate polylines', () => {
    expect(renderMermaidSVG(td).match(/<polyline class="edge"/g)).toHaveLength(
      2,
    )
  })

  it('ASCII TD: two strokes, labels staggered onto separate rows', () => {
    expect(ascii(td)).toBe(
      [
        '┌─────┐',
        '│     │',
        '│  A  │',
        '│     │',
        '└─┬─┬─┘',
        '  │ │  ',
        '  │two ',
        ' one│  ',
        '  │ │  ',
        '  ▼ ▼  ',
        '┌─────┐',
        '│     │',
        '│  B  │',
        '│     │',
        '└─────┘',
      ].join('\n'),
    )
  })

  it('ASCII LR: each label sits on its own stroke', () => {
    expect(ascii(lr)).toBe(
      [
        '┌───┐     ┌───┐',
        '│   ├─one►│   │',
        '│ A │     │ B │',
        '│   ├─two►│   │',
        '└───┘     └───┘',
      ].join('\n'),
    )
  })

  it('ASCII TD: a labeled and an unlabeled edge both keep a stroke', () => {
    const out = ascii('graph TD\n  A -->|one| B\n  A --> B')
    expect(out).toContain('▼ ▼')
    expect(out).toContain('one')
  })

  it('ASCII TD: a multi-line label that cannot stagger keeps the lane', () => {
    const out = ascii('graph TD\n  A -->|a<br/>b<br/>c| B\n  A -->|two| B')
    expect(out).toContain('◄')
  })
})
