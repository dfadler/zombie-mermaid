/**
 * Compares slice angles, slice percentages and legend rows of every pie
 * sample in official mermaid.js and in our SVG (#2451).
 *
 * Usage: tsx scripts/pie-oracle.ts [--filter=<text>] [--thresholds]
 * `--thresholds` exits 1 when a sample is under PIE_FLOOR or errored.
 * Needs Chromium (`pnpm exec playwright install chromium`). A diagnostic, not
 * CI; `pnpm run layout:scorecard` records the same figures in the scorecard.
 */
import { startRealMermaid } from './lib/real-mermaid.ts'
import { scorePie } from './lib/pie-measure.ts'

const pct = (n: number | null): string =>
  n === null ? '  - ' : `${Math.round(n * 100)}%`.padStart(4)

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const filter = args.find((a) => a.startsWith('--filter='))?.slice(9)
  const session = await startRealMermaid()
  try {
    const { results, breaches } = await scorePie(session, '', filter)
    console.log('angle label legnd  sample')
    for (const [title, r] of Object.entries(results)) {
      console.log(
        `${pct(r.angles)}  ${pct(r.labels)}  ${pct(r.legend)}  ${title}`,
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
