/** History and scorecard recording for scripts/layout-oracle.ts (#1572, #1686). */

import { appendFile, readFile, writeFile } from 'node:fs/promises'
import type { PieEntry } from './pie-agreement.ts'
import type { C4Entry } from './c4-agreement.ts'
import type { SequenceEntry } from './sequence-agreement.ts'
import {
  historyLines,
  scorecardMarkdown,
  type HistoryEntry,
  type LabelEntry,
  type ScorecardRun,
} from './layout-agreement.ts'

/** Append this run to the history file and/or rewrite the scorecard from it. */
export async function writeRecords(
  args: { history?: string; scorecard?: string },
  runs: ScorecardRun[],
  labelEntry: LabelEntry | undefined,
  sequenceEntry?: SequenceEntry,
  pieEntry?: PieEntry,
  c4Entry?: C4Entry,
): Promise<void> {
  let history = runs.map((r) => r.entry)
  let labels = labelEntry ? [labelEntry] : []
  let sequences = sequenceEntry ? [sequenceEntry] : []
  let pies = pieEntry ? [pieEntry] : []
  let c4s = c4Entry ? [c4Entry] : []
  if (args.history) {
    await appendFile(
      args.history,
      historyLines([
        ...history,
        ...labels,
        ...(sequenceEntry ? [sequenceEntry] : []),
        ...(pieEntry ? [pieEntry] : []),
        ...(c4Entry ? [c4Entry] : []),
      ]),
    )
    const all = (await readFile(args.history, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map(
        (l) =>
          JSON.parse(l) as
            | HistoryEntry
            | LabelEntry
            | SequenceEntry
            | PieEntry
            | C4Entry,
      )
    history = all.filter((e): e is HistoryEntry => !('kind' in e))
    labels = all.filter(
      (e): e is LabelEntry => 'kind' in e && e.kind === 'label',
    )
    sequences = all.filter(
      (e): e is SequenceEntry => 'kind' in e && e.kind === 'sequence',
    )
    pies = all.filter((e): e is PieEntry => 'kind' in e && e.kind === 'pie')
    c4s = all.filter((e): e is C4Entry => 'kind' in e && e.kind === 'c4')
    console.log(`Appended to ${args.history}`)
  }
  if (args.scorecard) {
    await writeFile(
      args.scorecard,
      scorecardMarkdown(runs, history, undefined, labels, sequences, pies, c4s),
    )
    console.log(`Wrote ${args.scorecard}`)
  }
}
