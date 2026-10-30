/**
 * Compares rect, line, circle and text positions of every quadrantChart
 * sample in official mermaid.js and in our layout (#2437). Quadrant geometry
 * measures no text, so the figures must match exactly.
 *
 * Usage: tsx scripts/quadrant-oracle.ts [--filter=<text>] [--thresholds]
 * `--thresholds` exits 1 when a sample has a mismatch or errored.
 * Needs Chromium (`pnpm exec playwright install chromium`); layout-oracle.ts
 * runs the same check in the weekly CI workflow.
 */
import { startRealMermaid } from './lib/real-mermaid.ts'
import { scoreQuadrant } from './lib/quadrant-measure.ts'

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const filter = args.find((a) => a.startsWith('--filter='))?.slice(9)
  const session = await startRealMermaid()
  try {
    const { results, breaches } = await scoreQuadrant(session, filter)
    for (const [title, m] of Object.entries(results)) {
      console.log(`${m.length === 0 ? 'ok  ' : 'DIFF'} ${title}`)
      for (const line of m) console.log(`       ${line}`)
    }
    if (args.includes('--thresholds') && breaches.length > 0) {
      console.error(`\nMismatches: ${breaches.join(', ')}`)
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
