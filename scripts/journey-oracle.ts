/**
 * Compares section bars, task boxes, face positions, dashed lines, actor dots,
 * the axis and the drawing size of every journey sample in official mermaid.js
 * and in our SVG (#2958).
 *
 * Usage: tsx scripts/journey-oracle.ts [--filter=<text>] [--thresholds]
 * `--thresholds` exits 1 when a sample is under JOURNEY_FLOOR or errored.
 * Set MERMAID_DIST=<path to mermaid.min.js> to score another mermaid build
 * (the first output line names the version scored).
 * Needs Chromium (`pnpm exec playwright install chromium`). A diagnostic, not CI.
 */
import { scoreJourney } from './lib/journey-measure.ts'
import { mermaidVersion } from './lib/mermaid-pin-freshness.ts'
import { startRealMermaid } from './lib/real-mermaid.ts'

const pct = (n: number | null): string =>
  n === null ? '  - ' : `${Math.round(n * 100)}%`.padStart(4)

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const filter = args.find((a) => a.startsWith('--filter='))?.slice(9)
  const distPath = process.env.MERMAID_DIST // A mermaid.min.js other than the pin
  console.log(`mermaid ${mermaidVersion(distPath)}`)
  const session = await startRealMermaid(distPath)
  try {
    const { results, breaches } = await scoreJourney(session, filter)
    console.log('sects tasks faces lines dots frame  sample')
    for (const [title, r] of Object.entries(results)) {
      console.log(
        `${pct(r.sections)}  ${pct(r.tasks)}  ${pct(r.faces)}  ${pct(r.lines)}  ${pct(r.dots)}  ${pct(r.frame)}   ${title}`,
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
