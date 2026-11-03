/** Scores every architecture sample against real mermaid, for architecture-oracle.ts and layout-oracle.ts (#2451). */
import { samples } from '../../samples/samples-data.ts'
import {
  architectureAgreement,
  architectureBreaches,
  measureOurArchitecture,
  parseOfficialArchitecture,
  summarizeArchitecture,
  type ArchitectureEntry,
} from './architecture-agreement.ts'
import type { Agreement } from './layout-agreement.ts'
import { pinnedMermaidVersion } from './mermaid-pin-freshness.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface ArchitectureRun {
  results: Record<string, Agreement>
  errored: string[]
  entry: ArchitectureEntry
  breaches: string[]
}

export async function scoreArchitecture(
  session: RealMermaidSession,
  commit: string,
  filter?: string,
): Promise<ArchitectureRun> {
  const wanted = samples.filter(
    (s) =>
      /^\s*architecture-beta\b/.test(s.source) &&
      (!filter || s.title.toLowerCase().includes(filter.toLowerCase())),
  )
  const results: Record<string, Agreement> = {}
  const errored: string[] = []
  for (const [i, s] of wanted.entries()) {
    try {
      const id = `arch_${i}`
      const official = await renderRealMermaidSvg(session, id, s.source)
      results[s.title] = architectureAgreement(
        parseOfficialArchitecture(official, id),
        measureOurArchitecture(s.source),
      )
    } catch (err) {
      console.error(`ERR  ${s.title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(s.title)
    }
  }
  const entry = summarizeArchitecture(results, {
    date: new Date().toISOString().slice(0, 10),
    commit,
    mermaid: pinnedMermaidVersion(),
  })
  return {
    results,
    errored,
    entry,
    breaches: architectureBreaches(results, errored),
  }
}
