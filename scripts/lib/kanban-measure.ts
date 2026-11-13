/** Scores every kanban sample against real mermaid, for kanban-oracle.ts (#2964). */
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../../src/index.ts'
import {
  kanbanAgreement,
  kanbanBreaches,
  parseKanbanSvg,
  type KanbanAgreement,
} from './kanban-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface KanbanRun {
  results: Record<string, KanbanAgreement>
  errored: string[]
  breaches: string[]
}

export async function scoreKanban(
  session: RealMermaidSession,
  filter?: string,
): Promise<KanbanRun> {
  const wanted = samples
    .filter((s) => /^\s*(?:---[\s\S]*?---\s*)?kanban\b/.test(s.source))
    .filter(
      (s) => !filter || s.title.toLowerCase().includes(filter.toLowerCase()),
    )
  const results: Record<string, KanbanAgreement> = {}
  const errored: string[] = []
  for (const [i, { title, source }] of wanted.entries()) {
    try {
      const official = await renderRealMermaidSvg(
        session,
        `kanban_${i}`,
        source,
      )
      results[title] = kanbanAgreement(
        parseKanbanSvg(official),
        parseKanbanSvg(renderMermaidSVG(source)),
      )
    } catch (err) {
      console.error(`ERR  ${title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(title)
    }
  }
  return { results, errored, breaches: kanbanBreaches(results, errored) }
}
