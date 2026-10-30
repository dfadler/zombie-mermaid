/** History and scorecard recording for scripts/layout-oracle.ts (#1572, #1686). */

import { appendFile, readFile, writeFile } from 'node:fs/promises'
import type { PieEntry } from './pie-agreement.ts'
import type { SequenceEntry } from './sequence-agreement.ts'
import type { XyEntry } from './xychart-agreement.ts'
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
  xyEntry?: XyEntry,
): Promise<void> {
  let history = runs.map((r) => r.entry)
  let labels = labelEntry ? [labelEntry] : []
  let sequences = sequenceEntry ? [sequenceEntry] : []
  let pies = pieEntry ? [pieEntry] : []
  let xycharts = xyEntry ? [xyEntry] : []
  if (args.history) {
    await appendFile(
      args.history,
      historyLines([
        ...history,
        ...labels,
        ...(sequenceEntry ? [sequenceEntry] : []),
        ...(pieEntry ? [pieEntry] : []),
        ...(xyEntry ? [xyEntry] : []),
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
            | XyEntry,
      )
    history = all.filter((e): e is HistoryEntry => !('kind' in e))
    labels = all.filter(
      (e): e is LabelEntry => 'kind' in e && e.kind === 'label',
    )
    sequences = all.filter(
      (e): e is SequenceEntry => 'kind' in e && e.kind === 'sequence',
    )
    pies = all.filter((e): e is PieEntry => 'kind' in e && e.kind === 'pie')
    xycharts = all.filter(
      (e): e is XyEntry => 'kind' in e && e.kind === 'xychart',
    )
    console.log(`Appended to ${args.history}`)
  }
  if (args.scorecard) {
    await writeFile(
      args.scorecard,
      scorecardMarkdown(
        runs,
        history,
        undefined,
        labels,
        sequences,
        pies,
        xycharts,
      ),
    )
    console.log(`Wrote ${args.scorecard}`)
  }
}
