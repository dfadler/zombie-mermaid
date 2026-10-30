/** Scores every C4 sample against real mermaid, for c4-oracle.ts and layout-oracle.ts (#2451). */
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../../src/index.ts'
import {
  c4Agreement,
  c4Breaches,
  parseOfficialC4,
  parseOurC4,
  summarizeC4,
  type C4Agreement,
  type C4Entry,
} from './c4-agreement.ts'
import { pinnedMermaidVersion } from './mermaid-pin-freshness.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface C4Run {
  results: Record<string, C4Agreement>
  errored: string[]
  entry: C4Entry
  breaches: string[]
}

export async function scoreC4(
  session: RealMermaidSession,
  commit: string,
  filter?: string,
): Promise<C4Run> {
  const wanted = samples.filter(
    (s) =>
      /^\s*C4(Context|Container|Component|Dynamic|Deployment)\b/.test(
        s.source,
      ) &&
      (!filter || s.title.toLowerCase().includes(filter.toLowerCase())),
  )
  const results: Record<string, C4Agreement> = {}
  const errored: string[] = []
  for (const [i, s] of wanted.entries()) {
    try {
      const official = await renderRealMermaidSvg(session, `c4_${i}`, s.source)
      results[s.title] = c4Agreement(
        parseOfficialC4(official),
        parseOurC4(renderMermaidSVG(s.source)),
      )
    } catch (err) {
      console.error(`ERR  ${s.title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(s.title)
    }
  }
  const entry = summarizeC4(results, {
    date: new Date().toISOString().slice(0, 10),
    commit,
    mermaid: pinnedMermaidVersion(),
  })
  return { results, errored, entry, breaches: c4Breaches(results, errored) }
}
