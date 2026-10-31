/**
 * Compares relative placement (above / below / beside) and group containment
 * of every architecture-beta sample in official mermaid.js and in our SVG
 * (#2451). Tolerant by design: mermaid places services with fcose, so only
 * relations are compared, not pixels (see scripts/lib/architecture-agreement.ts).
 *
 * Usage: tsx scripts/architecture-oracle.ts [--filter=<text>] [--thresholds]
 * `--thresholds` exits 1 when a sample is under ARCH_FLOOR or errored.
 * Needs Chromium (`pnpm exec playwright install chromium`). A diagnostic, not
 * CI; `pnpm run layout:scorecard` records the same figures in the scorecard.
 */
import { scoreArchitecture } from './lib/architecture-measure.ts'
import { startRealMermaid } from './lib/real-mermaid.ts'

const pct = (n: number | null): string =>
  n === null ? '  - ' : `${Math.round(n * 100)}%`.padStart(4)

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const filter = args.find((a) => a.startsWith('--filter='))?.slice(9)
  const session = await startRealMermaid()
  try {
    const { results, breaches } = await scoreArchitecture(session, '', filter)
    console.log(' vert horiz   in  nodes  sample')
    for (const [title, r] of Object.entries(results)) {
      console.log(
        `${pct(r.vertical)} ${pct(r.horizontal)} ${pct(r.containment)}  ${String(r.nodes).padStart(4)}  ${title}`,
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
