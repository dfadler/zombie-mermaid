/**
 * Regenerates hero.svg (the README's hero image) from `public/hero-visual.svg`
 * — the hand-drawn, side-by-side "raw Mermaid source → rendered, animated
 * diagram" panel a visitor sees at the top of the live site, extracted from
 * `hero-visual.tsx`'s `HeroVisual` component to that standalone file
 * (zombie-mermaid#920).
 *
 * `public/hero-visual.svg` is already fully self-contained — its own
 * `:root` colour variables, `.mono` font-family, and `.edge-anim`
 * marching-ants animation, restated in its own `<style>` block (see that
 * file's header comment) so it renders identically whether loaded via the
 * live homepage's `<img src="hero-visual.svg">` or embedded in the README.
 * That means this script no longer needs to render a React component or
 * reconstruct any CSS of its own — but the two contexts still differ in one
 * way: the live site places HeroVisual directly on the page's own
 * full-bleed `--bg`, while a README renders on whatever background the
 * viewer's GitHub theme picks (white in light mode). Without a backdrop,
 * the code card floats with no visual anchor and the diagram's node labels
 * (colored for contrast against `--bg`, e.g. `Deploy?`'s near-black fill)
 * go unreadable — so this script inserts one rounded `--bg` backdrop rect
 * right after the source file's `<style>` block before writing hero.svg,
 * the one place these two output targets still diverge.
 *
 * The README places its own brand lockup (logo-lockup-{dark,light}.svg,
 * see scripts/generate-logo-lockup.ts) above this image, so hero.svg itself
 * carries no wordmark — just the code+diagram visual.
 *
 * hero.svg replaced hero.png (a manually-captured screenshot) once the
 * hero visual's edges gained a marching-ants animation: GitHub renders an
 * embedded SVG's CSS `@keyframes` natively, so the README's hero can
 * animate — a static PNG never could.
 *
 * Usage: tsx scripts/generate-hero.ts
 */

import { readFile, writeFile } from 'node:fs/promises'

const WIDTH = 700
const HEIGHT = 460
/** Corner radius of the backdrop — matches the code card's own `rx="16"`
 * (HeroVisual) closely enough to read as one shape family, rounded up
 * slightly since this rect is the larger of the two. */
const BACKDROP_RADIUS = 20

async function main(): Promise<void> {
  const srcPath = new URL('../public/hero-visual.svg', import.meta.url)
  const outPath = new URL('../public/hero.svg', import.meta.url)

  const source = await readFile(srcPath, 'utf8')

  // Inserted right after the closing </style> tag (not inside the style
  // block itself), so it paints behind every other shape without touching
  // the CSS those shapes depend on.
  const backdrop = `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" rx="${BACKDROP_RADIUS}" fill="var(--bg)"/>`
  const svg = source.replace('</style>', `</style>\n${backdrop}`)

  await writeFile(outPath, svg, 'utf8')
  console.log(
    `Wrote hero.svg (${svg.length} bytes) from public/hero-visual.svg`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
