/** History and scorecard recording for scripts/layout-oracle.ts (#1572, #1686). */

import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { pinnedMermaidVersion } from './real-mermaid.ts'
import { measureLabels } from './label-position.ts'
import {
  historyLines,
  scorecardMarkdown,
  summarizeLabels,
  type HistoryEntry,
  type LabelEntry,
  type ScorecardRun,
} from './layout-agreement.ts'

/** Edge-label placement for the history and scorecard, descriptive only. */
export async function labelEntryFor(
  session: Parameters<typeof measureLabels>[0],
  commit: string,
): Promise<LabelEntry> {
  return summarizeLabels(await measureLabels(session), {
    date: new Date().toISOString().slice(0, 10),
    commit,
    mermaid: pinnedMermaidVersion(),
  })
}

/** Append this run to the history file and/or rewrite the scorecard from it. */
export async function writeRecords(
  args: { history?: string; scorecard?: string },
  runs: ScorecardRun[],
  labelEntry: LabelEntry | undefined,
): Promise<void> {
  let history = runs.map((r) => r.entry)
  let labels = labelEntry ? [labelEntry] : []
  if (args.history) {
    await appendFile(args.history, historyLines([...history, ...labels]))
    const all = (await readFile(args.history, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as HistoryEntry | LabelEntry)
    history = all.filter((e): e is HistoryEntry => !('kind' in e))
    labels = all.filter((e): e is LabelEntry => 'kind' in e)
    console.log(`Appended to ${args.history}`)
  }
  if (args.scorecard) {
    await writeFile(
      args.scorecard,
      scorecardMarkdown(runs, history, undefined, labels),
    )
    console.log(`Wrote ${args.scorecard}`)
  }
}
