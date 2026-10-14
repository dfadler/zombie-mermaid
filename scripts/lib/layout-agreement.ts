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

import { writeFile } from 'node:fs/promises'

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
  /** Write the stable machine-readable scorecard (JSON, schema in `scorecardJson`) to this file. */
  scorecardJson?: string
  /** Exit 1 if any sample is under its explicit floor (see `floorFor`) or errored unexpectedly. */
  thresholds: boolean
  tolerance: number
  /** Which diagram type to score; flowchart unless `--type=` says otherwise. */
  type: OracleType
  /** Our layout engine to score: `elk` (default) or the built-in `simple` (#1685). Flowcharts only. */
  layout: 'elk' | 'simple'
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

/** Whether a sample is of `type` and its title contains the `--filter` text. */
export function wantsSample(
  s: { title: string; source: string },
  type: OracleType,
  filter?: string,
): boolean {
  return (
    isOfType(s.source, type) &&
    (!filter || s.title.toLowerCase().includes(filter.toLowerCase()))
  )
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
  --scorecard-json=<file>  write the stable machine-readable scorecard (JSON) to <file>; scores all four types
  --thresholds         exit 1 if any sample is under its explicit floor (see SAMPLE_FLOORS in scripts/lib/layout-agreement.ts)
  --fail-below=<pct>   exit 1 if any sample's lowest figure is under <pct> (0-100)
  --layout=<engine>    elk (default) or simple (built-in, flowchart only, #1685)
  --tolerance=<px>     centres this close count as level (default ${DEFAULT_TOLERANCE})
  -h, --help           show this help
`

/** Parse `argv` (without the node and script entries). Throws on anything unknown. */
export function parseOracleArgs(argv: string[]): OracleArgs {
  const args: OracleArgs = {
    tolerance: DEFAULT_TOLERANCE,
    type: 'flowchart',
    layout: 'elk',
    thresholds: false,
    help: false,
  }
  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
      args.help = true
      continue
    }
    if (arg === '--thresholds') {
      args.thresholds = true
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
    } else if (name === 'layout') {
      if (value !== 'elk' && value !== 'simple') {
        throw new Error(`--layout is elk or simple, got "${value}"`)
      }
      args.layout = value
    } else if (name === 'json') args.json = value
    else if (name === 'history') args.history = value
    else if (name === 'scorecard') args.scorecard = value
    else if (name === 'scorecard-json') {
      if (value === '') throw new Error('--scorecard-json needs a file path')
      args.scorecardJson = value
    } else if (name === 'fail-below' || name === 'tolerance') {
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
  if (args.layout === 'simple' && args.type !== 'flowchart') {
    throw new Error('--layout=simple only lays out flowcharts.')
  }
  if (
    args.layout !== 'elk' &&
    (args.history || args.scorecard || args.scorecardJson || args.thresholds)
  ) {
    throw new Error(
      '--history, --scorecard, --scorecard-json and --thresholds record the elk layout only.',
    )
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

/** Whether a sample declares subgraphs (flowchart), composite states or namespaces. */
export function hasGroups(type: OracleType, source: string): boolean {
  return {
    state: /^\s*state\s+.*\{\s*$/m,
    class: /^\s*namespace\b/m,
    er: /$^/,
    flowchart: /\bsubgraph\b/,
  }[type].test(source)
}

/** `--json` file body: bare figures for one type, keyed by type for several. */
export function jsonPayload(runs: ScorecardRun[]): string {
  const out =
    runs.length === 1
      ? runs[0]!.results
      : Object.fromEntries(runs.map((r) => [r.entry.type, r.results]))
  return `${JSON.stringify(out, null, 2)}\n`
}

/** History entries as JSON Lines, ready to append. */
export function historyLines(entries: HistoryEntry[]): string {
  return entries.map((e) => `${JSON.stringify(e)}\n`).join('')
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/**
 * The lowest acceptable "worst figure" (0..1) for a sample unless it has its
 * own entry in `SAMPLE_FLOORS`. A sample passes when its worst figure is at or
 * above its floor. Floors are regression guards at today's level, not claims
 * of parity: a layout change may not push a sample under its floor, and an
 * improvement should raise the floor in the same PR (ratchet).
 */
export const DEFAULT_FLOOR = 0.85

/**
 * Samples that sit below `DEFAULT_FLOOR` today (mermaid 12.1.0, tolerance
 * 20px), each pinned just under its measured figure. Class 67%: parent not
 * centred over its children (#2020). The flowchart ones are cross-axis
 * differences (#1834).
 */
export const SAMPLE_FLOORS: Readonly<Record<string, number>> = {
  'Nested Subgraphs': 0.2,
  'CI/CD Pipeline': 0.45,
  'Flowchart: CJK Labels': 0.5,
  'Flowchart: Five Cluster Exit Siblings (TD)': 0.65,
  'State: Notes': 0.8,
  'Class: Inheritance (<|--)': 0.65,
  'Class: Relationship Labels': 0.65,
  'Class: MVC Architecture': 0.65,
  'Class: Namespaces': 0.65,
}

/** Samples real mermaid itself rejects, so an oracle error is expected, not a regression. */
export const EXPECTED_ERRORS: readonly string[] = ['zombie-mermaid']

/**
 * Diagram types the oracle does not score, and why. A relative-placement
 * comparison only means something where both renderers run a layout engine
 * over a graph and source order does not dictate positions.
 */
export const EXCLUDED_TYPES: Readonly<Record<string, string>> = {
  sequence:
    'mermaid draws it on a fixed grid (participants left to right in declaration order, messages top to bottom in source order), not with a layout engine, and emits no g.node elements. Agreement would be 100% by construction.',
  'architecture-beta':
    'we have no architecture layout to measure, and mermaid places services with cytoscape fcose constrained by the explicit L/R/T/B port directions in the source.',
  'pie, xychart-beta':
    'no nodes: positions come from data values, so there is no arrangement to compare.',
  c4: 'mermaid places C4 boxes on a fixed grid in shape order, not with a layout engine over edges.',
}

const EPS = 1e-9

/** The floor that applies to a sample title. */
export function floorFor(title: string): number {
  return SAMPLE_FLOORS[title] ?? DEFAULT_FLOOR
}

export type SampleStatus = 'pass' | 'fail' | 'n/a'

/** Pass/fail of one sample against its floor; `n/a` when it has no figures (a single node). */
export function sampleStatus(
  title: string,
  a: Agreement,
  floor: number = floorFor(title),
): SampleStatus {
  const low = worst(a)
  if (low === null) return 'n/a'
  return low + EPS >= floor ? 'pass' : 'fail'
}

/** Samples under their floor, or errored when that was not expected; empty when within thresholds. */
export function breaches(runs: ScorecardRun[]): string[] {
  const out: string[] = []
  for (const { results, sampled = [] } of runs) {
    for (const [title, r] of Object.entries(results)) {
      if (sampleStatus(title, r) === 'fail') {
        out.push(
          `${title} (${Math.round(worst(r)! * 100)}% < ${Math.round(floorFor(title) * 100)}%)`,
        )
      }
    }
    for (const t of sampled) {
      if (!(t in results) && !EXPECTED_ERRORS.includes(t)) {
        out.push(`${t} (error)`)
      }
    }
  }
  return out
}

/** Whether the run scores every type (history, scorecard, JSON, thresholds), so `--type` is ignored. */
export const recordsAllTypes = (a: OracleArgs): boolean =>
  Boolean(a.history || a.scorecard || a.scorecardJson || a.thresholds)

/** Writes `--scorecard-json` if asked; returns the `--thresholds` breaches (none unless asked). */
export async function finishScorecard(
  args: OracleArgs,
  runs: ScorecardRun[],
): Promise<string[]> {
  if (args.scorecardJson) {
    await writeFile(args.scorecardJson, scorecardJson(runs))
  }
  return args.thresholds ? breaches(runs) : []
}

/** Bumped when the shape of `scorecardJson` changes incompatibly. */
export const SCORECARD_SCHEMA = 1

const r4 = (n: number | null): number | null =>
  n === null ? null : Math.round(n * 1e4) / 1e4

/**
 * Stable machine-readable scorecard: fixed key order, samples sorted by title,
 * figures rounded to 4 places, so two runs on the same code diff to nothing.
 * Shape: { schema, mermaid, tolerance, commit, date, defaultFloor, excluded,
 * types: { <type>: { summary: {samples, vertical, horizontal, containment},
 * passing, failing, samples: [{title, vertical, horizontal, containment,
 * nodes, subgraphs, floor, status}], errored: [title] } } }.
 */
export function scorecardJson(runs: ScorecardRun[]): string {
  const first = runs[0]!.entry
  const types: Record<string, unknown> = {}
  for (const { entry, results, sampled = [] } of runs) {
    const samples = Object.entries(results)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([title, r]) => ({
        title,
        vertical: r4(r.vertical),
        horizontal: r4(r.horizontal),
        containment: r4(r.containment),
        nodes: r.nodes,
        subgraphs: r.subgraphs,
        floor: floorFor(title),
        status: sampleStatus(title, r),
      }))
    types[entry.type ?? 'flowchart'] = {
      summary: {
        samples: entry.samples,
        vertical: r4(entry.vertical),
        horizontal: r4(entry.horizontal),
        containment: r4(entry.containment),
      },
      passing: samples.filter((s) => s.status === 'pass').length,
      failing: samples.filter((s) => s.status === 'fail').length,
      samples,
      errored: sampled.filter((t) => !(t in results)).sort(),
    }
  }
  const out = {
    schema: SCORECARD_SCHEMA,
    mermaid: first.mermaid ?? LEGACY_MERMAID,
    tolerance: first.tolerance,
    commit: first.commit,
    date: first.date,
    defaultFloor: DEFAULT_FLOOR,
    excluded: EXCLUDED_TYPES,
    types,
  }
  return `${JSON.stringify(out, null, 2)}\n`
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
  /** Titles the oracle tried to score; any missing from `results` errored. */
  sampled?: string[]
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
  const sections = runs.map(({ entry, results, sampled = [] }) => {
    const errored = sampled.filter((t) => !(t in results))
    const note = errored.length
      ? `\n\nNot scored (the oracle errored): ${errored.join(', ')}.`
      : ''
    const rows = Object.entries(results)
      .sort(([, a], [, b]) => (worst(a) ?? 2) - (worst(b) ?? 2))
      .map(
        ([t, r]) =>
          `| ${t.replace(/\|/g, '\\|')} | ${cell(r.vertical)} | ${cell(r.horizontal)} | ${cell(r.containment)} | ${r.nodes} | ${cell(floorFor(t))} | ${sampleStatus(t, r)} |`,
      )
    return `### ${TYPE_LABEL[entry.type ?? 'flowchart']} (lowest first)

| Sample | Vertical | Horizontal | Containment | Nodes | Floor | Status |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}${note}`
  })
  return `<!-- Generated by \`${command}\`. Do not edit by hand. -->

# Layout-fidelity scorecard

How closely our flowchart, state, class and ER layouts match official
mermaid.js: the share of node pairs placed in the same above/below/beside
relation (\`vertical\`, \`horizontal\`) and of node/subgraph pairs that agree on
containment. Only relative placement is compared. Each sample has an explicit
floor for its lowest figure (default ${cell(DEFAULT_FLOOR)}, lower overrides in
\`SAMPLE_FLOORS\`); \`--thresholds\` exits 1 on a breach. Floors guard against
regressions, they do not claim parity. Method: \`scripts/layout-oracle.ts\`.

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

## Diagram types not scored

${Object.entries(EXCLUDED_TYPES)
  .map(([t, why]) => `- **${t}**: ${why}`)
  .join('\n')}
`
}
