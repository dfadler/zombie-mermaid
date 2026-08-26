/**
 * Regression tests for issue #66 — ASCII renderer box borders misaligned by
 * CJK/fullwidth-form characters.
 *
 * The ASCII grid is column-major with one grid cell per JS code point, but
 * CJK/kana/hangul/fullwidth-form/emoji characters occupy one grid cell while
 * rendering as TWO columns in a real monospace terminal. Left unhandled,
 * this makes box borders too narrow for wide-character labels.
 *
 * `terminalDisplayWidth` below re-implements the "how many terminal columns
 * does this string occupy" calculation independently of
 * `src/ascii/display-width.ts`, so these tests verify the *rendered output*
 * against an authority separate from the implementation under test — not
 * just that the fix's own helper agrees with itself.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

/**
 * Independently re-implemented terminal display-width calculation (mirrors
 * the East Asian Width ranges a real monospace terminal uses to decide
 * whether a code point renders as 1 or 2 columns). Deliberately does not
 * import from `src/ascii/display-width.ts` or `src/text-metrics.ts`.
 */
const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u

function terminalDisplayWidth(text: string): number {
  let width = 0
  for (const ch of text) {
    const code = ch.codePointAt(0)!
    const isWide =
      (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
      (code >= 0x2e80 && code <= 0xa4cf) || // CJK radicals .. Yi
      (code >= 0xac00 && code <= 0xd7a3) || // Hangul syllables
      (code >= 0xf900 && code <= 0xfaff) || // CJK compatibility ideographs
      (code >= 0xff00 && code <= 0xff60) || // Fullwidth forms
      (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth signs
      code >= 0x20000 || // CJK extension B+
      EMOJI_PATTERN.test(ch)
    width += isWide ? 2 : 1
  }
  return width
}

/** All rendered lines should occupy the same number of terminal columns. */
function assertUniformDisplayWidth(ascii: string): void {
  const lines = ascii.split('\n')
  const widths = lines.map(terminalDisplayWidth)
  const expected = widths[0]
  for (let i = 0; i < lines.length; i++) {
    expect(
      widths[i],
      `line ${i} (${JSON.stringify(lines[i])}) has display width ${widths[i]}, expected ${expected}`,
    ).toBe(expected)
  }
}

describe('ASCII renderer — CJK/fullwidth character box alignment (issue #66)', () => {
  const mermaid = 'flowchart TD\n    A[日本語テスト] --> B[終了]'

  for (const useAscii of [false, true]) {
    describe(useAscii ? 'ASCII charset' : 'Unicode charset', () => {
      it('renders the issue repro with all rows sharing one terminal display width', () => {
        const ascii = renderMermaidASCII(mermaid, {
          useAscii,
          colorMode: 'none',
        })
        assertUniformDisplayWidth(ascii)
      })

      it('sizes the label box wide enough for the CJK label content', () => {
        const ascii = renderMermaidASCII(mermaid, {
          useAscii,
          colorMode: 'none',
        })
        const lines = ascii.split('\n')

        const labelLineIndex = lines.findIndex((l) =>
          l.includes('日本語テスト'),
        )
        expect(labelLineIndex).toBeGreaterThanOrEqual(0)
        const labelLine = lines[labelLineIndex]!

        // The border directly above the label line delimits the box width.
        const borderLine = lines[labelLineIndex - 1]!
        expect(borderLine.length).toBeGreaterThan(0)

        // The label row and its border must occupy the same terminal width —
        // that is the concrete manifestation of "borders line up".
        expect(terminalDisplayWidth(labelLine)).toBe(
          terminalDisplayWidth(borderLine),
        )

        // The label's own display width (6 fullwidth glyphs = 12 columns)
        // must fit inside the box's interior (border width minus the two
        // vertical border characters).
        const boxDisplayWidth = terminalDisplayWidth(borderLine)
        const labelDisplayWidth = terminalDisplayWidth('日本語テスト')
        expect(labelDisplayWidth).toBe(12)
        expect(boxDisplayWidth).toBeGreaterThanOrEqual(labelDisplayWidth + 2)
      })

      it('keeps the box vertical borders in the same column on every row', () => {
        const ascii = renderMermaidASCII(mermaid, {
          useAscii,
          colorMode: 'none',
        })
        const lines = ascii.split('\n')
        const vChar = useAscii ? '|' : '│'

        const labelLineIndex = lines.findIndex((l) =>
          l.includes('日本語テスト'),
        )
        const labelLine = lines[labelLineIndex]!
        const blankLineAbove = lines[labelLineIndex - 2]! // top padding row

        // The right border character's *string* index differs between the
        // CJK row and an all-ASCII row in the same box (because the CJK row
        // has fewer code units for the same display width) — but the
        // terminal-column index of the right border must match.
        const cjkRightBorderCol = terminalDisplayWidth(
          labelLine.slice(0, labelLine.lastIndexOf(vChar)),
        )
        const blankRightBorderCol = terminalDisplayWidth(
          blankLineAbove.slice(0, blankLineAbove.lastIndexOf(vChar)),
        )
        expect(cjkRightBorderCol).toBe(blankRightBorderCol)
      })

      it('does not introduce diagonal or otherwise-broken box characters', () => {
        const ascii = renderMermaidASCII(mermaid, {
          useAscii,
          colorMode: 'none',
        })
        expect(ascii).not.toContain('/')
        expect(ascii).not.toContain('\\')
      })
    })
  }

  it('handles mixed ASCII + CJK content in the same label', () => {
    const ascii = renderMermaidASCII(
      'flowchart TD\n    A[Hello 世界] --> B[OK]',
      { colorMode: 'none' },
    )
    assertUniformDisplayWidth(ascii)
    expect(ascii).toContain('Hello 世界')
  })

  it('handles emoji labels', () => {
    const ascii = renderMermaidASCII(
      'flowchart TD\n    A[🎉 Party] --> B[Done]',
      {
        colorMode: 'none',
      },
    )
    assertUniformDisplayWidth(ascii)
  })

  it('handles CJK edge labels without breaking column alignment', () => {
    const ascii = renderMermaidASCII(
      'flowchart TD\n    A[Start] -->|日本語ラベル| B[End]',
      { colorMode: 'none' },
    )
    assertUniformDisplayWidth(ascii)
    expect(ascii).toContain('日本語ラベル')
  })

  it('handles CJK labels on non-rectangle shapes (diamond, stadium)', () => {
    const ascii = renderMermaidASCII(
      'flowchart TD\n    A{決定} --> B(("結果"))\n    A --> C([スタジアム])',
      { colorMode: 'none' },
    )
    assertUniformDisplayWidth(ascii)
  })

  it('handles a CJK subgraph title', () => {
    const ascii = renderMermaidASCII(
      'flowchart TD\n    subgraph サブグラフ\n      A[Node] --> B[Node2]\n    end',
      { colorMode: 'none' },
    )
    assertUniformDisplayWidth(ascii)
    expect(ascii).toContain('サブグラフ')
  })
})
