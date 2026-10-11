/**
 * How closely our layout of a diagram agrees with the one official mermaid.js
 * draws, as numbers. Used by scripts/layout-oracle.ts, which gets the official
 * positions from real mermaid in headless Chromium.
 *
 * The two renderers use different font metrics, padding and node sizes, so
 * absolute coordinates never match. What "true to the mermaid source" means for
 * layout is the arrangement: which node is above, below, left of or inside
 * which. So the comparison is relational. For every pair of nodes both layouts
 * contain, it asks whether the two layouts put them in the same vertical
 * relation (above, below, or level) and the same horizontal one.
 */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Node and subgraph boxes by id, in any common coordinate space per layout. */
export interface LayoutBoxes {
  nodes: Record<string, Box>
  groups: Record<string, Box>
}

/**
 * Two centres within this many px count as level. About a third of a default
 * node's height: enough to absorb the two renderers' different node sizes and
 * spacing, too little to call a different row the same one.
 */
export const DEFAULT_TOLERANCE = 20

/** Each figure is 0..1, or null when the layouts share too little to compare. */
export interface Agreement {
  /** Pairs of nodes in the same above / below / level relation. */
  vertical: number | null
  /** Pairs of nodes in the same left / right / level relation. */
  horizontal: number | null
  /** (node, subgraph) pairs that agree on whether the node is inside the subgraph. */
  containment: number | null
  /** Nodes present in both layouts. */
  nodes: number
}

const centreX = (b: Box): number => b.x + b.w / 2
const centreY = (b: Box): number => b.y + b.h / 2

/** -1, 0 or 1: whether `a` is before, level with, or after `b`. */
function relation(a: number, b: number, tolerance: number): -1 | 0 | 1 {
  if (Math.abs(a - b) <= tolerance) return 0
  return a < b ? -1 : 1
}

function inside(node: Box, group: Box): boolean {
  const x = centreX(node)
  const y = centreY(node)
  return (
    x >= group.x &&
    x <= group.x + group.w &&
    y >= group.y &&
    y <= group.y + group.h
  )
}

/** How well `ours` agrees with `official`. Ids present in only one are ignored. */
export function agreement(
  official: LayoutBoxes,
  ours: LayoutBoxes,
  tolerance: number = DEFAULT_TOLERANCE,
): Agreement {
  const ids = Object.keys(official.nodes).filter((id) => id in ours.nodes)

  let pairs = 0
  let vertical = 0
  let horizontal = 0
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]!
      const b = ids[j]!
      pairs++
      if (
        relation(
          centreY(official.nodes[a]!),
          centreY(official.nodes[b]!),
          tolerance,
        ) ===
        relation(centreY(ours.nodes[a]!), centreY(ours.nodes[b]!), tolerance)
      ) {
        vertical++
      }
      if (
        relation(
          centreX(official.nodes[a]!),
          centreX(official.nodes[b]!),
          tolerance,
        ) ===
        relation(centreX(ours.nodes[a]!), centreX(ours.nodes[b]!), tolerance)
      ) {
        horizontal++
      }
    }
  }

  const groupIds = Object.keys(official.groups).filter(
    (id) => id in ours.groups,
  )
  let memberships = 0
  let agreeing = 0
  for (const g of groupIds) {
    for (const id of ids) {
      memberships++
      if (
        inside(official.nodes[id]!, official.groups[g]!) ===
        inside(ours.nodes[id]!, ours.groups[g]!)
      ) {
        agreeing++
      }
    }
  }

  return {
    vertical: pairs > 0 ? vertical / pairs : null,
    horizontal: pairs > 0 ? horizontal / pairs : null,
    containment: memberships > 0 ? agreeing / memberships : null,
    nodes: ids.length,
  }
}

