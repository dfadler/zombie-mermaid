// ============================================================================
// ASCII ER diagram: attribute comments render as a trailing quoted column
// (issue #2127). Mermaid shows `type | name | keys | comment`; the parser kept
// the comment but formatAttribute never read it.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string, useAscii = false) =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })

describe('ASCII ER attribute comments (issue #2127)', () => {
  const src = `erDiagram
    T {
      string a PK, FK "c"
      string nokey "plain comment"
      string b PK
    }`

  for (const useAscii of [false, true]) {
    it(`appends the quoted comment after the keys (useAscii=${useAscii})`, () => {
      const out = render(src, useAscii)
      expect(out).toContain('string a PK,FK "c"')
      expect(out).toContain('string nokey "plain comment"')
      expect(out).toContain('string b PK ')
      expect(out).not.toContain('PK "')
    })
  }

  it('turns <br> into a space so the row stays one line', () => {
    const out = render(`erDiagram
      T {
        int a "one<br>two"
      }`)
    expect(out).toContain('int a "one two"')
  })

  it('does not wrap a very long comment; the box grows instead, as in mermaid', () => {
    const long = 'word '.repeat(40).trim()
    const out = render(`erDiagram
      T {
        int a "${long}"
      }`)
    expect(out.split('\n').some((l) => l.includes(`int a "${long}"`))).toBe(
      true,
    )
  })

  it('leaves an empty comment out', () => {
    expect(render('erDiagram\n T {\n int a ""\n }')).not.toContain('""')
  })
})
