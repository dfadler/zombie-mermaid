/**
 * Regression tests for issue #182 — `drawMultiBox` (the multi-compartment
 * boxes used by class and ER diagrams) measured and wrote text by UTF-16 code
 * unit rather than display width, the same bug class #66 fixed for the
 * single-box path.
 *
 * The fix has to cover three sites at once, which is why these tests exercise
 * whole rendered diagrams rather than `drawMultiBox` alone:
 *
 *   1. `drawMultiBox`'s own sizing and per-character write loop, and
 *   2/3. the box dimensions `class-diagram.ts` and `er-diagram.ts` each
 *        precompute to reserve grid space *before* drawing.
 *
 * Fixing only (1) would desync the drawn box from the space layout reserved
 * for it, so the multi-box grid cases below (wide-character and ASCII
 * siblings placed side by side) are the ones that would catch a partial fix.
 *
 * Width is measured with an oracle independent of `src/ascii/display-width.ts`
 * — see the shared helper.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'
import {
  terminalDisplayWidth,
  assertUniformDisplayWidth,
} from './helpers/terminal-display-width.ts'

/**
 * Assert that every border row and content row of a multi-compartment box
 * puts its right-hand vertical border in the same terminal column — the
 * direct symptom from the issue, content overflowing its own border.
 *
 * Only valid for single-box output: relationship connector lines also contain
 * the vertical border character without being a box edge.
 */
function assertBordersAligned(ascii: string, useAscii: boolean): void {
  const vChar = useAscii ? '|' : '│'
  const rows = ascii.split('\n').filter((l) => l.includes(vChar))
  expect(rows.length).toBeGreaterThan(0)

  const columns = rows.map((row) =>
    terminalDisplayWidth(row.slice(0, row.lastIndexOf(vChar))),
  )
  const expected = columns[0]
  for (let i = 0; i < rows.length; i++) {
    expect(
      columns[i],
      `row ${i} (${JSON.stringify(rows[i])}) has its right border at column ${columns[i]}, expected ${expected}`,
    ).toBe(expected)
  }
}

/**
 * Terminal-column gap between two boxes drawn side by side on the same row.
 *
 * This is the assertion that catches a *partial* fix. If `drawMultiBox` is
 * corrected but a caller still reserves grid space using code-unit widths,
 * the box drawn for wide-character content is wider than the space reserved
 * for it, and the surplus eats into the gap separating it from its neighbour
 * (and, for a wide enough box, into the neighbour itself). The rendered box
 * still looks well-formed, so only the spacing reveals the desync.
 */
function siblingGap(ascii: string, useAscii: boolean): number {
  // Matched on the top-border row rather than by corner character: in the
  // ASCII charset all four corners are '+', so there is no distinct
  // right-corner glyph to search for. Two runs of border characters
  // separated by spaces is unambiguous in both charsets.
  const border = useAscii ? '[+\\-]' : '[┌┐─]'
  const twoBoxes = new RegExp(`^\\s*(${border}+)(\\s+)(${border}+)`)

  for (const line of ascii.split('\n')) {
    const match = twoBoxes.exec(line)
    if (match) return terminalDisplayWidth(match[2]!)
  }

  expect.fail('expected a row containing two side-by-side box borders')
}

