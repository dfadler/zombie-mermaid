/**
 * Compares axis labels, tick positions and bar/line data positions of every
 * xychart sample in official mermaid.js and in our SVG (#2451). Positions are
 * fractions of each axis, so canvas size does not count.
 *
 * Usage: tsx scripts/xychart-oracle.ts [--filter=<text>] [--thresholds]
 * `--thresholds` exits 1 when a sample is under XYCHART_FLOOR or errored.
 * Needs Chromium (`pnpm exec playwright install chromium`). A diagnostic, not
 * CI; `pnpm run layout:scorecard` records the same figures in the scorecard.
 */
import { startRealMermaid } from './lib/real-mermaid.ts'
import { scoreXyChart } from './lib/xychart-measure.ts'

const pct = (n: number | null): string =>
  n === null ? '  - ' : `${Math.round(n * 100)}%`.padStart(4)

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const filter = args.find((a) => a.startsWith('--filter='))?.slice(9)
  const session = await startRealMermaid()
  try {
    const { results, breaches } = await scoreXyChart(session, '', filter)
    console.log('label tick  data  sample')
    for (const [title, r] of Object.entries(results)) {
      console.log(`${pct(r.labels)}  ${pct(r.ticks)}  ${pct(r.data)}  ${title}`)
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
