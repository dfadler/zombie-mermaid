/** Scores every timeline sample against real mermaid, for timeline-oracle.ts (#2845). */
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../../src/index.ts'
import { pinnedMermaidVersion } from './mermaid-pin-freshness.ts'
import {
  parseTimelineSvg,
  summarizeTimeline,
  timelineAgreement,
  timelineBreaches,
  type TimelineAgreement,
  type TimelineEntry,
} from './timeline-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface TimelineRun {
  results: Record<string, TimelineAgreement>
  errored: string[]
  entry: TimelineEntry
  breaches: string[]
}

export async function scoreTimeline(
  session: RealMermaidSession,
  commit: string,
  filter?: string,
  /** Extra sources to score alongside the gallery samples: title -> source. */
  extra: Record<string, string> = {},
): Promise<TimelineRun> {
  const wanted = [
    ...samples
      .filter((s) => /^\s*timeline\b/.test(s.source))
      .map((s) => [s.title, s.source] as const),
    ...Object.entries(extra),
  ].filter(
    ([title]) => !filter || title.toLowerCase().includes(filter.toLowerCase()),
  )
  const results: Record<string, TimelineAgreement> = {}
  const errored: string[] = []
  for (const [i, [title, source]] of wanted.entries()) {
    try {
      const official = await renderRealMermaidSvg(
        session,
        `timeline_${i}`,
        source,
      )
      results[title] = timelineAgreement(
        parseTimelineSvg(official),
        parseTimelineSvg(renderMermaidSVG(source)),
      )
    } catch (err) {
      console.error(`ERR  ${title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(title)
    }
  }
  const entry = summarizeTimeline(results, {
    date: new Date().toISOString().slice(0, 10),
    commit,
    mermaid: pinnedMermaidVersion(),
  })
  return {
    results,
    errored,
    entry,
    breaches: timelineBreaches(results, errored),
  }
}
