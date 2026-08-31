/**
 * Regression tests for issue #334 — sequence-diagram participant boxes and
 * message labels don't account for double-width CJK characters, so box
 * borders no longer line up with their content once the diagram contains
 * Japanese/Korean/Chinese text.
 *
 * This is the same bug class already fixed for flowchart boxes (#66,
 * `ascii-cjk-width.test.ts`) and class/ER boxes (#182,
 * `ascii-multibox-cjk-width.test.ts`) — `src/ascii/sequence.ts` measured and
 * wrote actor-box content, message labels, block headers/dividers, and note
 * content by UTF-16 code unit (`.length` / per-code-unit `for` loops)
 * instead of the display-width-aware helpers in `src/ascii/display-width.ts`
 * (`displayWidth` / `toDisplayCells`), which `maxLineWidth`
 * (`multiline-utils.ts`) already used correctly for *sizing* — only the
 * *drawing* loops were the gap.
 *
 * Width is measured with `terminalDisplayWidth`, an oracle independently
 * re-implemented from `src/ascii/display-width.ts` (see the shared helper's
 * own doc comment), so these tests verify rendered output against an
 * authority separate from the implementation under test.
 *
 * NOTE on the Unicode-charset arrowhead glyphs (▶ ◀ ◁ ▷): these are
 * pre-existing, unrelated to #334, and out of scope here. `isWideChar`
 * (text-metrics.ts) treats any `\p{Extended_Pictographic}` code point as
 * double-width, which also matches these geometric-shape arrowheads even
 * though their Unicode East Asian Width property is "Ambiguous" (narrow in
 * a default terminal locale) — so a row containing one of them measures one
 * column wider than an otherwise-identical row without one, in *every*
 * Unicode-charset sequence diagram, CJK or not. `assertUniformDisplayWidth`
 * (used unmodified by the flowchart/class/ER suites, which draw ASCII
 * `>`/`<`/`^`/`v` arrowheads instead) would spuriously fail on any arrow row
 * here, so this file measures specific row pairs instead of whole-diagram
 * uniformity, and separately guards that only arrowhead-glyph rows are ever
 * the odd one out.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'
import { terminalDisplayWidth } from './helpers/terminal-display-width.ts'

const ARROWHEAD_GLYPHS = ['▶', '◀', '◁', '▷']

/** True if `line` contains one of the ambiguous-width arrowhead glyphs. */
function hasArrowheadGlyph(line: string): boolean {
  return ARROWHEAD_GLYPHS.some((g) => line.includes(g))
}

/**
 * Every rendered row shares one terminal display width, *except* rows
 * containing an arrowhead glyph (see the file-level doc comment) — those
 * are allowed to be exactly one column wider than the rest.
 */
function assertUniformWidthIgnoringArrowheads(ascii: string): void {
  const lines = ascii.split('\n')
  const widths = lines.map(terminalDisplayWidth)
  const plainWidths = widths.filter((_, i) => !hasArrowheadGlyph(lines[i]!))
  const expected = plainWidths[0]
  for (let i = 0; i < lines.length; i++) {
    const allowance = hasArrowheadGlyph(lines[i]!) ? 1 : 0
    expect(
      widths[i],
      `line ${i} (${JSON.stringify(lines[i])}) has display width ${widths[i]}, expected ${expected} (+${allowance} allowed for an arrowhead glyph)`,
    ).toBe(expected! + allowance)
  }
}

/**
 * Find the line containing `needle` and the line directly above it, and
 * assert they occupy the same terminal display width — the direct
 * manifestation of "border lines up with its own content" that the issue
 * reports (border 28 columns vs. content 33 columns for the exact repro).
 */
function assertContentMatchesBorderAbove(ascii: string, needle: string): void {
  const lines = ascii.split('\n')
  const contentIndex = lines.findIndex((l) => l.includes(needle))
  expect(contentIndex).toBeGreaterThan(0)
  const contentLine = lines[contentIndex]!
  const borderLine = lines[contentIndex - 1]!
  expect(
    terminalDisplayWidth(contentLine),
    `content row ${JSON.stringify(contentLine)} vs. border row ${JSON.stringify(borderLine)}`,
  ).toBe(terminalDisplayWidth(borderLine))
}

