// Generates the two theme variants of the README's brand lockup: the same
// icon + "ZombieMermaid" wordmark as the site's nav (nav.tsx's NavBrand,
// icons.tsx's LogoMark) and hero.svg's own lockup — see docs/brand.md.
//
// Unlike hero.svg's lockup, these have no backing plate: they're meant to
// sit directly on the README's page background, so each variant's text
// color is picked for contrast against transparent-over-white (light) or
// transparent-over-dark (dark), rather than always using the nav's
// near-white `--text`. The README embeds both via a <picture> element with
// `prefers-color-scheme` so each GitHub theme gets a legible one.
import { writeFile } from 'node:fs/promises'

const ICON_SIZE = 48
const GAP = 16
// Measured via getBBox() in a browser against the actual loaded Space
// Grotesk 700 (no DOM/canvas available in this Node script to measure it
// directly) — same approach as generate-hero.ts's LOCKUP_WORDMARK_W. A
// small drift here (a font substitution, say) just leaves a little extra
// margin rather than clipping the wordmark.
const WORDMARK_W = 258
const FONT_SIZE = 34
const TEXT_X = ICON_SIZE + GAP
const WIDTH = TEXT_X + WORDMARK_W
const HEIGHT = ICON_SIZE
const TEXT_Y = ICON_SIZE / 2 + 12

const ICON = `<svg x="0" y="0" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="2" width="9" height="9" rx="3" stroke="#38e0d0" stroke-width="1.6"/>
    <rect x="13" y="2" width="9" height="9" rx="3" stroke="#a374e8" stroke-width="1.6"/>
    <path d="M6.5 11 V16 a2 2 0 0 0 2 2 h7 a2 2 0 0 0 2-2 v-5" stroke="#ff5fa8" stroke-width="1.6" fill="none"/>
  </svg>`

function lockupSvg(textFill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="ZombieMermaid">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&amp;family=Plus+Jakarta+Sans:wght@700&amp;display=swap');
  </style>
  ${ICON}
  <text x="${TEXT_X}" y="${TEXT_Y}" font-size="${FONT_SIZE}" font-weight="700" style="font-family:'Space Grotesk','Plus Jakarta Sans',sans-serif; letter-spacing:-0.01em" fill="${textFill}">ZombieMermaid</text>
</svg>
`
}

async function main(): Promise<void> {
  // `--text-dark`-equivalent: this repo has no light-theme token (the site
  // itself is dark-only), so this reuses `--bg` (#0a0d16) — the same navy
  // hero.svg puts *behind* the wordmark, used here as the wordmark's own
  // color instead, for contrast against GitHub's light theme.
  const light = lockupSvg('#0a0d16')
  // `--text` (#eef1fb) — identical to the nav/hero wordmark color, since a
  // dark GitHub theme is the same dark ground the site's own nav renders on.
  const dark = lockupSvg('#eef1fb')

  await writeFile(
    new URL('../logo-lockup-light.svg', import.meta.url),
    light,
    'utf8',
  )
  await writeFile(
    new URL('../logo-lockup-dark.svg', import.meta.url),
    dark,
    'utf8',
  )
  console.log('Wrote logo-lockup-light.svg and logo-lockup-dark.svg')
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
