/**
 * Compares column and card rectangles, priority bars and the drawing size of
 * every kanban sample in official mermaid.js and in our SVG.
 *
 * Usage: tsx scripts/kanban-oracle.ts [--filter=<text>] [--thresholds]
 * `--thresholds` exits 1 when a sample is under 100% or errored.
 * Set MERMAID_DIST=<path to mermaid.min.js> to score another mermaid build
 * (the first output line names the version scored).
 * Needs Chromium (`pnpm exec playwright install chromium`). A diagnostic, not CI.
 */
import { samples } from '../samples/samples-data.ts'
import { renderMermaidSVG } from '../src/index.ts'
import { mermaidVersion } from './lib/mermaid-pin-freshness.ts'
import { renderRealMermaidSvg, startRealMermaid } from './lib/real-mermaid.ts'
import {
  kanbanAgreement,
  kanbanBreaches,
  parseKanbanSvg,
  type KanbanAgreement,
} from './lib/kanban-agreement.ts'

const pct = (n: number | null): string =>
  n === null ? '  - ' : `${Math.round(n * 100)}%`.padStart(4)

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const filter = args.find((a) => a.startsWith('--filter='))?.slice(9)
  const distPath = process.env.MERMAID_DIST // A mermaid.min.js other than the pin
  console.log(`mermaid ${mermaidVersion(distPath)}`)
  const session = await startRealMermaid(distPath)
  try {
    const results: Record<string, KanbanAgreement> = {}
    const errored: string[] = []
    const wanted = samples
      .filter((s) => /^\s*(?:---[\s\S]*?---\s*)?kanban\b/.test(s.source))
      .filter(
        (s) => !filter || s.title.toLowerCase().includes(filter.toLowerCase()),
      )
    for (const [i, s] of wanted.entries()) {
      try {
        const official = await renderRealMermaidSvg(
          session,
          `kanban_${i}`,
          s.source,
        )
        results[s.title] = kanbanAgreement(
          parseKanbanSvg(official),
          parseKanbanSvg(renderMermaidSVG(s.source)),
        )
      } catch (err) {
        console.error(
          `ERR  ${s.title}: ${(err as Error).message.split('\n')[0]}`,
        )
        errored.push(s.title)
      }
    }
    console.log('cols cards bars frame  sample')
    for (const [title, r] of Object.entries(results)) {
      console.log(
        `${pct(r.columns)}  ${pct(r.cards)}  ${pct(r.bars)}  ${pct(r.frame)}   ${title}`,
      )
    }
    const breaches = kanbanBreaches(results, errored)
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
