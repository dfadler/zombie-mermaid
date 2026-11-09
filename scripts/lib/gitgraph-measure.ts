/** Scores every gitGraph sample against real mermaid, for gitgraph-oracle.ts (#2808). */
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../../src/index.ts'
import {
  gitGraphAgreement,
  gitGraphBreaches,
  parseGitGraphSvg,
  type GitGraphAgreement,
} from './gitgraph-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface GitGraphRun {
  results: Record<string, GitGraphAgreement>
  errored: string[]
  breaches: string[]
}

export async function scoreGitGraph(
  session: RealMermaidSession,
  _commit: string,
  filter?: string,
  /** Extra sources to score alongside the gallery samples: title -> source. */
  extra: Record<string, string> = {},
): Promise<GitGraphRun> {
  const wanted = [
    ...samples
      .filter((s) => /^gitGraph\b/m.test(s.source))
      .map((s) => [s.title, s.source] as const),
    ...Object.entries(extra),
  ].filter(
    ([title]) => !filter || title.toLowerCase().includes(filter.toLowerCase()),
  )
  const results: Record<string, GitGraphAgreement> = {}
  const errored: string[] = []
  for (const [i, [title, source]] of wanted.entries()) {
    try {
      const official = await renderRealMermaidSvg(
        session,
        `gitgraph_${i}`,
        source,
      )
      results[title] = gitGraphAgreement(
        parseGitGraphSvg(official),
        parseGitGraphSvg(renderMermaidSVG(source)),
      )
    } catch (err) {
      console.error(`ERR  ${title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(title)
    }
  }
  return { results, errored, breaches: gitGraphBreaches(results, errored) }
}
