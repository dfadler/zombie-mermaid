/** Scores every pie sample against real mermaid, for pie-oracle.ts and layout-oracle.ts (#2451). */
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../../src/index.ts'
import { pinnedMermaidVersion } from './mermaid-pin-freshness.ts'
import {
  parseOfficialPie,
  parseOurPie,
  pieAgreement,
  pieBreaches,
  summarizePie,
  type PieAgreement,
  type PieEntry,
} from './pie-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface PieRun {
  results: Record<string, PieAgreement>
  errored: string[]
  entry: PieEntry
  breaches: string[]
}

export async function scorePie(
  session: RealMermaidSession,
  commit: string,
  filter?: string,
): Promise<PieRun> {
  const wanted = samples.filter(
    (s) =>
      /^\s*pie\b/.test(s.source) &&
      (!filter || s.title.toLowerCase().includes(filter.toLowerCase())),
  )
  const results: Record<string, PieAgreement> = {}
  const errored: string[] = []
  for (const [i, s] of wanted.entries()) {
    try {
      const official = await renderRealMermaidSvg(session, `pie_${i}`, s.source)
      results[s.title] = pieAgreement(
        parseOfficialPie(official),
        parseOurPie(renderMermaidSVG(s.source)),
      )
    } catch (err) {
      console.error(`ERR  ${s.title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(s.title)
    }
  }
  const entry = summarizePie(results, {
    date: new Date().toISOString().slice(0, 10),
    commit,
    mermaid: pinnedMermaidVersion(),
  })
  return { results, errored, entry, breaches: pieBreaches(results, errored) }
}
