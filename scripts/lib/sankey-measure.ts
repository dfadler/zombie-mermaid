/** Scores every sankey sample against real mermaid, for sankey-oracle.ts (#2953). */
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../../src/index.ts'
import {
  parseSankeySvg,
  sankeyAgreement,
  sankeyBreaches,
  type SankeyAgreement,
} from './sankey-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface SankeyRun {
  results: Record<string, SankeyAgreement>
  errored: string[]
  breaches: string[]
}

export async function scoreSankey(
  session: RealMermaidSession,
  filter?: string,
): Promise<SankeyRun> {
  const wanted = samples
    .filter((s) => /^(?:\s*%%\{[^}]*\}%%)*\s*sankey\b/i.test(s.source))
    .filter(
      (s) => !filter || s.title.toLowerCase().includes(filter.toLowerCase()),
    )
  const results: Record<string, SankeyAgreement> = {}
  const errored: string[] = []
  for (const [i, { title, source }] of wanted.entries()) {
    try {
      const official = await renderRealMermaidSvg(
        session,
        `sankey_${i}`,
        source,
      )
      results[title] = sankeyAgreement(
        parseSankeySvg(official),
        parseSankeySvg(renderMermaidSVG(source)),
      )
    } catch (err) {
      console.error(`ERR  ${title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(title)
    }
  }
  return { results, errored, breaches: sankeyBreaches(results, errored) }
}
