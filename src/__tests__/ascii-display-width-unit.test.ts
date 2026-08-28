/**
 * Direct unit tests for `src/ascii/display-width.ts`'s grapheme-cluster-based
 * width algorithm, covering both bugs it fixes:
 *
 *   - #205: a decomposed combining mark (base char + Mn/Me code point) must
 *     contribute 0 columns of its own, not 1.
 *   - #214: a composed multi-code-point grapheme cluster (ZWJ emoji sequence,
 *     flag via regional indicators, skin-tone modifier) must be measured
 *     once per cluster, not once per code point.
 *
 * The render-level regression suites (`ascii-combining-mark-width.test.ts`,
 * `ascii-emoji-cluster-width.test.ts`) verify these against a fully
 * independent oracle; this file tests the module's own public API directly,
 * including the degenerate lone-combining-mark case that a full diagram
 * render wouldn't naturally exercise.
 *
 * Strings are built from explicit `\u` code point escapes rather than typed
 * accented/emoji literals, so the decomposed/precomposed and
 * single-cluster/multi-code-point distinctions under test can't be silently
 * altered by source-file Unicode normalization.
 */
import { describe, it, expect } from 'vitest'
import {
  charDisplayWidth,
  displayWidth,
  toDisplayCells,
  WIDE_CHAR_PLACEHOLDER,
} from '../ascii/display-width.ts'

const COMBINING_ACUTE = '́'
const COMBINING_GRAVE = '̀'
// "café", decomposed: c a f e + COMBINING ACUTE ACCENT (5 code points).
const DECOMPOSED_CAFE = 'caf' + 'e' + COMBINING_ACUTE
// "café", precomposed: c a f é, where é is the single code point U+00E9
// (4 code points).
const PRECOMPOSED_CAFE = 'caf' + 'é'

// 👨‍👩‍👧 — MAN, ZWJ, WOMAN, ZWJ, GIRL (5 code points, 1 grapheme cluster).
const ZWJ_FAMILY = '\u{1F468}' + '‍' + '\u{1F469}' + '‍' + '\u{1F467}'
// 🇺🇸 — REGIONAL INDICATOR U + REGIONAL INDICATOR S (2 code points, 1 cluster).
const FLAG_US = '\u{1F1FA}' + '\u{1F1F8}'
// 👍🏽 — THUMBS UP + MEDIUM SKIN TONE modifier (2 code points, 1 cluster).
const THUMB_MEDIUM = '\u{1F44D}' + '\u{1F3FD}'

describe('displayWidth — combining marks (issue #205)', () => {
  it('measures a decomposed "café" (e + U+0301) as 4 columns', () => {
    expect([...DECOMPOSED_CAFE].length).toBe(5) // 5 code points
    expect(displayWidth(DECOMPOSED_CAFE)).toBe(4)
  })

  it('measures the precomposed form identically', () => {
    expect([...PRECOMPOSED_CAFE].length).toBe(4) // 4 code points already
    expect(displayWidth(PRECOMPOSED_CAFE)).toBe(4)
  })

  it('does not add width for multiple stacked combining marks on one base', () => {
    // "e" + combining acute + combining grave — still one grapheme cluster.
    const stacked = 'e' + COMBINING_ACUTE + COMBINING_GRAVE
    expect(displayWidth(stacked)).toBe(1)
  })

  it('treats a lone combining mark with no base character as zero-width', () => {
    expect(charDisplayWidth(COMBINING_ACUTE)).toBe(0)
    expect(displayWidth(COMBINING_ACUTE)).toBe(0)
  })

  it('produces no grid cell for a lone combining mark', () => {
    expect(toDisplayCells(COMBINING_ACUTE)).toEqual([])
  })
})

describe('displayWidth — composed grapheme clusters (issue #214)', () => {
  it('measures a ZWJ family emoji as 2 columns, not 8', () => {
    expect([...ZWJ_FAMILY].length).toBe(5) // 5 code points
    expect(displayWidth(ZWJ_FAMILY)).toBe(2)
  })

  it('measures a regional-indicator flag as 2 columns, not 4', () => {
    expect([...FLAG_US].length).toBe(2)
    expect(displayWidth(FLAG_US)).toBe(2)
  })

  it('measures a skin-tone-modified emoji as 2 columns, not 4', () => {
    expect([...THUMB_MEDIUM].length).toBe(2)
    expect(displayWidth(THUMB_MEDIUM)).toBe(2)
  })

  it('still measures plain CJK correctly (contrast case)', () => {
    expect(displayWidth('日本')).toBe(4) // 日本
  })

  it('measures a mixed string combining marks and emoji clusters', () => {
    const text = DECOMPOSED_CAFE + ' ' + ZWJ_FAMILY
    expect(displayWidth(text)).toBe(4 + 1 + 2)
  })
})

describe('toDisplayCells — grid-cell/column-count invariant', () => {
  it('keeps cell count in sync with displayWidth for a decomposed mark', () => {
    expect(toDisplayCells(DECOMPOSED_CAFE).length).toBe(
      displayWidth(DECOMPOSED_CAFE),
    )
  })

  it('keeps cell count in sync with displayWidth for a ZWJ emoji', () => {
    expect(toDisplayCells(ZWJ_FAMILY).length).toBe(displayWidth(ZWJ_FAMILY))
  })

  it('writes the whole composed cluster into a single cell, followed by a placeholder', () => {
    const cells = toDisplayCells(ZWJ_FAMILY)
    expect(cells).toEqual([ZWJ_FAMILY, WIDE_CHAR_PLACEHOLDER])
  })

  it('writes a base character + combining mark into a single cell with no placeholder', () => {
    const decomposedE = 'e' + COMBINING_ACUTE
    const cells = toDisplayCells(decomposedE)
    expect(cells).toEqual([decomposedE])
  })

  it('leaves plain ASCII behavior unchanged', () => {
    expect(toDisplayCells('ab')).toEqual(['a', 'b'])
    expect(displayWidth('ab')).toBe(2)
  })

  it('leaves plain CJK behavior unchanged', () => {
    const cells = toDisplayCells('日') // 日
    expect(cells).toEqual(['日', WIDE_CHAR_PLACEHOLDER])
  })
})
