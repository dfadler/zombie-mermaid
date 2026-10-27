/**
 * Data model for layout-fidelity.html (#1686): parses the two committed files
 * `pnpm run layout:scorecard` writes, `layout-fidelity-history.jsonl` and
 * `docs/layout-fidelity-scorecard.md`. Descriptive only, no thresholds.
 *
 * The history has two kinds of line: a per-type run (`type`, `samples`,
 * `vertical`, `horizontal`, `containment`) and an edge-label figure
 * (`kind: "label"`). Markdown is read by shape (headings, paragraphs, pipe
 * tables), so a new scorecard section needs no change here.
 */

export interface TypeRun {
  date: string
  commit: string
  mermaid: string
  type: string
  samples: number
  vertical: number | null
  horizontal: number | null
  containment: number | null
}

export interface LabelRun {
  date: string
  commit: string
  mermaid: string
  cases: number
  officialAlong: number
  asciiAlong: number
  meanAbsDelta: number
}

export interface Table {
  header: string[]
  rows: string[][]
}

export interface Section {
  level: number
  title: string
  paragraphs: string[]
  tables: Table[]
}

const TYPE_NAMES: Record<string, string> = {
  flowchart: 'Flowchart',
  state: 'State',
  class: 'Class',
  er: 'ER',
}

export const typeName = (t: string): string => TYPE_NAMES[t] ?? t

/** Skips blank and unparseable lines: one bad line must not blank the page. */
export function parseHistory(jsonl: string): {
  runs: TypeRun[]
  labels: LabelRun[]
} {
  const runs: TypeRun[] = []
  const labels: LabelRun[] = []
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue
    let row: Record<string, unknown>
    try {
      row = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    const base = {
      date: String(row.date),
      commit: String(row.commit).slice(0, 7),
      mermaid: String(row.mermaid),
    }
    if (row.kind === 'label') {
      labels.push({
        ...base,
        cases: Number(row.cases),
        officialAlong: Number(row.officialAlong),
        asciiAlong: Number(row.asciiAlong),
        meanAbsDelta: Number(row.meanAbsDelta),
      })
    } else if (row.kind === undefined) {
      // Lines written before #1926 carry no `type`: flowchart only.
      const n = (v: unknown) => (typeof v === 'number' ? v : null)
      runs.push({
        ...base,
        type: typeof row.type === 'string' ? row.type : 'flowchart',
        samples: Number(row.samples),
        vertical: n(row.vertical),
        horizontal: n(row.horizontal),
        containment: n(row.containment),
      })
    }
    // Any other `kind` is a figure a later change added; not ours to guess at.
  }
  return { runs, labels }
}

/** The most recent run per type, in first-seen type order. */
export function latestPerType(runs: readonly TypeRun[]): TypeRun[] {
  const latest = new Map<string, TypeRun>()
  for (const r of runs) latest.set(r.type, r)
  return [...latest.values()]
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())

export function parseScorecard(md: string): Section[] {
  const sections: Section[] = []
  let cur: Section | undefined
  let para: string[] = []
  let tbl: string[] = []
  const flush = () => {
    if (para.length && cur) cur.paragraphs.push(para.join(' '))
    para = []
    if (tbl.length && cur) {
      const [head, , ...body] = tbl
      cur.tables.push({ header: cells(head!), rows: body.map(cells) })
    }
    tbl = []
  }
  for (const line of md.split('\n')) {
    const h = /^(#{1,6}) (.+)$/.exec(line)
    if (h) {
      flush()
      cur = { level: h[1]!.length, title: h[2]!, paragraphs: [], tables: [] }
      sections.push(cur)
    } else if (line.startsWith('|')) {
      if (para.length) flush()
      tbl.push(line)
    } else if (line.startsWith('- ')) {
      flush()
      para.push(line.slice(2).trim())
      flush()
    } else if (!line.trim() || line.startsWith('<!--')) {
      flush()
    } else {
      if (tbl.length) flush()
      para.push(line.trim())
    }
  }
  flush()
  return sections
}
