/** Scores every event modeling sample against real mermaid, for eventmodeling-oracle.ts. */
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../../src/index.ts'
import {
  emAgreement,
  emBreaches,
  parseEmSvg,
  type EmAgreement,
} from './eventmodeling-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface EmRun {
  results: Record<string, EmAgreement>
  errored: string[]
  breaches: string[]
}

export async function scoreEventModeling(
  session: RealMermaidSession,
  filter?: string,
): Promise<EmRun> {
  const wanted = samples
    .filter((s) => /^\s*(?:---[\s\S]*?---\s*)?eventmodeling\b/.test(s.source))
    .filter(
      (s) => !filter || s.title.toLowerCase().includes(filter.toLowerCase()),
    )
  const results: Record<string, EmAgreement> = {}
  const errored: string[] = []
  for (const [i, { title, source }] of wanted.entries()) {
    try {
      const official = await renderRealMermaidSvg(
        session,
        `eventmodeling_${i}`,
        source,
      )
      results[title] = emAgreement(
        parseEmSvg(official),
        parseEmSvg(renderMermaidSVG(source)),
      )
    } catch (err) {
      console.error(`ERR  ${title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(title)
    }
  }
  return { results, errored, breaches: emBreaches(results, errored) }
}
