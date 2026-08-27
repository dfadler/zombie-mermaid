/**
 * Independently re-implemented terminal display-width calculation, shared by
 * the ASCII wide-character regression suites (issues #66 and #182).
 *
 * Deliberately does NOT import from `src/ascii/display-width.ts` or
 * `src/text-metrics.ts`: these suites verify rendered output against an
 * authority separate from the implementation under test, so that a bug in the
 * renderer's own width helper cannot make its tests pass by agreeing with
 * itself. Mirrors the East Asian Width ranges a real monospace terminal uses
 * to decide whether a code point renders as 1 or 2 columns.
 */
import { expect } from 'vitest'

const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u

/** Number of terminal columns `text` occupies. */
export function terminalDisplayWidth(text: string): number {
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
export function assertUniformDisplayWidth(ascii: string): void {
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
