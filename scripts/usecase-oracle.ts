/**
 * Compares box sizes and text, relationships, box positions and the drawing
 * size of every use case sample in official mermaid.js and in our SVG (#2819).
 *
 * Usage: tsx scripts/usecase-oracle.ts [--filter=<text>] [--thresholds]
 *        [--write-fixture=<file>]
 * `--write-fixture` saves the official SVGs (without their CSS) for
 * __tests__/usecase-agreement.test.ts.
 * `--thresholds` exits 1 when a sample is under USECASE_FLOOR (box sizes and
 * edges; positions and the frame are reported, not gated) or errored.
 * Set MERMAID_DIST=<path to mermaid.min.js> to score another mermaid build
 * (the first output line names the version scored).
 * Needs Chromium (`pnpm exec playwright install chromium`). A diagnostic, not CI.
 */
import { writeFileSync } from 'node:fs'
import { mermaidVersion } from './lib/mermaid-pin-freshness.ts'
import { startRealMermaid } from './lib/real-mermaid.ts'
import { scoreUsecase } from './lib/usecase-measure.ts'

const pct = (n: number | null): string =>
  n === null ? '  - ' : `${Math.round(n * 100)}%`.padStart(4)

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const filter = args.find((a) => a.startsWith('--filter='))?.slice(9)
  const fixture = args.find((a) => a.startsWith('--write-fixture='))?.slice(16)
  const distPath = process.env.MERMAID_DIST // A mermaid.min.js other than the pin
  console.log(`mermaid ${mermaidVersion(distPath)}`)
  const session = await startRealMermaid(distPath)
  try {
    const { results, breaches, official } = await scoreUsecase(
      session,
      '',
      filter,
    )
    if (fixture) {
      writeFileSync(fixture, JSON.stringify(official, null, 2) + '\n')
      console.log(`wrote ${fixture}`)
    }
    console.log('boxes edges pos   frame  sample')
    for (const [title, r] of Object.entries(results)) {
      console.log(
        `${pct(r.boxes)}  ${pct(r.edges)}  ${pct(r.positions)}  ${pct(r.frame)}   ${title}`,
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
