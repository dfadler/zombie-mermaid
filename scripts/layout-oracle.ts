/**
 * Measures how closely our flowchart layouts agree with official mermaid.js.
 *
 * Every flowchart sample in packages/site/samples-data.ts is rendered twice:
 * through real mermaid (headless Chromium, via scripts/lib/real-mermaid.ts) and
 * through our own layout engine. Node and subgraph positions are read back from
 * both, and scripts/lib/layout-agreement.ts scores how often they put the same
 * nodes above, below, beside and inside the same things.
 *
 * Usage: tsx scripts/layout-oracle.ts [--filter=<text>] [--json=<file>]
 *                                     [--fail-below=<pct>] [--tolerance=<px>]
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
 * composites and class namespaces are clusters). Other types are not covered.
 */

import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { parseMermaid } from '../src/index.ts'
import { splitStatements } from '@zombie-mermaid/core'
import {
  parseClassDiagram,
  parseErDiagram,
} from '@zombie-mermaid/mermaid-parser'
import {
  layoutClassDiagramSync,
  layoutErDiagramSync,
  layoutFlowchartSync,
  layoutGraphSync,
} from '@zombie-mermaid/svg-renderer'
import { samples } from '../packages/site/samples-data.ts'
import {
  TABLE_HEADER,
  USAGE,
  agreement,
  formatRow,
  isOfType,
  officialNodeName,
  type OracleType,
  parseOracleArgs,
  worst,
  type Box,
  type HistoryEntry,
  type SampleResult,
  scorecardMarkdown,
  summarize,
  type LayoutBoxes,
} from './lib/layout-agreement.ts'
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

/** Box of every node and subgraph in our own layout of `source`. */
function measureOurs(source: string, type: OracleType): LayoutBoxes {
  const nodes: Record<string, Box> = {}
  if (type === 'class') {
    const d = layoutClassDiagramSync(
      parseClassDiagram(splitStatements(source)),
    )
    for (const c of d.classes) {
      nodes[c.id] = { x: c.x, y: c.y, w: c.width, h: c.height }
    }
    const groups: Record<string, Box> = {}
    for (const n of d.namespaces) {
      groups[n.name] = { x: n.x, y: n.y, w: n.width, h: n.height }
    }
    return { nodes, groups }
  }
  if (type === 'er') {
    const d = layoutErDiagramSync(
      parseErDiagram(splitStatements(source)),
    )
    for (const e of d.entities) {
      nodes[e.id] = { x: e.x, y: e.y, w: e.width, h: e.height }
    }
    return { nodes, groups: {} }
  }
  const graph = parseMermaid(source)
  const positioned =
    type === 'state' ? layoutGraphSync(graph) : layoutFlowchartSync(graph)
  for (const n of positioned.nodes) {
    nodes[n.id] = { x: n.x, y: n.y, w: n.width, h: n.height }
  }
  const groups: Record<string, Box> = {}
  const walk = (list: typeof positioned.groups): void => {
    for (const g of list) {
      groups[g.id] = { x: g.x, y: g.y, w: g.width, h: g.height }
      walk(g.children)
    }
  }
  walk(positioned.groups)
  return { nodes, groups }
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

  const wanted = samples.filter(
    (s) =>
      isOfType(s.source, args.type) &&
      (!args.filter ||
        s.title.toLowerCase().includes(args.filter.toLowerCase())),
  )
  if (wanted.length === 0) {
    console.error(`No ${args.type} sample matches "${args.filter ?? ''}".`)
    return 2
  }

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
  // tsx (esbuild) wraps named functions in a `__name` helper the page lacks.
  await session.page.evaluate('window.__name = (f) => f')

  const results: Record<string, SampleResult> = {}
  const rows: string[] = []
  const failing: string[] = []
  try {
    for (const [i, sample] of wanted.entries()) {
      const hasSubgraphs = {
        state: /^\s*state\s+.*\{\s*$/m,
        class: /^\s*namespace\b/m,
        er: /$^/,
        flowchart: /\bsubgraph\b/,
      }[args.type].test(sample.source)
      try {
        const renderId = `oracle_${i}`
        const svg = await renderRealMermaidSvg(session, renderId, sample.source)
        const official = await measureOfficial(
          session.page,
          svg,
          renderId,
          args.type,
        )
        const a = agreement(
          official,
          measureOurs(sample.source, args.type),
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
  } finally {
    await session.close()
  }

  console.log(TABLE_HEADER)
  console.log(rows.join('\n'))
  if (args.json) {
    await writeFile(args.json, `${JSON.stringify(results, null, 2)}\n`)
    console.log(`\nWrote ${args.json}`)
  }
  if ((args.history || args.scorecard) && args.type !== 'flowchart') {
    // The history and scorecard track the flowchart means; mixing types would break the trend.
    console.error('--history and --scorecard are flowchart-only for now.')
    return 2
  }
  if (args.history || args.scorecard) {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim()
    const entry = summarize(results, {
      date: new Date().toISOString().slice(0, 10),
      commit,
      tolerance: args.tolerance,
    })
    let history: HistoryEntry[] = [entry]
    if (args.history) {
      await appendFile(args.history, `${JSON.stringify(entry)}\n`)
      history = (await readFile(args.history, 'utf8'))
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as HistoryEntry)
      console.log(`Appended to ${args.history}`)
    }
    if (args.scorecard) {
      await writeFile(
        args.scorecard,
        scorecardMarkdown(entry, results, history),
      )
      console.log(`Wrote ${args.scorecard}`)
    }
  }
  if (failing.length > 0) {
    console.error(`\nBelow ${args.failBelow}%: ${failing.join(', ')}`)
    return 1
  }
  return 0
}

process.exit(await main())
