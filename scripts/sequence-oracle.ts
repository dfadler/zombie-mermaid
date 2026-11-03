/**
 * Compares participant order, message order and message direction of every
 * sequence sample in official mermaid.js and in our SVG (#1686).
 *
 * Usage: tsx scripts/sequence-oracle.ts [--filter=<text>] [--thresholds]
 * `--thresholds` exits 1 when a sample is under SEQUENCE_FLOOR or errored.
 * Needs Chromium (`pnpm exec playwright install chromium`). A diagnostic, not
 * CI; `pnpm run layout:scorecard` records the same figures in the scorecard.
 */
import { startRealMermaid } from './lib/real-mermaid.ts'
import { scoreSequence } from './lib/sequence-measure.ts'

const pct = (n: number | null): string =>
  n === null ? '  - ' : `${Math.round(n * 100)}%`.padStart(4)

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const filter = args.find((a) => a.startsWith('--filter='))?.slice(9)
  const session = await startRealMermaid()
  try {
    const { results, breaches } = await scoreSequence(session, '', filter)
    console.log(' part  msgs   dir  sample')
    for (const [title, r] of Object.entries(results)) {
      console.log(
        `${pct(r.participants)} ${pct(r.messages)} ${pct(r.direction)}  ${title}`,
      )
    }
    const failing = breaches
    if (args.includes('--thresholds') && failing.length > 0) {
      console.error(`\nBelow threshold: ${failing.join(', ')}`)
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
