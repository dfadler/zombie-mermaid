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
 * Flowcharts only for now: the official node ids it reads back
 * (`flowchart-<id>-<n>`) are flowchart-specific.
 */

import { writeFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { parseMermaid } from '../src/index.ts'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'
import { samples } from '../packages/site/samples-data.ts'
import {
  TABLE_HEADER,
  USAGE,
  agreement,
  formatRow,
  parseOracleArgs,
  worst,
  type Agreement,
  type Box,
  type LayoutBoxes,
} from './lib/layout-agreement.ts'
import { renderRealMermaidSvg, startRealMermaid } from './lib/real-mermaid.ts'

/** Whether `source` is a flowchart, the only diagram type compared here. */
function isFlowchart(source: string): boolean {
  return /^\s*(graph|flowchart)\b/.test(source)
}

/**
 * Box of every node and subgraph in an SVG real mermaid produced. The SVG is
 * put into the page so the browser can report real positions (nodes are placed
 * with transforms, which a string parse would have to re-implement).
 */
async function measureOfficial(
  page: Page,
  svg: string,
  renderId: string,
): Promise<LayoutBoxes> {
  return page.evaluate(
    ([markup, id]) => {
      document.body.innerHTML = markup
      const origin = document.querySelector('svg')!.getBoundingClientRect()
      const boxOf = (el: Element): Box => {
        const r = el.getBoundingClientRect()
        return { x: r.x - origin.x, y: r.y - origin.y, w: r.width, h: r.height }
      }
      const nodes: Record<string, Box> = {}
      for (const g of document.querySelectorAll('g.node')) {
        // `<renderId>-flowchart-<nodeId>-<n>`; the node id may itself contain hyphens.
        const raw = g.getAttribute('id') ?? ''
        const name = raw
          .replace(`${id}-flowchart-`, '')
          .replace(/^flowchart-/, '')
          .replace(/-\d+$/, '')
        nodes[name] = boxOf(g)
      }
      const groups: Record<string, Box> = {}
      for (const g of document.querySelectorAll('g.cluster')) {
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
}

/** Box of every node and subgraph in our own layout of `source`. */
function measureOurs(source: string): LayoutBoxes {
  const positioned = layoutGraphSync(parseMermaid(source))
  const nodes: Record<string, Box> = {}
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
      isFlowchart(s.source) &&
      (!args.filter ||
        s.title.toLowerCase().includes(args.filter.toLowerCase())),
  )
  if (wanted.length === 0) {
    console.error(`No flowchart sample matches "${args.filter ?? ''}".`)
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

  const results: Record<string, Agreement & { subgraphs: boolean }> = {}
  const rows: string[] = []
  const failing: string[] = []
  try {
    for (const [i, sample] of wanted.entries()) {
      const hasSubgraphs = /\bsubgraph\b/.test(sample.source)
      try {
        const renderId = `oracle_${i}`
        const svg = await renderRealMermaidSvg(session, renderId, sample.source)
        const official = await measureOfficial(session.page, svg, renderId)
        const a = agreement(
          official,
          measureOurs(sample.source),
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
        rows.push(
          `ERR  ${sample.title}: ${(err as Error).message.split('\n')[0]}`,
        )
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
  if (failing.length > 0) {
    console.error(`\nBelow ${args.failBelow}%: ${failing.join(', ')}`)
    return 1
  }
  return 0
}

process.exit(await main())
