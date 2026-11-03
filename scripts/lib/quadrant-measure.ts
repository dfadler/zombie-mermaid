/** Runs every quadrant sample through real mermaid and diffs the figures, for quadrant-oracle.ts and layout-oracle.ts (#2437). */
import { samples } from '../../samples/samples-data.ts'
import {
  ourQuadrant,
  parseOfficialQuadrant,
  quadrantMismatches,
} from './quadrant-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

/** Sample title -> mismatches (empty = exact). Errored samples count as breaches. */
export async function scoreQuadrant(
  session: RealMermaidSession,
  filter?: string,
): Promise<{ results: Record<string, string[]>; breaches: string[] }> {
  const wanted = samples.filter(
    (s) =>
      /^\s*quadrantChart\b/.test(s.source) &&
      (!filter || s.title.toLowerCase().includes(filter.toLowerCase())),
  )
  const results: Record<string, string[]> = {}
  const breaches: string[] = []
  for (const [i, s] of wanted.entries()) {
    try {
      const official = await renderRealMermaidSvg(
        session,
        `quad_${i}`,
        s.source,
      )
      const found = quadrantMismatches(
        parseOfficialQuadrant(official),
        ourQuadrant(s.source),
      )
      results[s.title] = found
      if (found.length > 0)
        breaches.push(`${s.title} (${found.length} mismatches)`)
    } catch (err) {
      console.error(`ERR  ${s.title}: ${(err as Error).message.split('\n')[0]}`)
      breaches.push(`${s.title} (error)`)
    }
  }
  return { results, breaches }
}
