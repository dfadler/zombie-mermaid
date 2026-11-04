// ============================================================================
// ASCII ER entity table (issue #2630)
//
// Mermaid 12.3.0 draws an entity as a centred name over a grid: one column per
// attribute part (type, name, keys, comment), a divider between columns and a
// divider between rows. Class boxes share drawMultiBox, which is untouched.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import {
  drawEntityTable,
  measureEntityTable,
  tableRuleRows,
} from '../er-table.ts'

const lines = (c: string[][]): string[] =>
  c[0]!.map((_, y) => c.map((col) => col[y]!).join(''))

describe('ER entity table (issue #2630)', () => {
  it('draws columns, row rules and a centred name', () => {
    const out = renderMermaidASCII(
      'erDiagram\n  T {\n    string scope\n    string installPath\n  }',
      { colorMode: 'none' },
    )
    expect(
      out
        .trimEnd()
        .split('\n')
        .map((l) => l.trimEnd()),
    ).toEqual([
      '┌──────────────────────┐',
      '│          T           │',
      '├────────┬─────────────┤',
      '│ string │ scope       │',
      '├────────┼─────────────┤',
      '│ string │ installPath │',
      '└────────┴─────────────┘',
    ])
  })

  it('uses + and | in ASCII-only mode, with no junction in the top border', () => {
    const out = renderMermaidASCII('erDiagram\n  T {\n    int a PK\n  }', {
      colorMode: 'none',
      useAscii: true,
    })
    expect(
      out
        .trimEnd()
        .split('\n')
        .map((l) => l.trimEnd()),
    ).toEqual([
      '+--------------+',
      '|      T       |',
      '+-----+---+----+',
      '| int | a | PK |',
      '+-----+---+----+',
    ])
  })

  it('draws a header-only entity as a plain box', () => {
    const t = { header: ['AB'], rows: [] }
    expect(measureEntityTable(t)).toEqual({ width: 6, height: 3 })
    expect(lines(drawEntityTable(t, false))).toEqual([
      '┌────┐',
      '│ AB │',
      '└────┘',
    ])
    expect(tableRuleRows(t).size).toBe(0)
  })

  it('stretches the last column when the name is wider than the grid', () => {
    const t = { header: ['VERY_LONG_NAME'], rows: [['a', 'b']] }
    const out = lines(drawEntityTable(t, false))
    expect(out[0]).toHaveLength(measureEntityTable(t).width)
    expect(out[2]).toMatch(/^├───┬─+┤$/)
  })

  it('centres every line of a multi-line name', () => {
    const t = { header: ['AAAA', 'B'], rows: [['x', 'y']] }
    expect(lines(drawEntityTable(t, false)).slice(0, 4)).toEqual([
      '┌───────┐',
      '│ AAAA  │',
      '│   B   │',
      '├───┬───┤',
    ])
  })

  it('adds blank lines inside the last row and reports the rule rows', () => {
    const t = {
      header: ['T'],
      rows: [
        ['a', 'b'],
        ['c', 'd'],
      ],
      padLines: 2,
    }
    expect(measureEntityTable(t).height).toBe(9) // 1 name + 3 rules/borders + 3 row lines + 2 pad
    expect([...tableRuleRows(t)]).toEqual([2, 4])
  })

  it('keeps wide characters in their own cells', () => {
    const out = lines(
      drawEntityTable({ header: ['T'], rows: [['日本', 'b']] }, false),
    )
    expect(out[3]).toBe('│ 日本 │ b │')
    expect(out[3]!.length).toBeLessThanOrEqual(out[0]!.length)
  })

  it('keeps a relationship line off the row rules beside a shorter entity', () => {
    const out = renderMermaidASCII(
      `erDiagram
        direction LR
        A ||--o{ B : has
        A {
          int id PK
          string name
        }
        B {
          int id PK
        }`,
      { colorMode: 'none' },
    )
    const row = out.split('\n').find((l) => l.includes('╟'))!
    expect(row).toMatch(/^│ int/)
  })
})
