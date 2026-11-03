/** Scores every xychart sample against real mermaid, for xychart-oracle.ts and layout-oracle.ts (#2451). */
import { samples } from '../../samples/samples-data.ts'
import { xychartSamples } from '../../samples/xychart-samples-data.ts'
import {
  MERMAID_CANNOT_PARSE,
  XYCHART_RANGE_CASES,
} from './xychart-oracle-cases.ts'
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
  /** Samples skipped because real mermaid cannot parse them. */
  skipped: string[]
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
  const wanted = [...samples, ...xychartSamples, ...XYCHART_RANGE_CASES].filter(
    (s) =>
      /^\s*xychart\b/.test(s.source) &&
      (!filter || s.title.toLowerCase().includes(filter.toLowerCase())),
  )
  const results: Record<string, XyAgreement> = {}
  const errored: string[] = []
  const skipped: string[] = []
  for (const [i, s] of wanted.entries()) {
    const horizontal = isHorizontal(s.source)
    try {
      const official = await renderRealMermaidSvg(session, `xy_${i}`, s.source)
      results[s.title] = xyAgreement(
        parseOfficialXy(official, horizontal),
        parseOurXy(renderMermaidSVG(s.source), horizontal),
      )
    } catch (err) {
      if (MERMAID_CANNOT_PARSE.has(s.title)) {
        skipped.push(s.title)
        continue
      }
      console.error(`ERR  ${s.title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(s.title)
    }
  }
  const entry = summarizeXy(results, {
    date: new Date().toISOString().slice(0, 10),
    commit,
    mermaid: pinnedMermaidVersion(),
  })
  return {
    results,
    errored,
    skipped,
    entry,
    breaches: xyBreaches(results, errored),
  }
}
