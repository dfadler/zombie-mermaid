/**
 * Regression tests for issue #205 — ASCII renderer box borders misaligned by
 * zero-width Unicode combining marks.
 *
 * `displayWidth()` used to add 1 column for every code point that isn't
 * "wide" (CJK etc), including combining marks (general categories Mn/Me,
 * e.g. U+0300–U+036F COMBINING ACUTE ACCENT). A real terminal gives such a
 * mark 0 columns — it attaches to the preceding base character. A decomposed
 * string like "café" (e + U+0301) used to measure as 5 columns; a real
 * terminal renders it as 4.
 *
 * `terminalDisplayWidth` re-implements the "how many terminal columns does
 * this string occupy" calculation independently of
 * `src/ascii/display-width.ts`, so these tests verify the *rendered output*
 * against an authority separate from the implementation under test.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'
import { displayWidth } from '../ascii/display-width.ts'
import {
  terminalDisplayWidth,
  assertUniformDisplayWidth,
} from './helpers/terminal-display-width.ts'

// "café", decomposed: c a f e + COMBINING ACUTE ACCENT (U+0301) — 5 code
// points, 4 grapheme clusters / terminal columns.
const DECOMPOSED_CAFE = 'caf' + 'e' + '́'

describe('ASCII renderer — combining mark box alignment (issue #205)', () => {
  it('displayWidth("café") (decomposed) is 4, not 5', () => {
    expect([...DECOMPOSED_CAFE].length).toBe(5)
    expect(displayWidth(DECOMPOSED_CAFE)).toBe(4)
    expect(terminalDisplayWidth(DECOMPOSED_CAFE)).toBe(4)
  })

  for (const useAscii of [false, true]) {
    describe(useAscii ? 'ASCII charset' : 'Unicode charset', () => {
      it('renders a flowchart node with a decomposed label at uniform row width', () => {
        const mermaid = `flowchart TD\n  A[${DECOMPOSED_CAFE}] --> B[ok]`
        const ascii = renderMermaidASCII(mermaid, {
          useAscii,
          colorMode: 'none',
        })
        assertUniformDisplayWidth(ascii)
        expect(ascii).toContain(DECOMPOSED_CAFE)
      })
    })
  }

  it('renders a class diagram compartment box with a decomposed member name at uniform width', () => {
    const mermaid = `classDiagram\n  class Person {\n    +String ${DECOMPOSED_CAFE}\n  }`
    const ascii = renderMermaidASCII(mermaid, { colorMode: 'none' })
    assertUniformDisplayWidth(ascii)
    expect(ascii).toContain(DECOMPOSED_CAFE)
  })

  it('renders an ER diagram compartment box with a decomposed attribute name at uniform width', () => {
    const mermaid = `erDiagram\n  ITEM {\n    string ${DECOMPOSED_CAFE}\n  }`
    const ascii = renderMermaidASCII(mermaid, { colorMode: 'none' })
    assertUniformDisplayWidth(ascii)
    expect(ascii).toContain(DECOMPOSED_CAFE)
  })

  it('does not perturb the all-ASCII case', () => {
    const ascii = renderMermaidASCII('flowchart TD\n  A[plain] --> B[ok]', {
      colorMode: 'none',
    })
    assertUniformDisplayWidth(ascii)
  })
})
