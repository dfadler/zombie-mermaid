/**
 * Builds the opt-in embedded Inter subset (`RenderOptions.embedFont:
 * 'subset'`, #1867) from the vendored source
 * `third_party/fonts/inter/InterVariable.woff2` (Inter 4.1, SIL OFL 1.1).
 *
 * What is kept, and why:
 * - Basic Latin only (U+0020-007E): exactly the range `INTER_ADVANCES` in
 *   `packages/core/src/text-metrics.ts` has measured widths for. Anything
 *   else falls back to the next font in the stack via `unicode-range`.
 *   Adding Latin-1 costs about +5 KB woff2 and the bytes ship twice in the
 *   package (ESM + CJS chunk), so it is not in this subset.
 * - `wght` 400-700 (the weights the renderer uses are 400/500/600; 700 is
 *   what the Google Fonts `@import` this replaces also requested).
 * - `opsz` pinned to 14: Inter's optical-size axis is auto-selected by
 *   the browser from the font size, and every label is 11-13 px, so 14 (the
 *   axis minimum) is the face those sizes get from Google Fonts anyway.
 *   Pinning halves the file.
 * - No OpenType features (no GPOS `kern`): the text-metrics advances are
 *   per-character, so kerning would make rendered text narrower than the box
 *   it was laid out for. `kern` is +2 KB.
 */
import { readFile } from 'node:fs/promises'
import subsetFont from 'subset-font'

export const INTER_SOURCE = new URL(
  '../../third_party/fonts/inter/InterVariable.woff2',
  import.meta.url,
)

/** First and last code point kept. */
export const INTER_RANGE = [0x20, 0x7e] as const

export async function buildInterSubset(): Promise<Buffer> {
  const source = await readFile(INTER_SOURCE)
  const chars = Array.from(
    { length: INTER_RANGE[1] - INTER_RANGE[0] + 1 },
    (_, i) => String.fromCodePoint(INTER_RANGE[0] + i),
  ).join('')
  return subsetFont(source, chars, {
    targetFormat: 'woff2',
    noHinting: true,
    keepFeatures: [],
    variationAxes: { opsz: 14, wght: { min: 400, max: 700 } },
  })
}

export function interFaceCss(woff2: Buffer): string {
  return `@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url(data:font/woff2;base64,${woff2.toString('base64')}) format('woff2');
  unicode-range: U+0020-007E;
}`
}

export function interGeneratedTs(css: string): string {
  return `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with \`pnpm run build:inter-font\`
 * (scripts/build-inter-font-subset.ts, logic in scripts/lib/inter-font-subset.ts):
 * Basic Latin, wght 400-700, opsz 14 of the vendored Inter 4.1 variable font
 * (third_party/fonts/inter/, SIL OFL 1.1). Loaded lazily by
 * \`loadEmbeddedFont()\` so it is never part of the default import graph (#1867).
 */

/** The family name the renderer's \`text\` rule already lists first. */
export const INTER_FONT_FAMILY = 'Inter'

export const INTER_FONT_FACE_CSS = \`${css}\`
`
}
