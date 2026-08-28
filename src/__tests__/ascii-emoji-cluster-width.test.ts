/**
 * Regression tests for issue #214 — ASCII renderer boxes several columns too
 * wide for composed emoji / grapheme clusters (ZWJ sequences, flags,
 * skin-tone modifiers).
 *
 * `displayWidth()` used to add up "wide" columns per JS code point rather
 * than per rendered grapheme cluster, so a multi-code-point emoji sequence —
 * which a real terminal renders as a single glyph occupying at most 2
 * columns — was counted once per code point:
 *
 *   | Input                    | Code points | old displayWidth | actual columns |
 *   |---------------------------|------------|-------------------|-----------------|
 *   | 👨‍👩‍👧 (ZWJ family)         | 5          | 8                 | 2               |
 *   | 🇺🇸 (regional indicators) | 2          | 4                 | 2               |
 *   | 👍🏽 (skin-tone modifier)  | 2          | 4                 | 2               |
 *   | 日本 (plain CJK, contrast) | 2          | 4                 | 4               |
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

// 👨‍👩‍👧 — MAN, ZWJ, WOMAN, ZWJ, GIRL (5 code points, 1 grapheme cluster).
const ZWJ_FAMILY = '\u{1F468}' + '‍' + '\u{1F469}' + '‍' + '\u{1F467}'
// 🇺🇸 — REGIONAL INDICATOR U + REGIONAL INDICATOR S (2 code points, 1 cluster).
const FLAG_US = '\u{1F1FA}' + '\u{1F1F8}'
// 👍🏽 — THUMBS UP + MEDIUM SKIN TONE modifier (2 code points, 1 cluster).
const THUMB_MEDIUM = '\u{1F44D}' + '\u{1F3FD}'

describe('ASCII renderer — composed emoji cluster width (issue #214)', () => {
  it.each([
    ['ZWJ family emoji', ZWJ_FAMILY, 5, 2],
    ['regional-indicator flag', FLAG_US, 2, 2],
    ['skin-tone-modified emoji', THUMB_MEDIUM, 2, 2],
    ['plain CJK (contrast)', '日本', 2, 4],
  ])(
    '%s: %j has %i code points and measures as %i columns',
    (_label, text, codePointCount, expectedWidth) => {
      expect([...text].length).toBe(codePointCount)
      expect(displayWidth(text)).toBe(expectedWidth)
      expect(terminalDisplayWidth(text)).toBe(expectedWidth)
    },
  )

  for (const useAscii of [false, true]) {
    describe(useAscii ? 'ASCII charset' : 'Unicode charset', () => {
      it('renders the issue repro (family emoji + CJK) with all rows at equal terminal width', () => {
        const mermaid = `flowchart TD\n  A[${ZWJ_FAMILY} team] --> B[日本]`
        const ascii = renderMermaidASCII(mermaid, {
          useAscii,
          colorMode: 'none',
        })
        assertUniformDisplayWidth(ascii)
        expect(ascii).toContain(ZWJ_FAMILY)
        expect(ascii).toContain('日本')
      })

      it('sizes a flag-emoji label box to 2 columns, not 4', () => {
        const mermaid = `flowchart TD\n  A[${FLAG_US}] --> B[ok]`
        const ascii = renderMermaidASCII(mermaid, {
          useAscii,
          colorMode: 'none',
        })
        assertUniformDisplayWidth(ascii)
        expect(ascii).toContain(FLAG_US)
      })

      it('sizes a skin-tone-modifier label box to 2 columns, not 4', () => {
        const mermaid = `flowchart TD\n  A[${THUMB_MEDIUM}] --> B[ok]`
        const ascii = renderMermaidASCII(mermaid, {
          useAscii,
          colorMode: 'none',
        })
        assertUniformDisplayWidth(ascii)
        expect(ascii).toContain(THUMB_MEDIUM)
      })
    })
  }

  it('renders a class diagram compartment box with a composed emoji member at uniform width', () => {
    const mermaid = `classDiagram\n  class Team {\n    +String ${ZWJ_FAMILY}\n  }`
    const ascii = renderMermaidASCII(mermaid, { colorMode: 'none' })
    assertUniformDisplayWidth(ascii)
    expect(ascii).toContain(ZWJ_FAMILY)
  })

  it('renders an ER diagram compartment box with a composed emoji attribute at uniform width', () => {
    const mermaid = `erDiagram\n  ITEM {\n    string ${FLAG_US}\n  }`
    const ascii = renderMermaidASCII(mermaid, { colorMode: 'none' })
    assertUniformDisplayWidth(ascii)
    expect(ascii).toContain(FLAG_US)
  })
})
