/**
 * Compares every mindmap sample in official mermaid.js and in ours (#2840):
 * structure (text, shape, section, classes, parents, edges) exactly, shape
 * sizes from the official label box, and our CoSE-Bilkent layout and edge
 * paths from the official node sizes. Label widths (font metrics) are not
 * compared. See scripts/lib/mindmap-agreement.ts.
 *
 * Usage: tsx scripts/mindmap-oracle.ts [--filter=<text>] [--thresholds]
 * `--thresholds` exits 1 when a sample has a mismatch or errored.
 * Needs Chromium (`pnpm exec playwright install chromium`); layout-oracle.ts
 * runs the same check in the weekly CI workflow. `MERMAID_DIST` points at an
 * alternate `mermaid.min.js` (e.g. a scratch install of mermaid@latest).
 */
import { startRealMermaid } from './lib/real-mermaid.ts'
import { scoreMindmap } from './lib/mindmap-measure.ts'

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const filter = args.find((a) => a.startsWith('--filter='))?.slice(9)
  const session = await startRealMermaid(process.env.MERMAID_DIST)
  try {
    const { results, breaches } = await scoreMindmap(session, filter)
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