describe('ASCII renderer — wide characters in multi-compartment boxes (issue #182)', () => {
  for (const useAscii of [false, true]) {
    const charset = useAscii ? 'ASCII charset' : 'Unicode charset'

    describe(`class diagrams — ${charset}`, () => {
      it('keeps a CJK class box within its own border', () => {
        const ascii = renderMermaidASCII(
          'classDiagram\n  class Aクラス {\n    +名前 name\n    +取得する() void\n  }',
          { useAscii, colorMode: 'none' },
        )
        assertUniformDisplayWidth(ascii)
        assertBordersAligned(ascii, useAscii)
        expect(ascii).toContain('名前')
      })

      it('does not desync layout from drawing for wide/ASCII sibling boxes', () => {
        // Two boxes side by side on the same level: one wide-character, one
        // ASCII. A fix applied to drawMultiBox but not to class-diagram.ts's
        // own sizing pass would overlap or misalign these.
        const ascii = renderMermaidASCII(
          'classDiagram\n  class Base\n  class 子クラスA {\n    +属性値 v\n  }\n  class ChildB {\n    +value v\n  }\n  Base <|-- 子クラスA\n  Base <|-- ChildB',
          { useAscii, colorMode: 'none' },
        )
        assertUniformDisplayWidth(ascii)
        expect(ascii).toContain('子クラスA')
        expect(ascii).toContain('ChildB')

        // The wide-character box must be separated from its ASCII sibling by
        // the class renderer's full horizontal gap (hGap = 4). A caller still
        // reserving code-unit width narrows this instead.
        expect(siblingGap(ascii, useAscii)).toBe(4)
      })

      it('centers a CJK relationship label without overrunning', () => {
        const ascii = renderMermaidASCII(
          'classDiagram\n  class 動物 {\n    +名前 name\n  }\n  class 犬 {\n    +吠える() void\n  }\n  動物 <|-- 犬 : 継承する',
          { useAscii, colorMode: 'none' },
        )
        assertUniformDisplayWidth(ascii)
        expect(ascii).toContain('継承する')
      })

      it('handles a non-BMP (surrogate-pair) member without splitting it', () => {
        const ascii = renderMermaidASCII(
          'classDiagram\n  class Party {\n    +🎉🎉 confetti\n  }',
          { useAscii, colorMode: 'none' },
        )
        assertUniformDisplayWidth(ascii)
        // A code-unit write loop would emit lone surrogate halves into
        // adjacent cells; the pair must survive intact.
        expect(ascii).toContain('🎉🎉')
        expect(ascii).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
        expect(ascii).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
      })
    })

    describe(`ER diagrams — ${charset}`, () => {
      it('keeps a CJK entity box within its own border', () => {
        const ascii = renderMermaidASCII(
          'erDiagram\n  顧客 {\n    string 名前\n    int 年齢\n  }',
          { useAscii, colorMode: 'none' },
        )
        assertUniformDisplayWidth(ascii)
        assertBordersAligned(ascii, useAscii)
        expect(ascii).toContain('顧客')
      })

      it('does not desync layout from drawing for wide/ASCII sibling entities', () => {
        const ascii = renderMermaidASCII(
          'erDiagram\n  顧客 ||--o{ ORDER : places\n  顧客 {\n    string 名前\n  }\n  ORDER {\n    int number\n  }',
          { useAscii, colorMode: 'none' },
        )
        assertUniformDisplayWidth(ascii)
        expect(ascii).toContain('顧客')
        expect(ascii).toContain('ORDER')
      })

      it('places a CJK relationship label without breaking alignment', () => {
        const ascii = renderMermaidASCII(
          'erDiagram\n  顧客 ||--o{ 注文 : "発注する"\n  顧客 {\n    string 名前\n  }\n  注文 {\n    int 番号\n  }',
          { useAscii, colorMode: 'none' },
        )
        assertUniformDisplayWidth(ascii)
        expect(ascii).toContain('発注する')
      })
    })
  }

  it('leaves the common all-ASCII case intact', () => {
    // Guard against the fix perturbing diagrams with no wide characters.
    const single = renderMermaidASCII(
      'classDiagram\n  class Animal {\n    +String name\n    +eat() void\n  }',
      { colorMode: 'none' },
    )
    assertUniformDisplayWidth(single)
    assertBordersAligned(single, false)
    expect(single).toContain('+ name: String')

    const related = renderMermaidASCII(
      'classDiagram\n  class Animal {\n    +String name\n  }\n  class Dog\n  Animal <|-- Dog',
      { colorMode: 'none' },
    )
    assertUniformDisplayWidth(related)
    expect(related).toContain('Dog')
  })
})
