/**
 * The generated Inter subset behind `embedFont: 'subset'` (#1867): fresh
 * against its vendored source, covering exactly Basic Latin, and (the point of
 * embedding it) advancing characters by the widths text-metrics.ts lays boxes
 * out with.
 */
import { describe, expect, it } from 'vitest'
import { create as createFont } from 'fontkit'
import { getCharWidth } from '@zombie-mermaid/core'
import {
  INTER_FONT_FACE_CSS,
  INTER_FONT_FAMILY,
} from '../packages/svg-renderer/src/generated/inter-font-subset.ts'
import {
  buildInterSubset,
  interFaceCss,
} from '../scripts/lib/inter-font-subset.ts'

const woff2 = Buffer.from(
  /base64,([A-Za-z0-9+/=]+)\)/.exec(INTER_FONT_FACE_CSS)![1]!,
  'base64',
)
const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i))

describe('generated Inter subset', () => {
  it('is up to date with third_party/fonts/inter (run pnpm run build:inter-font)', async () => {
    expect(INTER_FONT_FACE_CSS).toBe(interFaceCss(await buildInterSubset()))
  })

  it('declares the family the renderer already lists first', () => {
    expect(INTER_FONT_FACE_CSS).toContain(`font-family: '${INTER_FONT_FAMILY}'`)
    expect(INTER_FONT_FAMILY).toBe('Inter')
  })

  it('has a glyph for every printable ASCII character and a unicode-range to match', () => {
    const font = createFont(woff2)
    for (const ch of ASCII) {
      expect(font.hasGlyphForCodePoint(ch.codePointAt(0)!), ch).toBe(true)
    }
    expect(INTER_FONT_FACE_CSS).toContain('unicode-range: U+0020-007E')
  })

  it('keeps the wght axis (400-700) so every renderer weight is a real face', () => {
    const axes = (
      createFont(woff2) as unknown as {
        variationAxes: Record<string, { min: number; max: number }>
      }
    ).variationAxes
    expect(axes.wght).toMatchObject({ min: 400, max: 700 })
    expect(axes.opsz).toBeUndefined()
  })

  it('advances ASCII by the text-metrics widths at weight 400 (±0.003 em)', () => {
    // The axis default is 400, so un-varied advances are the 400 advances.
    const font = createFont(woff2) as unknown as {
      unitsPerEm: number
      glyphForCodePoint(cp: number): { advanceWidth: number }
    }
    for (const ch of ASCII) {
      const em =
        font.glyphForCodePoint(ch.codePointAt(0)!).advanceWidth /
        font.unitsPerEm
      // measureTextWidth: width = getCharWidth * fontSize * 0.54 at weight 400.
      expect(Math.abs(em - getCharWidth(ch) * 0.54), ch).toBeLessThan(0.003)
    }
  })
})
