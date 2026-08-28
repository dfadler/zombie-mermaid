/**
 * Regenerates hero.svg (the README's hero image) from the "Hero" sample in
 * samples-data.ts, by rendering it through the library's own SVG renderer —
 * the same render path the live demo uses client-side, so the file this
 * script writes is exactly what a visitor sees, not a hand-crafted stand-in.
 *
 * hero.svg replaced hero.png (a manually-captured screenshot) once the Hero
 * sample gained a `zm-edge-dash` marching-ants animation: GitHub renders an
 * embedded SVG's CSS `@keyframes` natively, so the README's hero can animate
 * — a static PNG never could.
 *
 * Usage: tsx scripts/generate-hero.ts
 */

import { writeFile } from 'node:fs/promises'
import { samples } from '../samples-data.ts'
import { renderMermaidSVG } from '../src/index.ts'

async function main(): Promise<void> {
  const hero = samples.find((s) => s.category === 'Hero')
  if (!hero) {
    throw new Error('No sample with category "Hero" found in samples-data.ts')
  }

  const svg = renderMermaidSVG(hero.source, hero.options)
  const outPath = new URL('../hero.svg', import.meta.url)
  await writeFile(outPath, svg, 'utf8')
  console.log(
    `Wrote hero.svg (${svg.length} bytes) from sample "${hero.title}"`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
