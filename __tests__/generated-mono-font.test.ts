/**
 * Guards the exact gap that shipped, then got caught, while building the
 * self-hosted ASCII font (docs/decisions/ascii-browser-font-investigation-978.md):
 * scripts/build-mono-font-subset.ts's Unicode ranges were derived from that
 * doc's own box-drawing/CJK framing, not from an audit of every character
 * `renderMermaidASCII`'s default (non-ASCII) mode can actually write to the
 * grid — arrowheads and a handful of marker glyphs from the Geometric
 * Shapes block turned out to be missing entirely, silently falling back to
 * whatever font a viewer's browser picked, on nearly every diagram.
 *
 * This test renders every gallery sample the real way (no options beyond
 * the library's own defaults — same as every live page) and checks each
 * character actually written against the generated font subset's own
 * cmap, so a future renderer change that introduces a new decorative glyph
 * fails CI instead of silently drifting again. Lives here (not under
 * src/__tests__) for the same reason ascii-hyperlinks-samples.test.ts
 * does: it imports samples-data.ts from the repo root, outside `demo/
 * tsconfig.json`'s and the package tsconfigs' `rootDir`.
 */
import { describe, expect, it } from 'vitest'
import { create as createFont } from 'fontkit'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { charDisplayWidth } from '../packages/ascii-renderer/src/display-width.ts'
import { samples } from '../samples-data.ts'
import {
  MONO_FONT_FACE_CSS,
  MONO_FONT_FAMILY,
} from '../demo/components/generated/mono-font-subset.ts'

/**
 * Codepoints confirmed (scripts/build-mono-font-subset.ts's own build-time
 * check, via fontkit) to have no glyph in JetBrainsMonoNL-Regular.ttf
 * v2.304 at all — a font-capability gap, not a subsetting bug. Each is
 * used by exactly one renderer feature (diagonal edge routing corners,
 * hexagon-shape corner markers); they keep falling back to the system
 * font stack exactly as they did before this font existed. Update this
 * set (not the test's assertion) if a font upgrade ever adds them, or
 * drop an entry once it does.
 */
const KNOWN_MISSING_FROM_SOURCE_FONT = new Set([
  0x25e2, // ◢
  0x25e3, // ◣
  0x25e4, // ◤
  0x25e5, // ◥
  0x25f8, // ◸
  0x25f9, // ◹
  0x25fa, // ◺
  0x25ff, // ◿
  0x2b21, // ⬡
])

function decodeEmbeddedFont() {
  const match = /base64,([A-Za-z0-9+/=]+)\)/.exec(MONO_FONT_FACE_CSS)
  if (!match) {
    throw new Error(
      'MONO_FONT_FACE_CSS has no base64 data URI — has its shape changed?',
    )
  }
  return createFont(Buffer.from(match[1]!, 'base64'))
}

describe('self-hosted mono font subset', () => {
  it('names the same family tokens.tsx/demo/styles.css reference', () => {
    expect(MONO_FONT_FACE_CSS).toContain(`font-family: '${MONO_FONT_FAMILY}'`)
  })

  it('covers every narrow character every gallery sample actually renders', () => {
    const font = decodeEmbeddedFont()
    const missing = new Map<number, Set<string>>()
    let narrowNonAsciiChecked = 0

    for (const sample of samples) {
      let rendered: string
      try {
        rendered = renderMermaidASCII(sample.source)
      } catch {
        continue // A diagram this renderer rejects contributes no output.
      }
      for (const cluster of rendered) {
        const cp = cluster.codePointAt(0)!
        if (cp < 0x7f) continue // ASCII — always covered, cheap to skip.
        if (charDisplayWidth(cluster) > 1) continue // Wide/CJK — left to
        // system-font fallback by design (recommendation 4), never claimed
        // by this font's unicode-range.
        narrowNonAsciiChecked++
        if (font.hasGlyphForCodePoint(cp)) continue
        if (KNOWN_MISSING_FROM_SOURCE_FONT.has(cp)) continue
        const existing = missing.get(cp) ?? new Set<string>()
        existing.add(sample.title)
        missing.set(cp, existing)
      }
    }

    if (missing.size > 0) {
      const report = [...missing.entries()]
        .map(
          ([cp, titles]) =>
            `U+${cp.toString(16).toUpperCase().padStart(4, '0')} ` +
            `(seen in: ${[...titles].slice(0, 3).join(', ')})`,
        )
        .join('\n')
      throw new Error(
        `${missing.size} narrow character(s) rendered by the gallery have ` +
          `no glyph in the self-hosted font subset — add them to ` +
          `scripts/build-mono-font-subset.ts's UNICODE_RANGES/` +
          `EXTRA_CODEPOINTS (or, if the source font genuinely lacks the ` +
          `glyph, to this test's KNOWN_MISSING_FROM_SOURCE_FONT) and ` +
          `re-run \`pnpm run build:mono-font\`:\n${report}`,
      )
    }

    // Guard against a vacuous pass: the gallery must actually exercise
    // some narrow non-ASCII glyphs (box-drawing at minimum) for this
    // check to mean anything.
    expect(narrowNonAsciiChecked).toBeGreaterThan(100)
  })
})
