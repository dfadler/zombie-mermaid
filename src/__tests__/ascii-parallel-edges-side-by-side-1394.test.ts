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
  it('SVG: draws both edges as separate paths', () => {
    const svg = renderMermaidSVG(twice)
    expect(svg.match(/<path class="edge"/g)).toHaveLength(2)
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

  // #1716: three labeled edges used to take lanes whose last two met in one
  // junction and one arrowhead. The nodes now widen and the gap grows so each
  // gets its own stroke, arrowhead and label row.
  it('ASCII: three labeled edges each get a stroke and an arrowhead (#1716)', () => {
    const out = ascii(
      'graph TD\n  A -->|one| B\n  A -->|two| B\n  A -->|three| B',
    )
    expect(out.match(/▼/g)).toHaveLength(3)
    expect(out.match(/[┬┴]/g)).toHaveLength(3)
    for (const label of ['one', 'two', 'three']) expect(out).toContain(label)
    expect(out).not.toContain('◄')
  })

  it('ASCII: a label too wide to sit between its neighbours takes the flow-face lanes (#2736)', () => {
    const out = ascii(
      'graph TD\n  A -->|first| B\n  A -->|second| B\n  A -->|third| B',
    )
    // Each edge keeps a port and arrowhead of its own on the top face.
    expect(out).not.toContain('◄')
    expect(out.match(/▼/g)).toHaveLength(3)
  })

  it('ASCII: three lanes plus a reciprocal edge keep separate arrowheads (#1743)', () => {
    const out = ascii(
      'graph TD\n  A -->|first| B\n  A -->|second| B\n  A -->|third| B\n  B -->|back| A',
    )
    // Four edges in all: each takes a port on the facing faces (#2645).
    expect(out.match(/▼/g)).toHaveLength(3)
    expect(out.match(/▲/g)).toHaveLength(1)
    expect(out).not.toContain('◄')
  })

  it('ASCII: three labeled edges in LR each get a row and an arrowhead (#1716)', () => {
    const out = ascii(
      'graph LR\n  A -->|one| B\n  A -->|two| B\n  A -->|three| B',
    )
    expect(out.match(/►/g)).toHaveLength(3)
    expect(out).not.toContain('▲')
  })

  it('ASCII: three edges that fit are spread over three columns', () => {
    const out = ascii(
      'graph TD\n  Alpha --> Beta\n  Alpha --> Beta\n  Alpha --> Beta',
    )
    expect(out).toContain('▼ ▼ ▼')
  })

  it.each([4, 5])(
    'ASCII: %i labeled edges each get an arrowhead (#1716)',
    (n) => {
      const edges = Array.from({ length: n }, (_, i) => `  A -->|e${i}| B`)
      for (const dir of ['TD', 'LR']) {
        const out = ascii(`graph ${dir}\n${edges.join('\n')}`)
        expect(out.match(dir === 'TD' ? /▼/g : /►/g)).toHaveLength(n)
        for (let i = 0; i < n; i++) expect(out).toContain(`e${i}`)
      }
    },
  )

  it('ASCII: labels of exactly 3 cells spread, 4 cells take the flow-face lanes', () => {
    const three = ascii(
      'graph TD\n  A -->|abc| B\n  A -->|def| B\n  A -->|ghi| B',
    )
    expect(three.match(/▼/g)).toHaveLength(3)
    expect(three).not.toContain('◄')
    const four = ascii(
      'graph TD\n  A -->|abcd| B\n  A -->|efgh| B\n  A -->|ijkl| B',
    )
    expect(four).not.toContain('◄')
    expect(four.match(/▼/g)).toHaveLength(3)
  })

  it('ASCII: a spread group with a node above it still gets its own strokes', () => {
    const td = ascii(
      'graph TD\n  X --> A\n  A -->|a| B\n  A -->|b| B\n  A -->|c| B',
    )
    expect(td.match(/▼/g)).toHaveLength(4)
    const lr = ascii(
      'graph LR\n  X --> A\n  A -->|a| B\n  A -->|b| B\n  A -->|c| B',
    )
    expect(lr.match(/►/g)).toHaveLength(4)
  })
})
