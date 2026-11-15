/** Scores every treemap sample against real mermaid, for treemap-oracle.ts (#3117). */
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../../src/index.ts'
import {
  parseTreemapSvg,
  treemapAgreement,
  treemapBreaches,
  type TreemapAgreement,
} from './treemap-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface TreemapRun {
  results: Record<string, TreemapAgreement>
  errored: string[]
  breaches: string[]
}

export async function scoreTreemap(
  session: RealMermaidSession,
  filter?: string,
): Promise<TreemapRun> {
  const wanted = samples
    .filter((s) => /^\s*treemap\b/m.test(s.source))
    .filter(
      (s) => !filter || s.title.toLowerCase().includes(filter.toLowerCase()),
    )
  const results: Record<string, TreemapAgreement> = {}
  const errored: string[] = []
  for (const [i, { title, source }] of wanted.entries()) {
    try {
      const official = await renderRealMermaidSvg(
        session,
        `treemap_${i}`,
        source,
      )
      results[title] = treemapAgreement(
        parseTreemapSvg(official),
        parseTreemapSvg(renderMermaidSVG(source)),
      )
    } catch (err) {
      console.error(`ERR  ${title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(title)
    }
  }
  return { results, errored, breaches: treemapBreaches(results, errored) }
}
