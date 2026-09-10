/**
 * Regenerates hero.svg (the README's hero image) from `public/hero-visual.svg`
 * — the hand-drawn, side-by-side "raw Mermaid source → rendered, animated
 * diagram" panel a visitor sees at the top of the live site, extracted from
 * `index-app.tsx`'s `HeroVisual` component to that standalone file
 * (zombie-mermaid#920).
 *
 * `public/hero-visual.svg` is already fully self-contained — its own
 * `:root` colour variables, `.mono` font-family, and `.edge-anim`
 * marching-ants animation, restated in its own `<style>` block (see that
 * file's header comment) so it renders identically whether loaded via the
 * live homepage's `<img src="hero-visual.svg">` or embedded in the README.
 * That means this script no longer needs to render a React component or
 * reconstruct any CSS of its own: hero.svg is now a straight copy of
 * public/hero-visual.svg, so it can never drift from what the site
 * actually ships — regenerating this file after editing that source SVG
 * picks the change up automatically.
 *
 * Usage: tsx scripts/generate-hero.ts
 */

import { readFile, writeFile } from 'node:fs/promises'

async function main(): Promise<void> {
  const srcPath = new URL('../public/hero-visual.svg', import.meta.url)
  const outPath = new URL('../hero.svg', import.meta.url)

  const svg = await readFile(srcPath, 'utf8')
  await writeFile(outPath, svg, 'utf8')
  console.log(
    `Wrote hero.svg (${svg.length} bytes) from public/hero-visual.svg`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
