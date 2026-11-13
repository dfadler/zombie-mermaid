/**
 * Compares bar, label and ribbon positions and the drawing size of every
 * sankey sample in official mermaid.js and in our SVG (#2953).
 *
 * Usage: tsx scripts/sankey-oracle.ts [--filter=<text>] [--thresholds]
 * `--thresholds` exits 1 when a sample is under SANKEY_FLOOR or errored.
 * Set MERMAID_DIST=<path to mermaid.min.js> to score another mermaid build
 * (the first output line names the version scored).
 * Needs Chromium (`pnpm exec playwright install chromium`). A diagnostic, not CI.
 */
import { mermaidVersion } from './lib/mermaid-pin-freshness.ts'
import { startRealMermaid } from './lib/real-mermaid.ts'
import { scoreSankey } from './lib/sankey-measure.ts'

const pct = (n: number | null): string =>
  n === null ? '  - ' : `${Math.round(n * 100)}%`.padStart(4)

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const filter = args.find((a) => a.startsWith('--filter='))?.slice(9)
  const distPath = process.env.MERMAID_DIST // A mermaid.min.js other than the pin
  console.log(`mermaid ${mermaidVersion(distPath)}`)
  const session = await startRealMermaid(distPath)
  try {
    const { results, breaches } = await scoreSankey(session, filter)
    console.log('bars labels ribbons frame  sample')
    for (const [title, r] of Object.entries(results)) {
      console.log(
        `${pct(r.bars)}  ${pct(r.labels)}  ${pct(r.ribbons)}  ${pct(r.frame)}   ${title}`,
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
