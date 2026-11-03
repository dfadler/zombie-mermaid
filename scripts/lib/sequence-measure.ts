/** Scores every sequence sample against real mermaid, for sequence-oracle.ts and layout-oracle.ts (#1686). */
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../../src/index.ts'
import { pinnedMermaidVersion } from './mermaid-pin-freshness.ts'
import {
  parseOfficialSequence,
  parseOurSequence,
  sequenceAgreement,
  sequenceBreaches,
  summarizeSequence,
  type SeqAgreement,
  type SequenceEntry,
} from './sequence-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface SequenceRun {
  results: Record<string, SeqAgreement>
  errored: string[]
  entry: SequenceEntry
  breaches: string[]
}

export async function scoreSequence(
  session: RealMermaidSession,
  commit: string,
  filter?: string,
): Promise<SequenceRun> {
  const wanted = samples.filter(
    (s) =>
      /^\s*sequenceDiagram\b/.test(s.source) &&
      (!filter || s.title.toLowerCase().includes(filter.toLowerCase())),
  )
  const results: Record<string, SeqAgreement> = {}
  const errored: string[] = []
  for (const [i, s] of wanted.entries()) {
    try {
      const official = await renderRealMermaidSvg(session, `seq_${i}`, s.source)
      results[s.title] = sequenceAgreement(
        parseOfficialSequence(official),
        parseOurSequence(renderMermaidSVG(s.source)),
      )
    } catch (err) {
      console.error(`ERR  ${s.title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(s.title)
    }
  }
  const entry = summarizeSequence(results, {
    date: new Date().toISOString().slice(0, 10),
    commit,
    mermaid: pinnedMermaidVersion(),
  })
  return {
    results,
    errored,
    entry,
    breaches: sequenceBreaches(results, errored),
  }
}
