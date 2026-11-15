/**
 * Compares section and leaf positions, the labels that survive text fitting and
 * the drawing size of every treemap sample in official mermaid.js and in our
 * SVG (#2818).
 *
 * Usage: tsx scripts/treemap-oracle.ts [--filter=<text>] [--thresholds]
 * `--thresholds` exits 1 when a sample is under TREEMAP_FLOOR or errored.
 * Set MERMAID_DIST=<path to mermaid.min.js> to score another mermaid build
 * (the first output line names the version scored).
 * Needs Chromium (`pnpm exec playwright install chromium`).
 * `layout:oracle --thresholds` runs the same check in the weekly CI (#3117).
 */
import { mermaidVersion } from './lib/mermaid-pin-freshness.ts'
import { startRealMermaid } from './lib/real-mermaid.ts'
import { scoreTreemap } from './lib/treemap-measure.ts'

const pct = (n: number | null): string =>
  n === null ? '  - ' : `${Math.round(n * 100)}%`.padStart(4)

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const filter = args.find((a) => a.startsWith('--filter='))?.slice(9)
  const distPath = process.env.MERMAID_DIST // A mermaid.min.js other than the pin
  console.log(`mermaid ${mermaidVersion(distPath)}`)
  const session = await startRealMermaid(distPath)
  try {
    const { results, breaches } = await scoreTreemap(session, filter)
    console.log('cells boxes texts frame  sample')
    for (const [title, r] of Object.entries(results)) {
      console.log(
        `${String(r.cells).padStart(5)}  ${pct(r.boxes)}  ${pct(r.texts)}  ${pct(r.frame)}   ${title}`,
      )
    }
    if (args.includes('--thresholds') && breaches.length > 0) {
      console.error(`\nBelow threshold: ${breaches.join(', ')}`)
      return 1
    }
    return 0
  } finally {
    await session.close()
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === new URL(process.argv[1], 'file://').href
) {
  process.exit(await main())
}