/** The lowest of the figures that exist, or null if none do. */
export function worst(a: Agreement): number | null {
  const figures = [a.vertical, a.horizontal, a.containment].filter(
    (n): n is number => n !== null,
  )
  return figures.length > 0 ? Math.min(...figures) : null
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

export interface OracleArgs {
  /** Only samples whose title contains this, case-insensitively. */
  filter?: string
  /** Write the per-sample figures to this file as JSON. */
  json?: string
  /** Append a one-line summary of this run to this JSON Lines file. */
  history?: string
  /** Write a Markdown scorecard (this run, plus the trend from --history) to this file. */
  scorecard?: string
  /** Fail (exit 1) if any sample's worst figure is below this percentage. */
  failBelow?: number
  tolerance: number
  help: boolean
}

export const USAGE = `Usage: tsx scripts/layout-oracle.ts [options]

Compares our layout of each flowchart sample with the one official mermaid.js
draws, as the share of node pairs placed in the same relation.

  --filter=<text>      only samples whose title contains <text>
  --json=<file>        write the per-sample figures to <file>
  --history=<file>     append a one-line summary of this run to <file> (JSON Lines)
  --scorecard=<file>   write a Markdown scorecard to <file> (trend read from --history)
  --fail-below=<pct>   exit 1 if any sample's lowest figure is under <pct> (0-100)
  --tolerance=<px>     centres this close count as level (default ${DEFAULT_TOLERANCE})
  -h, --help           show this help
`

/** Parse `argv` (without the node and script entries). Throws on anything unknown. */
export function parseOracleArgs(argv: string[]): OracleArgs {
  const args: OracleArgs = { tolerance: DEFAULT_TOLERANCE, help: false }
  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
      args.help = true
      continue
    }
    // pnpm forwards the `--` in `pnpm run layout:oracle -- --filter=x` to the
    // script. (The `--` is needed: pnpm claims `--filter` for itself without it.)
    if (arg === '--') continue
    const match = /^--([a-z-]+)=(.*)$/.exec(arg)
    if (!match) throw new Error(`Unknown argument: ${arg}`)
    const [, name, value] = match as unknown as [string, string, string]
    if (name === 'filter') args.filter = value
    else if (name === 'json') args.json = value
    else if (name === 'history') args.history = value
    else if (name === 'scorecard') args.scorecard = value
    else if (name === 'fail-below' || name === 'tolerance') {
      const n = Number(value)
      if (value === '' || !Number.isFinite(n) || n < 0) {
        throw new Error(`--${name} needs a non-negative number, got "${value}"`)
      }
      if (name === 'fail-below') {
        if (n > 100)
          throw new Error(`--fail-below is a percentage (0-100), got ${n}`)
        args.failBelow = n
      } else {
        args.tolerance = n
      }
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return args
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const pct = (n: number | null): string =>
  n === null ? '  - ' : `${Math.round(n * 100)}%`.padStart(4)

/** One table row: the three figures, whether it has subgraphs, node count, title. */
export function formatRow(
  title: string,
  a: Agreement,
  hasSubgraphs: boolean,
): string {
  return `${pct(a.vertical)} ${pct(a.horizontal)} ${pct(a.containment)}  ${hasSubgraphs ? 'sg' : '  '}  ${String(a.nodes).padStart(3)}  ${title}`
}

export const TABLE_HEADER = ' vert horiz   in   sg  nodes  sample'

// ---------------------------------------------------------------------------
// Scorecard
// ---------------------------------------------------------------------------

export type SampleResult = Agreement & { subgraphs: boolean }

/** One tracked data point: mean agreement over every flowchart sample. */
export interface HistoryEntry {
  date: string
  commit: string
  tolerance: number
  /** Samples scored (flowcharts only; other diagram types are not covered yet). */
  samples: number
  /** Mean of each figure over the samples that have it, 0..1; null if none do. */
  vertical: number | null
  horizontal: number | null
  containment: number | null
}

const mean = (xs: (number | null)[]): number | null => {
  const v = xs.filter((n): n is number => n !== null)
  return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Collapse per-sample results into one history entry. */
export function summarize(
  results: Record<string, SampleResult>,
  meta: { date: string; commit: string; tolerance: number },
): HistoryEntry {
  const all = Object.values(results)
  return {
    ...meta,
    samples: all.length,
    vertical: mean(all.map((r) => r.vertical)),
    horizontal: mean(all.map((r) => r.horizontal)),
    containment: mean(all.map((r) => r.containment)),
  }
}

const cell = (n: number | null): string =>
  n === null ? '-' : `${Math.round(n * 100)}%`

/**
 * Markdown scorecard: the latest run, its per-sample figures (lowest first)
 * and the recorded trend. Descriptive only; no pass/fail threshold.
 */
export function scorecardMarkdown(
  latest: HistoryEntry,
  results: Record<string, SampleResult>,
  history: HistoryEntry[],
): string {
  const rows = Object.entries(results)
    .sort(([, a], [, b]) => (worst(a) ?? 2) - (worst(b) ?? 2))
    .map(
      ([t, r]) =>
        `| ${t.replace(/\|/g, '\\|')} | ${cell(r.vertical)} | ${cell(r.horizontal)} | ${cell(r.containment)} | ${r.nodes} |`,
    )
  const trend = history
    .slice(-20)
    .map(
      (h) =>
        `| ${h.date} | ${h.commit.slice(0, 7)} | ${h.samples} | ${cell(h.vertical)} | ${cell(h.horizontal)} | ${cell(h.containment)} |`,
    )
  return `<!-- Generated by \`pnpm run layout:scorecard\`. Do not edit by hand. -->
# Layout-fidelity scorecard

How closely our flowchart layouts match official mermaid.js: the share of node
pairs placed in the same above/below/beside relation (\`vertical\`,
\`horizontal\`) and of node/subgraph pairs that agree on containment. Only
relative placement is compared. Flowcharts only so far. These are descriptive
figures, not pass/fail thresholds. Method: \`scripts/layout-oracle.ts\`.

Latest run (${latest.date}, ${latest.commit.slice(0, 7)}, ${latest.samples} samples, tolerance ${latest.tolerance}px):
vertical **${cell(latest.vertical)}**, horizontal **${cell(latest.horizontal)}**, containment **${cell(latest.containment)}** (means over samples).

## Trend (last 20 recorded runs)

| Date | Commit | Samples | Vertical | Horizontal | Containment |
| --- | --- | --- | --- | --- | --- |
${trend.join('\n')}

## Per sample (lowest first)

| Sample | Vertical | Horizontal | Containment | Nodes |
| --- | --- | --- | --- | --- |
${rows.join('\n')}
`
}
