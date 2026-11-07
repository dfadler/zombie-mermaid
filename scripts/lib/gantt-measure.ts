/** Runs every gantt sample through real mermaid and diffs the figures, for gantt-oracle.ts and layout-oracle.ts (#2835). */
import { samples } from '../../samples/samples-data.ts'
import {
  ganttMismatches,
  ourGantt,
  parseOfficialGantt,
} from './gantt-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

/** Mermaid's width is its container's: the headless page body (1280 - 2 * 8). */
export const ORACLE_WIDTH = 1264

/**
 * Samples mermaid 12.3.0 itself cannot render, with its error. Each must still
 * fail there (a fix upstream turns the entry into a breach to delete).
 */
export const MERMAID_ERRORS: Record<string, RegExp> = {
  // The grammar calls `yy.TopAxis()`; ganttDb exports `enableTopAxis`.
  'Gantt: Top Axis': /TopAxis is not a function/,
}

/** Sample title -> mismatches (empty = exact). Errored samples count as breaches. */
export async function scoreGantt(
  session: RealMermaidSession,
  filter?: string,
): Promise<{
  results: Record<string, string[]>
  notes: Record<string, string[]>
  breaches: string[]
}> {
  const wanted = samples.filter(
    (s) =>
      /^\s*gantt\b/.test(s.source) &&
      (!filter || s.title.toLowerCase().includes(filter.toLowerCase())),
  )
  const results: Record<string, string[]> = {}
  const notes: Record<string, string[]> = {}
  const breaches: string[] = []
  for (const [i, s] of wanted.entries()) {
    const id = `gantt_${i}`
    try {
      const official = await renderRealMermaidSvg(session, id, s.source)
      if (MERMAID_ERRORS[s.title]) {
        breaches.push(
          `${s.title} (mermaid no longer fails: remove from MERMAID_ERRORS)`,
        )
        continue
      }
      const found = ganttMismatches(
        parseOfficialGantt(official, id),
        ourGantt(s.source, ORACLE_WIDTH),
      )
      results[s.title] = found.mismatches
      notes[s.title] = found.notes
      if (found.mismatches.length > 0)
        breaches.push(`${s.title} (${found.mismatches.length} mismatches)`)
    } catch (err) {
      const expected = MERMAID_ERRORS[s.title]
      if (expected?.test((err as Error).message)) {
        results[s.title] = []
        notes[s.title] = [`mermaid fails here as documented: ${expected}`]
        continue
      }
      console.error(`ERR  ${s.title}: ${(err as Error).message.split('\n')[0]}`)
      breaches.push(`${s.title} (error)`)
    }
  }
  return { results, notes, breaches }
}
