/** History and scorecard recording for scripts/layout-oracle.ts (#1572, #1686). */

import { appendFile, readFile, writeFile } from 'node:fs/promises'
import type { ArchitectureEntry } from './architecture-agreement.ts'
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
  architectureEntry?: ArchitectureEntry,
): Promise<void> {
  let history = runs.map((r) => r.entry)
  let labels = labelEntry ? [labelEntry] : []
  let sequences = sequenceEntry ? [sequenceEntry] : []
  let architectures = architectureEntry ? [architectureEntry] : []
  if (args.history) {
    await appendFile(
      args.history,
      historyLines([
        ...history,
        ...labels,
        ...(sequenceEntry ? [sequenceEntry] : []),
        ...(architectureEntry ? [architectureEntry] : []),
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
            | ArchitectureEntry,
      )
    history = all.filter((e): e is HistoryEntry => !('kind' in e))
    labels = all.filter(
      (e): e is LabelEntry => 'kind' in e && e.kind === 'label',
    )
    sequences = all.filter(
      (e): e is SequenceEntry => 'kind' in e && e.kind === 'sequence',
    )
    architectures = all.filter(
      (e): e is ArchitectureEntry => 'kind' in e && e.kind === 'architecture',
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
        architectures,
      ),
    )
    console.log(`Wrote ${args.scorecard}`)
  }
}
