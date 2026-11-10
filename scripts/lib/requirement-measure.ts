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

export interface RequirementRun {
  results: Record<string, RequirementAgreement>
  errored: string[]
  entry: RequirementEntry
  breaches: string[]
}

const probeBox = (id: string): string =>
  `requirement ${id} {\nid: ${id}\ntext: t${id}\nrisk: low\nverifymethod: test\n}`

/** Layouts the gallery lacks (#2966): shared targets, a parallel pair, a cycle. */
export const REQUIREMENT_PROBES: Record<string, string> = {
  'Probe: shared targets': `requirementDiagram\n${['a', 'b', 'c', 'd'].map(probeBox).join('\n')}\na - contains -> b\na - contains -> c\nd - satisfies -> b\nd - satisfies -> c`,
  'Probe: parallel pair': `requirementDiagram\n${['a', 'e'].map(probeBox).join('\n')}\ne - satisfies -> a\ne - verifies -> a`,
  'Probe: cycle': `requirementDiagram\n${['a', 'b', 'c'].map(probeBox).join('\n')}\na - contains -> b\nb - contains -> c\nc - contains -> a`,
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
