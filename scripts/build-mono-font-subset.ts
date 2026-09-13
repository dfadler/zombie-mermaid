/**
 * Subsets the vendored JetBrains Mono NL source
 * (third_party/fonts/jetbrains-mono-nl/JetBrainsMonoNL-Regular.ttf) down to
 * just the glyphs this site's ASCII output needs, and writes the result —
 * base64-encoded, so every consumer can embed it directly in a `<style>`
 * block with no extra network request or page-depth-relative `url()` to get
 * wrong — into two generated files:
 *
 * 1. `demo/components/generated/mono-font-subset.ts` — the single source of
 *    truth, consumed by tokens.tsx's `designTokensCss()` so every
 *    DesignFontLinks-based page (index, fork-fixes, diagrams, blog,
 *    dashboard) gets the `@font-face` rule for free.
 * 2. `demo/styles.css`, between the `GENERATED MONO FONT FACE` markers —
 *    this file predates tokens.tsx's design system and is plain CSS (no
 *    module system to import the generated .ts constant from), but its own
 *    `.ascii-output`/`.terminal-window` rules are the only thing styling
 *    the Playwright visual-regression suite's synthetic terminal
 *    (`__tests__/visual/helpers/terminal-panel.ts`) — giving it the same
 *    self-hosted font keeps that suite's baseline honest about what a real
 *    page now renders, and incidentally removes that suite's dependency on
 *    whatever monospace font (if any) happens to be installed on the CI
 *    runner.
 *
 * Per docs/decisions/ascii-browser-font-investigation-978.md's recommendation
 * 2, the subset explicitly covers Basic Latin, Latin-1 Supplement, Box
 * Drawing (U+2500–U+257F), and Block Elements (U+2580–U+259F) — checked
 * directly against the output rather than assumed, since at least one
 * common self-hosting shortcut (Fontsource's pre-split "latin" subset)
 * follows Google Fonts' own unicode-range definition, which does not
 * include box drawing.
 *
 * Usage: tsx scripts/build-mono-font-subset.ts
 */
import { readFile, writeFile } from 'node:fs/promises'
import subsetFont from 'subset-font'

/** Google Fonts' own family name for the ligature-free build, matching
 * `third_party/fonts/jetbrains-mono-nl/JetBrainsMonoNL-Regular.ttf`'s own
 * `name` table entry — kept in sync with tokens.tsx's `MONO_FONT_FAMILY`
 * (this script doesn't import that constant, to keep it independent of
 * tokens.tsx's own build graph; __tests__/generated-mono-font.test.ts pins
 * the two together). */
const FONT_FAMILY = 'JetBrains Mono NL'

/** [start, end] Unicode code point ranges (inclusive) this subset covers —
 * see this file's header comment for why each one is here. */
const UNICODE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0020, 0x007e], // Basic Latin (printable)
  [0x00a0, 0x00ff], // Latin-1 Supplement
  [0x2500, 0x257f], // Box Drawing
  [0x2580, 0x259f], // Block Elements
]

/** Every character `subsetFont` should keep, as a single string — its API
 * subsets by the text it's told to render, not by Unicode range directly. */
function charsToSubset(): string {
  const chars: string[] = []
  for (const [start, end] of UNICODE_RANGES) {
    for (let cp = start; cp <= end; cp++) chars.push(String.fromCodePoint(cp))
  }
  return chars.join('')
}

function fontFaceCss(base64Woff2: string): string {
  return `@font-face {
  font-family: '${FONT_FAMILY}';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(data:font/woff2;base64,${base64Woff2}) format('woff2');
  unicode-range: U+0020-007E, U+00A0-00FF, U+2500-257F, U+2580-259F;
}`
}

const GENERATED_TS_HEADER = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with \`pnpm run build:mono-font\`
 * (scripts/build-mono-font-subset.ts), which subsets
 * third_party/fonts/jetbrains-mono-nl/JetBrainsMonoNL-Regular.ttf down to
 * the Basic Latin, Latin-1 Supplement, Box Drawing, and Block Elements
 * ranges this site's ASCII output needs — see that script's header comment
 * and docs/decisions/ascii-browser-font-investigation-978.md.
 */
`

const STYLES_CSS_BEGIN_MARKER =
  '/* BEGIN GENERATED MONO FONT FACE — see scripts/build-mono-font-subset.ts, do not edit by hand */'
const STYLES_CSS_END_MARKER = '/* END GENERATED MONO FONT FACE */'

function patchStylesCss(source: string, css: string): string {
  const block = `${STYLES_CSS_BEGIN_MARKER}\n${css}\n${STYLES_CSS_END_MARKER}`
  const beginIdx = source.indexOf(STYLES_CSS_BEGIN_MARKER)
  const endIdx = source.indexOf(STYLES_CSS_END_MARKER)
  if (beginIdx === -1 || endIdx === -1) {
    throw new Error(
      'demo/styles.css is missing its GENERATED MONO FONT FACE markers — ' +
        'add them once by hand (see this script for the exact marker text) ' +
        'before this script can patch the block between them.',
    )
  }
  const before = source.slice(0, beginIdx)
  const after = source.slice(endIdx + STYLES_CSS_END_MARKER.length)
  return `${before}${block}${after}`
}

async function main(): Promise<void> {
  const srcPath = new URL(
    '../third_party/fonts/jetbrains-mono-nl/JetBrainsMonoNL-Regular.ttf',
    import.meta.url,
  )
  const source = await readFile(srcPath)

  const subsetBuffer = await subsetFont(source, charsToSubset(), {
    targetFormat: 'woff2',
    noHinting: true,
    keepFeatures: [],
  })
  const base64 = subsetBuffer.toString('base64')
  const css = fontFaceCss(base64)

  const genPath = new URL(
    '../demo/components/generated/mono-font-subset.ts',
    import.meta.url,
  )
  const genContent = `${GENERATED_TS_HEADER}
/** The self-hosted family name every consumer's font stack should list
 * first — matches this subset's own \`name\` table entry. */
export const MONO_FONT_FAMILY = '${FONT_FAMILY}'

/** The \`@font-face\` rule embedding the subset as a base64 \`woff2\` data
 * URI — no separate network request, no page-depth-relative path to get
 * wrong (see the script header comment for why data-URI over a static
 * asset file). */
export const MONO_FONT_FACE_CSS = \`${css}\`
`
  await writeFile(genPath, genContent, 'utf8')

  const stylesCssPath = new URL('../demo/styles.css', import.meta.url)
  const stylesCss = await readFile(stylesCssPath, 'utf8')
  await writeFile(stylesCssPath, patchStylesCss(stylesCss, css), 'utf8')

  console.log(
    `Wrote ${genContent.length} bytes to demo/components/generated/mono-font-subset.ts ` +
      `and patched demo/styles.css (subset: ${subsetBuffer.length} bytes woff2, ` +
      `${base64.length} bytes base64)`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
