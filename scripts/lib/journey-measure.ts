/** Scores every journey sample against real mermaid, for journey-oracle.ts (#2958). */
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../../src/index.ts'
import {
  journeyAgreement,
  journeyBreaches,
  parseJourneySvg,
  type JourneyAgreement,
} from './journey-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface JourneyRun {
  results: Record<string, JourneyAgreement>
  errored: string[]
  breaches: string[]
}

export async function scoreJourney(
  session: RealMermaidSession,
  filter?: string,
): Promise<JourneyRun> {
  const wanted = samples
    .filter((s) => /^\s*journey\b/.test(s.source))
    .filter(
      (s) => !filter || s.title.toLowerCase().includes(filter.toLowerCase()),
    )
  const results: Record<string, JourneyAgreement> = {}
  const errored: string[] = []
  for (const [i, { title, source }] of wanted.entries()) {
    try {
      const official = await renderRealMermaidSvg(
        session,
        `journey_${i}`,
        source,
      )
      results[title] = journeyAgreement(
        parseJourneySvg(official),
        parseJourneySvg(renderMermaidSVG(source)),
      )
    } catch (err) {
      console.error(`ERR  ${title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(title)
    }
  }
  return { results, errored, breaches: journeyBreaches(results, errored) }
}
