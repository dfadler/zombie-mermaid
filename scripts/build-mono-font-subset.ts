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
 * That doc's own four ranges turned out to be necessary but not
 * sufficient: an audit of packages/ascii-renderer/src/ (every literal
 * Unicode character the renderer can actually write to the grid, not just
 * the doc's box-drawing/CJK framing) found `useAscii: false` — this
 * repo's *default* rendering mode, used by every live page — also draws
 * edge arrowheads, class-diagram markers, and a few corner/shape glyphs
 * from the Geometric Shapes block and a handful of others, none of which
 * are CJK/wide (so none are covered by the existing `Nch`-width fallback
 * exemption either). Missing them wouldn't break layout — every fallback
 * candidate is monospace too — but it would silently reintroduce exactly
 * the per-viewer font drift this file exists to close, for glyphs that
 * appear on nearly every diagram. The extra ranges/codepoints below close
 * that gap; see `unicode-range` in {@link fontFaceCss} for the exact list,
 * generated from {@link UNICODE_RANGES}/{@link EXTRA_CODEPOINTS} rather
 * than hand-duplicated.
 *
 * A handful of the audit's own findings (◢◣◤◥, ◸◹◺◿, ⬡) turned out to have
 * no glyph in JetBrains Mono NL v2.304 at all — checked directly via
 * `fontkit`'s `hasGlyphForCodePoint` against the vendored source file,
 * rather than assumed from the Geometric Shapes block's nominal range.
 * This script still filters every requested codepoint against that check
 * and logs anything dropped, so a future font update (which might add a
 * currently-missing glyph) doesn't need this file edited to pick it up,
 * and a codepoint quietly missing isn't mistaken for a codepoint
 * deliberately left out.
 *
 * Investigating that finding (issue #1062) turned up two different
 * situations, not one:
 * - ◸◹◺◿ and ⬡ were never actually reachable output: shapes/hexagon.ts and
 *   shapes/special.ts's trapezoid renderers had moved to the
 *   monospace-safe crop-corner/diagonal-slash style in shapes/corners.ts
 *   (⌜⌝⌞⌟ and / \) well before this file was written, leaving only their
 *   own doc comments (now fixed) still claiming the old glyphs — so there
 *   was never a real fallback to fix here.
 * - ◢◣◤◥ (diagonal edge-routing arrowheads, draw-arrows.ts's
 *   `drawArrowHead`) were genuinely reachable and genuinely missing from
 *   the font. Since no visually-equivalent filled-triangle glyph exists in
 *   JetBrains Mono NL at any codepoint, `drawArrowHead` and canvas.ts's
 *   `VERTICAL_FLIP_MAP` now draw ↖↗↘↙ (U+2196–U+2199, plain Arrows-block
 *   glyphs the font does have) for diagonal edges instead — a different
 *   visual style from the orthogonal ▲▼◄► set, but a real, correctly
 *   directional glyph in the pinned font rather than an unpinned
 *   system-font fallback. Already covered by the Arrows range below, so no
 *   new range was needed.
 *
 * The renderer-structural audit above still isn't the whole picture: a
 * diagram author's own node/edge/note text passes straight through to the
 * ASCII grid verbatim, so the set of narrow non-ASCII characters real
 * output can contain is open-ended in a way no fixed subset can fully
 * guarantee (this repo's own sample gallery writes a literal → in one
 * message label, caught by __tests__/generated-mono-font.test.ts rendering
 * every gallery sample and checking each character against this file's
 * output). The Arrows range below closes that specific instance, on the
 * same "reasonable coverage for typical prose" basis Latin-1 Supplement
 * already covers accented text on — not a claim that arbitrary future
 * label text can never need a codepoint outside every range here. That
 * test is the actual backstop: it fails loudly, naming the exact
 * codepoint and sample, so a real gap gets a deliberate decision (extend
 * this file, or accept the fallback) instead of a silent one.
 *
 * Usage: tsx scripts/build-mono-font-subset.ts
 */
import { readFile, writeFile } from 'node:fs/promises'
import subsetFont from 'subset-font'
import { create as createFont } from 'fontkit'

/** JetBrains's own family name for the ligature-free build, matching
 * `third_party/fonts/jetbrains-mono-nl/JetBrainsMonoNL-Regular.ttf`'s own
 * `name` table entry. This is the single source of truth for the family
 * name (written into the generated `MONO_FONT_FAMILY` export tokens.tsx
 * imports) — there's no separate copy elsewhere to drift out of sync with;
 * __tests__/generated-mono-font.test.ts checks it matches what
 * MONO_FONT_FACE_CSS's own `@font-face` rule declares. */
const FONT_FAMILY = 'JetBrains Mono NL'

/** [start, end] Unicode code point ranges (inclusive) this subset covers —
 * see this file's header comment for why each one is here. */
const UNICODE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0020, 0x007e], // Basic Latin (printable)
  [0x00a0, 0x00ff], // Latin-1 Supplement
  [0x2500, 0x257f], // Box Drawing
  [0x2580, 0x259f], // Block Elements
  [0x25a0, 0x25ff], // Geometric Shapes — edge arrowheads (▲▼◀▶◆◇○●◯…) and
  // class/ER-diagram markers drawn by draw-arrows.ts/class-diagram.ts/
  // er-diagram.ts/shapes/** in the default (non-ASCII) render mode.
  [0x231c, 0x231f], // ⌜⌝⌞⌟ — subroutine-shape corner glyphs (shapes/corners.ts)
  [0x2190, 0x21ff], // Arrows (→←↔↑↓…) — includes ↖↗↘↙ (U+2196–U+2199), the
  // diagonal edge-routing arrowheads draw-arrows.ts's drawArrowHead draws
  // in place of the filled triangles (◢◣◤◥) JetBrains Mono NL has no glyph
  // for at all (see this file's header comment; issue #1062). The rest of
  // the range isn't drawn by the renderer itself, but a diagram author's
  // own node/edge/note text passes straight through to the ASCII grid
  // verbatim (e.g. samples-data.ts's own "Sequence: Self-Messages with
  // Notes" writes a literal → in a message label). Unlike the
  // renderer-structural glyphs, label text is inherently open-ended — this
  // range covers the common case (matching Latin-1 Supplement's own
  // "reasonable coverage for typical prose" scope, not a guarantee of
  // every arrow variant); __tests__/generated-mono-font.test.ts still
  // fails loudly, naming the exact codepoint and sample, if some future
  // sample's text needs one this doesn't cover.
]

