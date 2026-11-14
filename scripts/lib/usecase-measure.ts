/** Scores every use case sample against real mermaid, for usecase-oracle.ts. */
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../../src/index.ts'
import { pinnedMermaidVersion } from './mermaid-pin-freshness.ts'
import {
  parseOfficialUsecaseSvg,
  parseOurUsecaseSvg,
  summarizeUsecase,
  usecaseAgreement,
  usecaseBreaches,
  type UsecaseAgreement,
  type UsecaseEntry,
} from './usecase-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface UsecaseRun {
  results: Record<string, UsecaseAgreement>
  errored: string[]
  /** Official SVGs without their CSS, for `--write-fixture`. */
  official: Record<string, { source: string; official: string }>
  entry: UsecaseEntry
  breaches: string[]
}

export async function scoreUsecase(
  session: RealMermaidSession,
  commit: string,
  filter?: string,
): Promise<UsecaseRun> {
  const wanted = samples
    .filter((s) => /^\s*usecase-beta\b/.test(s.source))
    .map((s) => [s.title, s.source] as const)
    .filter(
      ([title]) =>
        !filter || title.toLowerCase().includes(filter.toLowerCase()),
    )
  const results: Record<string, UsecaseAgreement> = {}
  const errored: string[] = []
  const official: UsecaseRun['official'] = {}
  for (const [i, [title, source]] of wanted.entries()) {
    try {
      const svg = await renderRealMermaidSvg(session, `usecase_${i}`, source)
      official[title] = {
        source,
        official: svg.replace(/<style>[\s\S]*?<\/style>/g, ''),
      }
      results[title] = usecaseAgreement(
        parseOfficialUsecaseSvg(svg),
        parseOurUsecaseSvg(renderMermaidSVG(source)),
      )
    } catch (err) {
      console.error(`ERR  ${title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(title)
    }
  }
  const entry = summarizeUsecase(results, {
    date: new Date().toISOString().slice(0, 10),
    commit,
    mermaid: pinnedMermaidVersion(),
  })
  return {
    results,
    errored,
    official,
    entry,
    breaches: usecaseBreaches(results, errored),
  }
}
