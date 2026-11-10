/** Scores every requirement sample against real mermaid, for requirement-oracle.ts. */
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../../src/index.ts'
import { pinnedMermaidVersion } from './mermaid-pin-freshness.ts'
import {
  parseOfficialRequirementSvg,
  parseOurRequirementSvg,
  requirementAgreement,
  requirementBreaches,
  summarizeRequirement,
  type RequirementAgreement,
  type RequirementEntry,
} from './requirement-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'
import { REQUIREMENT_PROBES } from './requirement-probes.ts'

export interface RequirementRun {
  results: Record<string, RequirementAgreement>
  errored: string[]
  entry: RequirementEntry
  breaches: string[]
}

export async function scoreRequirement(
  session: RealMermaidSession,
  commit: string,
  filter?: string,
  /** Extra sources to score alongside the gallery samples: title -> source (default: the probes). */
  extra: Record<string, string> = REQUIREMENT_PROBES,
): Promise<RequirementRun> {
  const wanted = [
    ...samples
      .filter((s) => /^\s*requirementDiagram\b/.test(s.source))
      .map((s) => [s.title, s.source] as const),
    ...Object.entries(extra),
  ].filter(
    ([title]) => !filter || title.toLowerCase().includes(filter.toLowerCase()),
  )
  const results: Record<string, RequirementAgreement> = {}
  const errored: string[] = []
  for (const [i, [title, source]] of wanted.entries()) {
    try {
      const official = await renderRealMermaidSvg(
        session,
        `requirement_${i}`,
        source,
      )
      results[title] = requirementAgreement(
        parseOfficialRequirementSvg(official),
        parseOurRequirementSvg(renderMermaidSVG(source)),
      )
    } catch (err) {
      console.error(`ERR  ${title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(title)
    }
  }
  const entry = summarizeRequirement(results, {
    date: new Date().toISOString().slice(0, 10),
    commit,
    mermaid: pinnedMermaidVersion(),
  })
  return {
    results,
    errored,
    entry,
    breaches: requirementBreaches(results, errored),
  }
}
