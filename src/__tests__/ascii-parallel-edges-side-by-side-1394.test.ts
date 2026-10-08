/**
 * #1394: unlabeled parallel edges between two nodes stacked in one column are
 * drawn side by side on the same faces (as the SVG does) instead of one edge
 * taking a side lane. Cases that cannot fit keep the lane.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const ascii = (src: string): string =>
  renderMermaidASCII(src, { colorMode: 'none' })

const twice = 'graph TD\n  A --> B\n  A --> B'

describe('parallel edges side by side (#1394)', () => {
  it('SVG: draws both edges as separate polylines', () => {
    const svg = renderMermaidSVG(twice)
    expect(svg.match(/<polyline class="edge"/g)).toHaveLength(2)
  })

  it('ASCII: two strokes on the same faces', () => {
    expect(ascii(twice)).toBe(
      [
        '┌───┐',
        '│   │',
        '│ A │',
        '│   │',
        '└┬─┬┘',
        ' │ │ ',
        ' │ │ ',
        ' │ │ ',
        ' │ │ ',
        ' ▼ ▼ ',
        '┌───┐',
        '│   │',
        '│ B │',
        '│   │',
        '└───┘',
      ].join('\n'),
    )
  })

  it('ASCII: a reciprocal edge keeps the side lane', () => {
    const out = ascii('graph TD\n  A --> B\n  A --> B\n  B --> A')
    expect(out).toContain('◄┘')
  })

  it('ASCII: a labeled edge keeps the side lane', () => {
    const out = ascii('graph TD\n  A --> B\n  A -->|x| B')
    expect(out).toContain('◄┘')
  })

  it('ASCII: LR pair runs side by side on the facing sides', () => {
    expect(ascii('graph LR\n  A --> B\n  A --> B')).toBe(
      [
        '┌───┐     ┌───┐',
        '│   ├────►│   │',
        '│ A │     │ B │',
        '│   ├────►│   │',
        '└───┘     └───┘',
      ].join('\n'),
    )
  })

  it('ASCII: a chain onward from the target still spreads the pair', () => {
    expect(ascii('graph TD\n  A --> B\n  A --> B\n  B --> C')).toContain('▼ ▼')
    expect(ascii('graph TD\n  C --> A\n  A --> B\n  A --> B')).toContain('▼ ▼')
  })

  it('ASCII: another edge toward the partner keeps the side lane', () => {
    expect(ascii('graph TD\n  A --> B\n  A --> B\n  A --> C')).not.toContain(
      '▼ ▼',
    )
  })

  it('ASCII: nodes on different rows and columns keep the side lane', () => {
    const out = ascii(
      'graph TD\n  P --> A\n  P --> Q\n  Q --> B\n  A --> B\n  A --> B',
    )
    expect(out).toContain('└────┘')
    expect(out).not.toContain('▼ ▼')
  })

  it('ASCII: faces too narrow for the strokes keep the side lane', () => {
    const out = ascii('graph TD\n  A --> B\n  A --> B\n  A --> B')
    expect(out).not.toContain('▼ ▼ ▼')
    expect(out).toContain('◄')
  })

  it('ASCII: three edges that fit are spread over three columns', () => {
    const out = ascii(
      'graph TD\n  Alpha --> Beta\n  Alpha --> Beta\n  Alpha --> Beta',
    )
    expect(out).toContain('▼ ▼ ▼')
  })
})