/** Standalone codepoints outside any range above worth its own entry —
 * each used by exactly one renderer feature, per the audit in this file's
 * header comment. */
const EXTRA_CODEPOINTS: ReadonlyArray<number> = [
  0x2016, // ‖ — double-line border glyph in useAscii:true mode (draw-boxes.ts/draw-lines.ts)
  0x2026, // … — class-diagram member-list truncation ellipsis (class-diagram.ts)
  0x2715, // ✕ — sequence-diagram lost-message / cross marker (sequence.ts/draw-arrows.ts)
  // No entry for ⬡ (U+2B21, hexagon-shape corner marker): shapes/hexagon.ts
  // hasn't actually emitted it since shapes/corners.ts moved to the
  // monospace-safe crop-corner style (⌜⌝⌞⌟, already covered by the
  // U+231C–U+231F range above) — see this file's header comment; issue #1062.
]

/** Every codepoint {@link UNICODE_RANGES}/{@link EXTRA_CODEPOINTS} nominally
 * request, before checking which the source font can actually provide. */
function wantedCodepoints(): number[] {
  const codepoints: number[] = []
  for (const [start, end] of UNICODE_RANGES) {
    for (let cp = start; cp <= end; cp++) codepoints.push(cp)
  }
  codepoints.push(...EXTRA_CODEPOINTS)
  return codepoints
}

const hex = (cp: number) => cp.toString(16).toUpperCase().padStart(4, '0')

/** Filters `wanted` down to codepoints `font` actually has a glyph for,
 * logging (not throwing on) anything dropped — see this file's header
 * comment for why a missing glyph is a font-capability gap to report, not
 * a build failure. */
function filterToAvailable(
  font: { hasGlyphForCodePoint(cp: number): boolean },
  wanted: number[],
): number[] {
  const available: number[] = []
  const missing: number[] = []
  for (const cp of wanted) {
    if (font.hasGlyphForCodePoint(cp)) available.push(cp)
    else missing.push(cp)
  }
  if (missing.length > 0) {
    console.warn(
      `build-mono-font-subset: JetBrainsMonoNL-Regular.ttf has no glyph for ` +
        `${missing.length} requested codepoint(s), left to system-font ` +
        `fallback as before: ${missing.map((cp) => `U+${hex(cp)}`).join(', ')}`,
    )
  }
  return available
}

/** Every character `subsetFont` should keep, as a single string — its API
 * subsets by the text it's told to render, not by Unicode range directly. */
function charsToSubset(available: number[]): string {
  return available.map((cp) => String.fromCodePoint(cp)).join('')
}

/** `unicode-range` descriptor value — derived from the same
 * font-availability-filtered codepoint list actually subsetted, so it
 * can't claim coverage the embedded font doesn't really have. Adjacent
 * codepoints are collapsed into `start-end` runs purely to keep the
 * descriptor readable; a lone codepoint is emitted as `U+XXXX`. */
function unicodeRangeDescriptor(available: number[]): string {
  const sorted = [...available].sort((a, b) => a - b)
  const parts: string[] = []
  let runStart = sorted[0]
  let runEnd = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    const cp = sorted[i]
    if (cp !== undefined && runEnd !== undefined && cp === runEnd + 1) {
      runEnd = cp
      continue
    }
    if (runStart !== undefined && runEnd !== undefined) {
      parts.push(
        runStart === runEnd
          ? `U+${hex(runStart)}`
          : `U+${hex(runStart)}-${hex(runEnd)}`,
      )
    }
    runStart = cp
    runEnd = cp
  }
  return parts.join(', ')
}

function fontFaceCss(base64Woff2: string, available: number[]): string {
  return `@font-face {
  font-family: '${FONT_FAMILY}';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(data:font/woff2;base64,${base64Woff2}) format('woff2');
  unicode-range: ${unicodeRangeDescriptor(available)};
}`
}

const GENERATED_TS_HEADER = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with \`pnpm run build:mono-font\`
 * (scripts/build-mono-font-subset.ts), which subsets
 * third_party/fonts/jetbrains-mono-nl/JetBrainsMonoNL-Regular.ttf down to
 * every glyph this site's ASCII output actually renders (Basic Latin,
 * Latin-1 Supplement, Box Drawing, Block Elements, Geometric Shapes, and a
 * handful of standalone marker glyphs) — see that script's header comment
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

  const font = createFont(source)
  const available = filterToAvailable(font, wantedCodepoints())

  const subsetBuffer = await subsetFont(source, charsToSubset(available), {
    targetFormat: 'woff2',
    noHinting: true,
    keepFeatures: [],
  })
  const base64 = subsetBuffer.toString('base64')
  const css = fontFaceCss(base64, available)

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
