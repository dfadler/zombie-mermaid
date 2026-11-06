// ============================================================================
// ASCII ER diagram: attribute comments render as a trailing quoted column
// (issue #2127). Mermaid shows `type | name | keys | comment`, one grid column
// each (#2630), and only draws a column some attribute uses.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string, useAscii = false) =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })

/** Attribute rows of the first entity, one array of trimmed cells per row. */
const rows = (out: string): string[][] =>
  out
    .split('\n')
    .filter((l) => /^[│|].*[│|] *$/.test(l) && l.split(/[│|]/).length > 3)
    .map((l) =>
      l
        .split(/[│|]/)
        .slice(1, -1)
        .map((c) => c.trim()),
    )

describe('ASCII ER attribute comments (issue #2127)', () => {
  const src = `erDiagram
    T {
      string a PK, FK "c"
      string nokey "plain comment"
      string b PK
    }`

  for (const useAscii of [false, true]) {
    it(`draws the comment as the fourth column after the keys (useAscii=${useAscii})`, () => {
      expect(rows(render(src, useAscii))).toEqual([
        ['string', 'a', 'PK,FK', 'c'],
        ['string', 'nokey', '', 'plain comment'],
        ['string', 'b', 'PK', ''],
      ])
    })
  }

  it('turns <br> into a space so the row stays one line', () => {
    const out = render(`erDiagram
      T {
        int a "one<br>two"
      }`)
    expect(rows(out)).toEqual([['int', 'a', '', 'one two']])
  })

  it('does not wrap a very long comment; the box grows instead, as in mermaid', () => {
    const long = 'word '.repeat(40).trim()
    const out = render(`erDiagram
      T {
        int a "${long}"
      }`)
    expect(rows(out)).toEqual([['int', 'a', '', long]])
  })

  it('leaves an empty comment out', () => {
    expect(render('erDiagram\n T {\n int a ""\n }')).not.toContain('""')
  })
})
