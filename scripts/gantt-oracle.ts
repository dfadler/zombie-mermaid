/**
 * Compares rows, bars, exclude ranges, axis ticks, section labels and the
 * title of every gantt sample in official mermaid.js and in our layout
 * (#2835). All of it is arithmetic over the dates and the frame width, so the
 * figures must match exactly; only where a label sits relative to its bar is
 * reported as a note (text is measured in another font).
 *
 * Usage: tsx scripts/gantt-oracle.ts [--filter=<text>] [--thresholds]
 *        MERMAID_DIST=<path to mermaid.min.js> to check another mermaid version.
 * `--thresholds` exits 1 when a sample has a mismatch or errored.
 * Needs Chromium (`pnpm exec playwright install chromium`); layout-oracle.ts
 * runs the same check in the weekly CI workflow.
 */
import { startRealMermaid } from './lib/real-mermaid.ts'
import { scoreGantt } from './lib/gantt-measure.ts'

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const filter = args.find((a) => a.startsWith('--filter='))?.slice(9)
  const session = await startRealMermaid()
  try {
    const { results, notes, breaches } = await scoreGantt(session, filter)
    for (const [title, m] of Object.entries(results)) {
      console.log(`${m.length === 0 ? 'ok  ' : 'DIFF'} ${title}`)
      for (const line of m) console.log(`       ${line}`)
      for (const line of notes[title] ?? []) console.log(`  note ${line}`)
    }
    if (breaches.length > 0) {
      console.error(`\nMismatches: ${breaches.join(', ')}`)
      if (args.includes('--thresholds')) return 1
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
