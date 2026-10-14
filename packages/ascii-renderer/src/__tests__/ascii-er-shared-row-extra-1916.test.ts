// ============================================================================
// Extra cases for the fix in #1913 (issue #1911), driven through the public
// renderer: a horizontal ER relationship lands on a row inside BOTH
// side-by-side entity boxes. ascii-er-shorter-entity-row-1911.test.ts covers a
// one-attribute short entity, the label and ASCII-only mode; this adds a bare
// short entity, either declaration order, a dashed line and equal heights.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { findBoxRect } from './helpers/ascii-form.ts'

const TALL = `CUSTOMER {
        int id PK
        string name
        string email
        string phone
        string address
    }`

/** Row index of the first line containing `glyph`. */
function rowOf(ascii: string, glyph: string): number {
  const y = ascii.split('\n').findIndex((l) => l.includes(glyph))
  expect(y, `"${glyph}" not found`).toBeGreaterThanOrEqual(0)
  return y
}

/** Assert `y` is a content row (not a top/bottom border) of `name`'s box. */
function expectInside(ascii: string, name: string, y: number): void {
  const r = findBoxRect(ascii, name)
  expect(y, `${name} spans rows ${r.y0}-${r.y1}`).toBeGreaterThan(r.y0)
  expect(y, `${name} spans rows ${r.y0}-${r.y1}`).toBeLessThan(r.y1)
}

describe('ER side-by-side relationship row (#1911 extra cases)', () => {
  it('attaches to a bare short entity beside a tall one', () => {
    const ascii = renderMermaidASCII(`erDiagram
    direction LR
    ${TALL}
    TAG
    CUSTOMER ||--o{ TAG : has`)
    const y = rowOf(ascii, '╟')
    expectInside(ascii, 'CUSTOMER', y)
    expectInside(ascii, 'TAG', y)
    // The label sits on the row below the line, in the gap.
    expect(rowOf(ascii, 'has')).toBe(y + 1)
  })

  it('attaches whichever way round the relationship is declared', () => {
    const ascii = renderMermaidASCII(`erDiagram
    direction LR
    TAG
    ${TALL}
    TAG }o--|| CUSTOMER : has`)
    const y = rowOf(ascii, '╟')
    expectInside(ascii, 'CUSTOMER', y)
    expectInside(ascii, 'TAG', y)
  })

  it('attaches a dashed (non-identifying) line the same way', () => {
    const ascii = renderMermaidASCII(`erDiagram
    direction LR
    ${TALL}
    TAG
    CUSTOMER ||..o{ TAG : has`)
    const y = rowOf(ascii, '╟')
    expectInside(ascii, 'CUSTOMER', y)
    expectInside(ascii, 'TAG', y)
  })

  it('keeps the vertical-centre row for equal-height entities', () => {
    const ascii = renderMermaidASCII(`erDiagram
    direction LR
    ${TALL}
    ORDER {
        int id PK
        string note
        string status
        string total
        string ship
    }
    CUSTOMER ||--o{ ORDER : places`)
    const c = findBoxRect(ascii, 'CUSTOMER')
    expect(rowOf(ascii, '╟')).toBe(c.y0 + Math.floor((c.y1 - c.y0 + 1) / 2))
  })
})
