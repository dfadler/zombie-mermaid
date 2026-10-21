// ============================================================================
// ASCII ER diagram: entities stack top to bottom like mermaid.js (issue #1917)
//
// mermaid.js (12.1.0 and 12.2.0, checked in a real browser) puts `A ||--o{ B`
// with A above B. The renderer used to pack entities into side-by-side rows.
// `direction LR` keeps the side-by-side packing.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { checkAll } from '../../../../__tests__/helpers/ascii-invariants.ts'

const row = (out: string, text: string) =>
  out.split('\n').findIndex((l) => l.includes(text))
const col = (out: string, text: string) =>
  out
    .split('\n')
    .find((l) => l.includes(text))!
    .indexOf(text)
const width = (out: string) => Math.max(...out.split('\n').map((l) => l.length))

const TWO = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        int id PK
        string name
    }
    ORDER {
        int id PK
    }`

describe('ASCII ER stacked layout (issue #1917)', () => {
  it('stacks the two entities of the issue sample, CUSTOMER above ORDER', () => {
    for (const useAscii of [false, true]) {
      const out = renderMermaidASCII(TWO, { useAscii })
      expect(row(out, 'CUSTOMER')).toBeLessThan(row(out, 'ORDER'))
      // ORDER is the narrower box, centered under CUSTOMER (#2237).
      expect(col(out, 'ORDER')).toBeGreaterThan(col(out, 'CUSTOMER'))
      expect(out).toContain('places')
    }
  })

  it('puts the declared first entity on top whichever way round it is written', () => {
    const out = renderMermaidASCII('erDiagram\n  ORDER }o--|| CUSTOMER : by')
    expect(row(out, 'ORDER')).toBeLessThan(row(out, 'CUSTOMER'))
  })

  it('keeps direction LR side by side', () => {
    const out = renderMermaidASCII(
      `erDiagram\n  direction LR\n${TWO.slice(10)}`,
    )
    expect(row(out, 'CUSTOMER')).toBe(row(out, 'ORDER'))
  })

  it('layers a chain and a diamond by depth, with the source pulled next to its target', () => {
    const out = renderMermaidASCII(
      'erDiagram\n  A ||--o{ B : x\n  B ||--o{ C : y\n  D ||--o{ C : z',
    )
    // mermaid: A, D in different layers than B; here A/D above B/C chain.
    expect(row(out, '│ A ')).toBeLessThan(row(out, '│ B '))
    expect(row(out, '│ B ')).toBeLessThan(row(out, '│ C '))
    expect(row(out, '│ D ')).toBeGreaterThan(row(out, '│ A '))
    expect(row(out, '│ D ')).toBeLessThan(row(out, '│ C '))
  })

  it('survives a relationship cycle and a self relationship', () => {
    const out = renderMermaidASCII(
      'erDiagram\n  A ||--o{ B : x\n  B ||--o{ A : y\n  A ||--o{ A : self',
    )
    expect(row(out, '│ A ')).toBeLessThan(row(out, '│ B '))
  })

  it('keeps width bounded: a hub with six children is no wider than three boxes', () => {
    const kids = 'ABCDEF'.split('')
    const src = `erDiagram\n${kids.map((k) => `  HUB ||--o{ ${k} : r`).join('\n')}`
    const out = renderMermaidASCII(src)
    const hubRow = row(out, 'HUB')
    expect(hubRow).toBeLessThan(row(out, '│ A '))
    // maxPerRow = ceil(sqrt(7)) = 3 children per row, not 6.
    expect(width(out)).toBeLessThan(3 * 20)
    expect(row(out, '│ D ')).toBeGreaterThan(row(out, '│ A '))
  })

  it('draws every relationship and passes the whole-canvas invariants', () => {
    for (const useAscii of [false, true]) {
      const out = renderMermaidASCII(
        `erDiagram
  USER ||--o{ POST : writes
  USER ||--o{ COMMENT : authors
  POST ||--o{ COMMENT : has
  POST }o--o{ TAG : tagged-with`,
        { useAscii },
      )
      for (const label of ['writes', 'authors', 'has', 'tagged-with']) {
        expect(out).toContain(label)
      }
      expect(checkAll(out, { unicode: !useAscii, skip: ['arms'] })).toEqual([])
    }
  })

  it('keeps a skip-layer relationship on-canvas', () => {
    const out = renderMermaidASCII(
      'erDiagram\n  A ||--o{ B : ab\n  B ||--o{ C : bc\n  A ||--o{ C : ac',
    )
    expect(out).toContain('ac')
    // The bypass is drawn: a vertical run beside B's right border.
    expect(out).toMatch(/│ B │+│/)
    expect(checkAll(out, { unicode: true, skip: ['arms'] })).toEqual([])
  })
})
