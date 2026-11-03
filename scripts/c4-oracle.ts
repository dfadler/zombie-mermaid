/**
 * Compares box placement, boundary containment and relationship text and
 * direction of every C4 sample in official mermaid.js and in our SVG (#2451).
 *
 * Usage: tsx scripts/c4-oracle.ts [--filter=<text>] [--thresholds]
 * `--thresholds` exits 1 when a sample is under C4_FLOOR or errored.
 * Needs Chromium (`pnpm exec playwright install chromium`). A diagnostic, not
 * CI; `pnpm run layout:scorecard` records the same figures in the scorecard.
 */
import { scoreC4 } from './lib/c4-measure.ts'
import { startRealMermaid } from './lib/real-mermaid.ts'

const pct = (n: number | null): string =>
  n === null ? '  - ' : `${Math.round(n * 100)}%`.padStart(4)

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const filter = args.find((a) => a.startsWith('--filter='))?.slice(9)
  const session = await startRealMermaid()
  try {
    const { results, breaches } = await scoreC4(session, '', filter)
    console.log('    h     v  cont  rels   dir  sample')
    for (const [title, r] of Object.entries(results)) {
      console.log(
        `${pct(r.horizontal)} ${pct(r.vertical)} ${pct(r.containment)} ${pct(r.relationships)} ${pct(r.direction)}  ${title}`,
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