describe('ASCII sequence diagrams — CJK/wide-char box alignment (issue #334)', () => {
  for (const useAscii of [false, true]) {
    describe(useAscii ? 'ASCII charset' : 'Unicode charset', () => {
      // Exact repro from the issue body.
      const mermaid =
        'sequenceDiagram\n  participant A as アリス\n  participant B as ボブ\n  A->>B: こんにちは'

      it('renders the issue repro with every row sharing one display width (up to arrowheads)', () => {
        const ascii = renderMermaidASCII(mermaid, {
          useAscii,
          colorMode: 'none',
        })
        assertUniformWidthIgnoringArrowheads(ascii)
      })

      it('aligns the header participant box border with its CJK content', () => {
        const ascii = renderMermaidASCII(mermaid, {
          useAscii,
          colorMode: 'none',
        })
        assertContentMatchesBorderAbove(ascii, 'アリス')
      })

      it('aligns the footer participant box border with its CJK content', () => {
        const ascii = renderMermaidASCII(mermaid, {
          useAscii,
          colorMode: 'none',
        })
        const lines = ascii.split('\n')
        // The footer box repeats the same label — its content row is the
        // *last* line containing it, not the header's (first) occurrence.
        const contentIndex = lines
          .map((l) => l.includes('アリス'))
          .lastIndexOf(true)
        expect(contentIndex).toBeGreaterThan(0)
        expect(terminalDisplayWidth(lines[contentIndex]!)).toBe(
          terminalDisplayWidth(lines[contentIndex - 1]!),
        )
      })

      it('centers the CJK message label between lifelines without widening its row', () => {
        const ascii = renderMermaidASCII(mermaid, {
          useAscii,
          colorMode: 'none',
        })
        const lines = ascii.split('\n')
        const labelIndex = lines.findIndex((l) => l.includes('こんにちは'))
        expect(labelIndex).toBeGreaterThan(0)
        // Neighboring lifeline-only rows (blank rows immediately above/below
        // the label) share the same fixed canvas width and contain no
        // arrowhead glyph — a direct, quirk-free comparison.
        const blankAbove = lines[labelIndex - 1]!
        expect(terminalDisplayWidth(lines[labelIndex]!)).toBe(
          terminalDisplayWidth(blankAbove),
        )
      })

      it('does not corrupt the label text itself', () => {
        const ascii = renderMermaidASCII(mermaid, {
          useAscii,
          colorMode: 'none',
        })
        expect(ascii).toContain('アリス')
        expect(ascii).toContain('ボブ')
        expect(ascii).toContain('こんにちは')
      })
    })
  }

  it('handles a mixed CJK + Latin actor name', () => {
    const mermaid =
      'sequenceDiagram\n  participant A as Aliceさん\n  participant B as Bob\n  A->>B: hi'
    const ascii = renderMermaidASCII(mermaid, { colorMode: 'none' })
    assertUniformWidthIgnoringArrowheads(ascii)
    assertContentMatchesBorderAbove(ascii, 'Aliceさん')
  })

  it('handles a CJK self-message label without corrupting the canvas', () => {
    const mermaid =
      'sequenceDiagram\n  participant A as アリス\n  A->>A: 独り言のテスト'
    const ascii = renderMermaidASCII(mermaid, { colorMode: 'none' })
    assertUniformWidthIgnoringArrowheads(ascii)
    expect(ascii).toContain('独り言のテスト')
  })

  it('handles a CJK label inside an alt block without breaking the block wall', () => {
    const mermaid =
      'sequenceDiagram\n  participant A as アリス\n  participant B as ボブ\n  alt 条件が真の場合\n    A->>B: メッセージ\n  end'
    const ascii = renderMermaidASCII(mermaid, { colorMode: 'none' })
    assertUniformWidthIgnoringArrowheads(ascii)
    expect(ascii).toContain('条件が真の場合')
  })

  it('handles a CJK divider label inside an alt block', () => {
    const mermaid =
      'sequenceDiagram\n  participant A as アリス\n  participant B as ボブ\n  alt 場合A\n    A->>B: one\n  else 場合B\n    A->>B: two\n  end'
    const ascii = renderMermaidASCII(mermaid, { colorMode: 'none' })
    assertUniformWidthIgnoringArrowheads(ascii)
    expect(ascii).toContain('場合B')
  })

  it('aligns a CJK note box border with its content', () => {
    const mermaid =
      'sequenceDiagram\n  participant A as アリス\n  Note over A: 重要なメモです'
    const ascii = renderMermaidASCII(mermaid, { colorMode: 'none' })
    assertContentMatchesBorderAbove(ascii, '重要なメモです')
  })

  it('leaves the common all-ASCII case intact', () => {
    // Guard against the fix perturbing diagrams with no wide characters —
    // uses the ignoring-arrowheads helper since the Unicode charset still
    // draws an ambiguous-width arrowhead glyph even for plain-ASCII labels.
    const mermaid =
      'sequenceDiagram\n  participant Alice\n  participant Bob\n  Alice->>Bob: hello'
    for (const useAscii of [false, true]) {
      const ascii = renderMermaidASCII(mermaid, { useAscii, colorMode: 'none' })
      assertUniformWidthIgnoringArrowheads(ascii)
      expect(ascii).toContain('Alice')
      expect(ascii).toContain('Bob')
      expect(ascii).toContain('hello')
    }
  })
})
