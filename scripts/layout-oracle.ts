/**
 * Measures how closely our flowchart layouts agree with official mermaid.js.
 *
 * Every flowchart sample in samples/samples-data.ts is rendered twice:
 * through real mermaid (headless Chromium, via scripts/lib/real-mermaid.ts) and
 * through our own layout engine. Node and subgraph positions are read back from
 * both, and scripts/lib/layout-agreement.ts scores how often they put the same
 * nodes above, below, beside and inside the same things.
 *
 * Usage: tsx scripts/layout-oracle.ts [--filter=<text>] [--json=<file>]
 *   [--scorecard-json=<file>] [--thresholds] [--fail-below=<pct>] [--tolerance=<px>]
 *                                     [--type=flowchart|state|class|er]
 *
 * Why it exists: "true to the mermaid source" was a judgment from looking at a
 * screenshot next to mermaid's. This puts a number on it, per sample, so a
 * layout change can be checked for improving it (or at least not regressing it)
 * and the samples that still differ most are easy to find. It is a diagnostic,
 * not part of CI: it needs a Chromium install (`pnpm exec playwright install
 * chromium`) and renders through a real browser.
 *
 * Only relative placement is compared (see layout-agreement.ts for why), so
 * font and padding differences between the renderers don't count against us.
 * Flowcharts by default; `--type=state|class|er` scores the others (official
 * node ids `state-<id>-<n>`, `classId-<id>-<n>`, `entity-<id>-<n>`; state
 * composites and class namespaces are clusters). Sequence, pie and xychart are scored separately (scripts/sequence-oracle.ts,
 * scripts/pie-oracle.ts, scripts/xychart-oracle.ts, recorded in the scorecard); architecture and C4 are not scored (EXCLUDED_TYPES in scripts/lib/layout-agreement.ts).
 */

import { writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { samples } from '../samples/samples-data.ts'
import {
  pinFreshness,
  pinnedMermaidVersion,
} from './lib/mermaid-pin-freshness.ts'
import {
  TABLE_HEADER,
  USAGE,
  agreement,
  formatRow,
  wantsSample,
  officialNodeName,
  ORACLE_TYPES,
  hasGroups,
  jsonPayload,
  type OracleArgs,
  type OracleType,
  parseOracleArgs,
  type ScorecardRun,
  worst,
  type Box,
  type SampleResult,
  finishScorecard,
  recordsAllTypes,
  summarize,
  type LabelEntry,
  type LayoutBoxes,
} from './lib/layout-agreement.ts'
import { labelEntryFor } from './lib/label-position.ts'
import { writeRecords } from './lib/layout-record.ts'
import { scoreSequence } from './lib/sequence-measure.ts'
import { scoreXyChart } from './lib/xychart-measure.ts'
import type { XyEntry } from './lib/xychart-agreement.ts'
import type { SequenceEntry } from './lib/sequence-agreement.ts'
import { scorePie } from './lib/pie-measure.ts'
import type { PieEntry } from './lib/pie-agreement.ts'
import { measureOurs } from './lib/measure-ours.ts'
import { renderRealMermaidSvg, startRealMermaid } from './lib/real-mermaid.ts'

/**
 * Box of every node and subgraph in an SVG real mermaid produced. The SVG is
 * put into the page so the browser can report real positions (nodes are placed
 * with transforms, which a string parse would have to re-implement).
 */
async function measureOfficial(
  page: Page,
  svg: string,
  renderId: string,
  type: OracleType,
): Promise<LayoutBoxes> {
  const raw = await page.evaluate(
    ([markup, id]) => {
      document.body.innerHTML = markup
      const origin = document.querySelector('svg')!.getBoundingClientRect()
      const boxOf = (el: Element): Box => {
        const r = el.getBoundingClientRect()
        return { x: r.x - origin.x, y: r.y - origin.y, w: r.width, h: r.height }
      }
      const nodes: Record<string, Box> = {}
      for (const g of document.querySelectorAll('g.node')) {
        nodes[g.getAttribute('id') ?? ''] = boxOf(g)
      }
      const groups: Record<string, Box> = {}
      // Flowchart subgraphs are `g.cluster`; state composites `g.statediagram-cluster`.
      for (const g of document.querySelectorAll(
        'g.cluster, g.statediagram-cluster',
      )) {
        const rect = g.querySelector('rect')
        if (!rect) continue
        const raw = g.getAttribute('id') ?? ''
        groups[raw.startsWith(`${id}-`) ? raw.slice(id.length + 1) : raw] =
          boxOf(rect)
      }
      return { nodes, groups }
    },
    [svg, renderId] as [string, string],
  )
  const nodes: Record<string, Box> = {}
  for (const [id, box] of Object.entries(raw.nodes)) {
    nodes[officialNodeName(id, renderId, type)] = box
  }
  const groups: Record<string, Box> = {}
  for (const [id, box] of Object.entries(raw.groups)) {
    // State composites are `state-<id>-<n>`, so strip it like a node's.
    groups[type === 'state' ? officialNodeName(id, renderId, type) : id] = box
  }
  return { nodes, groups }
}

/** Score every sample of one diagram type; returns the table rows, figures and failures. */
async function scoreType(
  session: Awaited<ReturnType<typeof startRealMermaid>>,
  type: OracleType,
  args: OracleArgs,
) {
  const wanted = samples.filter((s) => wantsSample(s, type, args.filter))
  const results: Record<string, SampleResult> = {}
  const rows: string[] = []
  const failing: string[] = []
  for (const [i, sample] of wanted.entries()) {
    const hasSubgraphs = hasGroups(type, sample.source)
    try {
      const renderId = `oracle_${i}`
      const svg = await renderRealMermaidSvg(session, renderId, sample.source)
      const official = await measureOfficial(session.page, svg, renderId, type)
      const a = agreement(
        official,
        measureOurs(sample.source, type, args.layout),
        args.tolerance,
      )
      results[sample.title] = { ...a, subgraphs: hasSubgraphs }
      rows.push(formatRow(sample.title, a, hasSubgraphs))
      const low = worst(a)
      if (
        args.failBelow !== undefined &&
        low !== null &&
        low * 100 < args.failBelow
      ) {
        failing.push(`${sample.title} (${Math.round(low * 100)}%)`)
      }
    } catch (err) {
      const message = (err as Error).message.split('\n')[0]
      rows.push(`ERR  ${sample.title}: ${message}`)
      if (args.failBelow !== undefined) {
        failing.push(`${sample.title} (error)`)
      }
    }
  }
  return { wanted: wanted.map((s) => s.title), results, rows, failing }
}

async function main(): Promise<number> {
  let args
  try {
    args = parseOracleArgs(process.argv.slice(2))
  } catch (err) {
    console.error((err as Error).message)
    console.error(USAGE)
    return 2
  }
  if (args.help) {
    console.log(USAGE)
    return 0
  }

  const fresh = pinFreshness()
  if (fresh.stale) console.error(`warning: ${fresh.message}`)

  // The history and scorecard record every covered type, so --type is ignored for them.
  const recording = recordsAllTypes(args)
  const types = recording ? ORACLE_TYPES : [args.type]

  let session
  try {
    session = await startRealMermaid()
  } catch (err) {
    console.error(
      `Could not start headless Chromium: ${(err as Error).message}\n` +
        'Install it once with: pnpm exec playwright install chromium',
    )
    return 4
  }
  // Tsx (esbuild) wraps named functions in a `__name` helper the page lacks.
  await session.page.evaluate('window.__name = (f) => f')

  const runs: ScorecardRun[] = []
  let labelEntry: LabelEntry | undefined
  let sequenceEntry: SequenceEntry | undefined
  let pieEntry: PieEntry | undefined
  let xyEntry: XyEntry | undefined
  const failing: string[] = []
  const commit = recording
    ? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    : ''
  try {
    for (const type of types) {
      const scored = await scoreType(session, type, args)
      if (scored.wanted.length === 0) {
        console.error(`No ${type} sample matches "${args.filter ?? ''}".`)
        return 2
      }
      if (types.length > 1) console.log(`\n== ${type} ==`)
      console.log(TABLE_HEADER)
      console.log(scored.rows.join('\n'))
      failing.push(...scored.failing)
      runs.push({
        results: scored.results,
        sampled: scored.wanted,
        entry: summarize(scored.results, {
          date: new Date().toISOString().slice(0, 10),
          commit,
          tolerance: args.tolerance,
          type,
          mermaid: pinnedMermaidVersion(),
        }),
      })
    }
    if (recording) {
      labelEntry = await labelEntryFor(session, commit)
      const seq = await scoreSequence(session, commit)
      sequenceEntry = seq.entry
      if (args.thresholds) failing.push(...seq.breaches)
      const pie = await scorePie(session, commit)
      pieEntry = pie.entry
      if (args.thresholds) failing.push(...pie.breaches)
      const xy = await scoreXyChart(session, commit)
      xyEntry = xy.entry
      if (args.thresholds) failing.push(...xy.breaches)
    }
  } finally {
    await session.close()
  }

  if (args.json) {
    await writeFile(args.json, jsonPayload(runs))
    console.log(`\nWrote ${args.json}`)
  }
  if (recording)
    await writeRecords(args, runs, labelEntry, sequenceEntry, pieEntry, xyEntry)
  failing.push(...(await finishScorecard(args, runs)))
  if (failing.length > 0) {
    console.error(`\nBelow threshold: ${[...new Set(failing)].join(', ')}`)
    return 1
  }
  return 0
}

// Only run when executed directly, so the pure helpers can be imported by tests.
const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(process.argv[1], 'file://').href

if (isMainModule) {
  process.exit(await main())
}
