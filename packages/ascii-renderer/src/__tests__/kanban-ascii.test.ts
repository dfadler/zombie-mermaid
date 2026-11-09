/**
 * Kanban ASCII/Unicode rendering: column blocks, card boxes, metadata rows,
 * wrapping and charsets. Whole-output goldens live in testdata/*\/kanban_*.txt.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

describe('kanban ASCII', () => {
  it('frames a column and boxes its cards, naming priority in the border', () => {
    expect(
      render(
        'kanban\n  Todo\n    a[One]@{ priority: High, ticket: T-1, assigned: bob }',
      ),
    ).toBe(
      [
        '┌──────────────┐',
        '│     Todo     │',
        '├──────────────┤',
        '│ ┌─ High ───┐ │',
        '│ │ One      │ │',
        '│ │ T-1  bob │ │',
        '│ └──────────┘ │',
        '└──────────────┘',
      ].join('\n'),
    )
  })

  it('uses plain characters in ASCII mode', () => {
    expect(render('kanban\n  A\n    [x]', true)).toBe(
      [
        '+-------+',
        '|   A   |',
        '+-------+',
        '| +---+ |',
        '| | x | |',
        '| +---+ |',
        '+-------+',
      ].join('\n'),
    )
  })

  it('wraps long card text at 40 columns', () => {
    const out = render(`kanban\n  A\n    [${'word '.repeat(20)}]`)
    for (const row of out.split('\n'))
      expect(row.length).toBeLessThanOrEqual(48)
    expect(out.split('\n').length).toBeGreaterThan(8)
  })

  it('paints headings in colour modes', () => {
    const out = renderMermaidASCII('kanban\n  A', { colorMode: 'truecolor' })
    expect(out).toContain('\u001b[')
  })
})
