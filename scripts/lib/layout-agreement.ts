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
  /** Which diagram type to score; flowchart unless `--type=` says otherwise. */
  type: OracleType
  help: boolean
}

/** Diagram types the oracle can score. */
export type OracleType = 'flowchart' | 'state' | 'class' | 'er'

export const ORACLE_TYPES: readonly OracleType[] = [
  'flowchart',
  'state',
  'class',
  'er',
]

const TYPE_HEADER: Record<OracleType, RegExp> = {
  flowchart: /^\s*(graph|flowchart)\b/,
  state: /^\s*stateDiagram(-v2)?\b/,
  class: /^\s*classDiagram(-v2)?\b/,
  er: /^\s*erDiagram\b/,
}

/** The word real mermaid puts between the render id and our node id. */
const OFFICIAL_PREFIX: Record<OracleType, string> = {
  flowchart: 'flowchart',
  state: 'state',
  class: 'classId',
  er: 'entity',
}

/** Whether `source` is a diagram of `type` (by its header line). */
export function isOfType(source: string, type: OracleType): boolean {
  return TYPE_HEADER[type].test(source)
}

/**
 * Our node id for an element id real mermaid wrote into its SVG
 * (`<renderId>-flowchart-<id>-<n>` / `<renderId>-state-<id>-<n>`; the id may
 * contain hyphens). Mermaid names the top-level pseudostates `root_start` and
 * `root_end`; we call them `_start` and `_end`.
 */
export function officialNodeName(
  raw: string,
  renderId: string,
  type: OracleType,
): string {
  const prefix = OFFICIAL_PREFIX[type]
  let name = raw.replace(`${renderId}-${prefix}-`, '')
  if (name.startsWith(`${prefix}-`)) name = name.slice(prefix.length + 1)
  name = name.replace(/-\d+$/, '')
  return type === 'state' ? name.replace(/^root_(start|end)$/, '_$1') : name
}

export const USAGE = `Usage: tsx scripts/layout-oracle.ts [options]

Compares our layout of each flowchart, state, class or ER sample with the one official
mermaid.js draws, as the share of node pairs placed in the same relation.

  --type=<kind>        flowchart (default), state, class or er
  --filter=<text>      only samples whose title contains <text>
  --json=<file>        write the per-sample figures to <file>
  --history=<file>     append one summary line per type to <file> (JSON Lines); scores all four types
  --scorecard=<file>   write a Markdown scorecard to <file> (trend read from --history); scores all four types
  --fail-below=<pct>   exit 1 if any sample's lowest figure is under <pct> (0-100)
  --tolerance=<px>     centres this close count as level (default ${DEFAULT_TOLERANCE})
  -h, --help           show this help
`

/** Parse `argv` (without the node and script entries). Throws on anything unknown. */
export function parseOracleArgs(argv: string[]): OracleArgs {
  const args: OracleArgs = {
    tolerance: DEFAULT_TOLERANCE,
    type: 'flowchart',
    help: false,
  }
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
    else if (name === 'type') {
      if (!(ORACLE_TYPES as readonly string[]).includes(value)) {
        throw new Error(`--type is ${ORACLE_TYPES.join(', ')}, got "${value}"`)
      }
      args.type = value as OracleType
    } else if (name === 'json') args.json = value
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

/** One tracked data point: mean agreement over every sample of one diagram type. */
export interface HistoryEntry {
  date: string
  commit: string
  tolerance: number
  /** Diagram type scored; entries recorded before #1905 omit it and are flowcharts. */
  type?: OracleType
  /** mermaid version of the reference; entries recorded before #1905 omit it (11.17.2). */
  mermaid?: string
  /** Samples scored. */
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
  meta: {
    date: string
    commit: string
    tolerance: number
    type: OracleType
    mermaid: string
  },
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

const TYPE_LABEL: Record<OracleType, string> = {
  flowchart: 'Flowchart',
  state: 'State',
  class: 'Class',
  er: 'ER',
}

/** Reference version of entries recorded before the field existed (#1905). */
const LEGACY_MERMAID = '11.17.2'

/** One scored diagram type: its summary entry and per-sample figures. */
export interface ScorecardRun {
  entry: HistoryEntry
  results: Record<string, SampleResult>
}

/**
 * Markdown scorecard: the latest run per diagram type, the recorded trend and
 * each type's per-sample figures (lowest first). Descriptive only; no
 * pass/fail threshold.
 */
export function scorecardMarkdown(
  runs: ScorecardRun[],
  history: HistoryEntry[],
  command = 'pnpm run layout:scorecard',
): string {
  const first = runs[0]!.entry
  const means = runs.map(
    ({ entry: e }) =>
      `| ${TYPE_LABEL[e.type ?? 'flowchart']} | ${e.samples} | ${cell(e.vertical)} | ${cell(e.horizontal)} | ${cell(e.containment)} |`,
  )
  const trend = history
    .slice(-20)
    .map(
      (h) =>
        `| ${h.date} | ${h.commit.slice(0, 7)} | ${h.mermaid ?? LEGACY_MERMAID} | ${TYPE_LABEL[h.type ?? 'flowchart']} | ${h.samples} | ${cell(h.vertical)} | ${cell(h.horizontal)} | ${cell(h.containment)} |`,
    )
  const sections = runs.map(({ entry, results }) => {
    const rows = Object.entries(results)
      .sort(([, a], [, b]) => (worst(a) ?? 2) - (worst(b) ?? 2))
      .map(
        ([t, r]) =>
          `| ${t.replace(/\|/g, '\\|')} | ${cell(r.vertical)} | ${cell(r.horizontal)} | ${cell(r.containment)} | ${r.nodes} |`,
      )
    return `### ${TYPE_LABEL[entry.type ?? 'flowchart']} (lowest first)

| Sample | Vertical | Horizontal | Containment | Nodes |
| --- | --- | --- | --- | --- |
${rows.join('\n')}`
  })
  return `<!-- Generated by \`${command}\`. Do not edit by hand. -->

# Layout-fidelity scorecard

How closely our flowchart, state, class and ER layouts match official
mermaid.js: the share of node pairs placed in the same above/below/beside
relation (\`vertical\`, \`horizontal\`) and of node/subgraph pairs that agree on
containment. Only relative placement is compared. These are descriptive
figures, not pass/fail thresholds. Method: \`scripts/layout-oracle.ts\`.

Reference: mermaid ${first.mermaid ?? LEGACY_MERMAID}. Since mermaid 12.0.0 its default layout engine for
these diagram types is ELK (it was dagre before). Generated ${first.date} at
${first.commit.slice(0, 7)} with \`${command}\`, tolerance ${first.tolerance}px.

## Latest run (means over samples)

| Type | Samples | Vertical | Horizontal | Containment |
| --- | --- | --- | --- | --- |
${means.join('\n')}

## Trend (last 20 recorded runs)

Runs recorded before 12.1.0 were measured against mermaid 11.17.2 (dagre) and
cover flowcharts only. The reference changed engine, so do not read a trend
across that change.

| Date | Commit | Mermaid | Type | Samples | Vertical | Horizontal | Containment |
| --- | --- | --- | --- | --- | --- | --- | --- |
${trend.join('\n')}

## Per sample

${sections.join('\n\n')}
`
}
