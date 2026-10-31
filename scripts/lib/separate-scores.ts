/** The diagram types layout-oracle.ts scores outside the node-pair figures (their sections in the scorecard). */
import { scoreSequence } from './sequence-measure.ts'
import { scoreQuadrant } from './quadrant-measure.ts'
import { scorePie } from './pie-measure.ts'
import { scoreC4 } from './c4-measure.ts'
import { scoreXyChart } from './xychart-measure.ts'
import { scoreArchitecture } from './architecture-measure.ts'
import type { RealMermaidSession } from './real-mermaid.ts'

export async function scoreSeparately(
  session: RealMermaidSession,
  commit: string,
  thresholds: boolean,
) {
  const seq = await scoreSequence(session, commit)
  const quad = await scoreQuadrant(session)
  const pie = await scorePie(session, commit)
  const c4 = await scoreC4(session, commit)
  const xy = await scoreXyChart(session, commit)
  const arch = await scoreArchitecture(session, commit)
  return {
    entries: [seq.entry, pie.entry, c4.entry, xy.entry, arch.entry] as [
      typeof seq.entry,
      typeof pie.entry,
      typeof c4.entry,
      typeof xy.entry,
      typeof arch.entry,
    ],
    breaches: thresholds
      ? [seq, quad, pie, c4, xy, arch].flatMap((s) => s.breaches)
      : [],
  }
}
