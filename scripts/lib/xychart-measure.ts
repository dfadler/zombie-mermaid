/** Scores every xychart sample against real mermaid, for xychart-oracle.ts and layout-oracle.ts (#2451). */
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../../src/index.ts'
import { pinnedMermaidVersion } from './mermaid-pin-freshness.ts'
import {
  isHorizontal,
  parseOfficialXy,
  parseOurXy,
  summarizeXy,
  xyAgreement,
  xyBreaches,
  type XyAgreement,
  type XyEntry,
} from './xychart-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface XyRun {
  results: Record<string, XyAgreement>
  errored: string[]
  entry: XyEntry
  breaches: string[]
}

export async function scoreXyChart(
  session: RealMermaidSession,
  commit: string,
  filter?: string,
): Promise<XyRun> {
  const wanted = samples.filter(
    (s) =>
      /^\s*xychart\b/.test(s.source) &&
      (!filter || s.title.toLowerCase().includes(filter.toLowerCase())),
  )
  const results: Record<string, XyAgreement> = {}
  const errored: string[] = []
  for (const [i, s] of wanted.entries()) {
    const horizontal = isHorizontal(s.source)
    try {
      const official = await renderRealMermaidSvg(session, `xy_${i}`, s.source)
      results[s.title] = xyAgreement(
        parseOfficialXy(official, horizontal),
        parseOurXy(renderMermaidSVG(s.source), horizontal),
      )
    } catch (err) {
      console.error(`ERR  ${s.title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(s.title)
    }
  }
  const entry = summarizeXy(results, {
    date: new Date().toISOString().slice(0, 10),
    commit,
    mermaid: pinnedMermaidVersion(),
  })
  return { results, errored, entry, breaches: xyBreaches(results, errored) }
}
