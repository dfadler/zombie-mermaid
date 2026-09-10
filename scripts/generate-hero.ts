/**
 * Regenerates hero.svg (the README's hero image) from the site's own home
 * page hero visual, `index-app.tsx`'s `HeroVisual` — the hand-drawn,
 * side-by-side "raw Mermaid source → rendered, animated diagram" panel a
 * visitor sees at the top of the live site. Rendered through
 * `react-dom/server`'s `renderToStaticMarkup` (the same function
 * `demo/render-html.ts` uses for every other generated page), not
 * hand-transcribed, so hero.svg can never drift from what the site actually
 * ships — the day `HeroVisual` changes, regenerating this file picks it up
 * automatically.
 *
 * `HeroVisual` colors every shape with `colorVar('--x')` (`tokens.tsx`),
 * which emits a literal `fill="var(--x)"` attribute — on the live site
 * that resolves against the page's own `:root` custom properties
 * (`designBaseCss()`). A standalone hero.svg has no such page around it, so
 * this script publishes the same `:root { --x: ...; }` block itself,
 * sourced from `COLORS` (`tokens.tsx`) rather than re-typing hex values by
 * hand — keeping color drift impossible here too. The canvas itself stays
 * transparent rather than filled with `--bg`: unlike the live site, a
 * README renders on whatever background the viewer's GitHub theme picks
 * (white in light mode), and every element here is already either opaque
 * (the code panel, the diagram nodes) or has enough of its own contrast
 * (the accent-colored edges/labels) to read on both.
 *
 * hero.svg replaced hero.png (a manually-captured screenshot) once the
 * hero visual's edges gained a marching-ants animation: GitHub renders an
 * embedded SVG's CSS `@keyframes` natively, so the README's hero can
 * animate — a static PNG never could.
 *
 * Usage: tsx scripts/generate-hero.ts
 */

import { writeFile } from 'node:fs/promises'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HeroVisual } from '../demo/components/index-app.tsx'
import { COLORS, FONTS } from '../demo/components/tokens.tsx'

const WIDTH = 700
const HEIGHT = 460

/**
 * `.edge-anim`'s marching-ants animation — transcribed from
 * `index-page.tsx`'s `homePageCss()` (the class `HeroVisual`'s own edges
 * use) rather than imported, since that function emits the whole home
 * page's CSS and this composite only needs these four lines of it.
 */
const EDGE_ANIM_CSS = `@keyframes marchingAnts { to { stroke-dashoffset: -24; } }
  .edge-anim { stroke-dasharray: 6 6; animation: marchingAnts 0.9s linear infinite; }
  @media (prefers-reduced-motion: reduce) {
    .edge-anim { animation: none; }
  }`

async function main(): Promise<void> {
  const heroVisualMarkup = renderToStaticMarkup(createElement(HeroVisual))
  // HeroVisual's own root <svg viewBox="0 0 700 460" ...> becomes a plain
  // <g>, positioned to fill the composite exactly — keeping one real <svg>
  // root rather than nesting a second one for no reason (unlike the old
  // generator's nested nested-renderer output, which had no choice: that
  // SVG came from `renderMermaidSVG` at whatever native size the diagram
  // rendered at, not already sized to this canvas).
  const heroVisualBody = heroVisualMarkup
    .replace(/^<svg[^>]*>/, '<g>')
    .replace(/<\/svg>$/, '</g>')

  const rootVars = Object.entries(COLORS)
    .map(([token, hex]) => `${token}: ${hex};`)
    .join(' ')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="Raw Mermaid source rendering into a themed, animated diagram, drawn by zombie-mermaid itself">
<style>
  :root { ${rootVars} }
  /* HeroVisual's code panel text carries the site's global \`.mono\`
     class (nav.tsx/tokens.tsx's designBaseCss()) for its font — restated
     here since a standalone hero.svg has no page-wide stylesheet to
     inherit it from. */
  .mono { font-family: ${FONTS.mono}; }
  ${EDGE_ANIM_CSS}
</style>

${heroVisualBody}
</svg>
`

  const outPath = new URL('../hero.svg', import.meta.url)
  await writeFile(outPath, svg, 'utf8')
  console.log(`Wrote hero.svg (${svg.length} bytes) from HeroVisual`)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
