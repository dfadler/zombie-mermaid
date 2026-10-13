/**
 * Calibration helpers for the form-judge LLM judge (#1609): plant known
 * defects into a known-faithful ASCII render, then score the judge's verdicts.
 * Pure functions, no LLM calls. CLI: scripts/form-judge-calibrate.ts.
 */
import type { CombinedSample } from './form-judge-cache.ts'

export type Mutation =
  'missingNode' | 'dropEdge' | 'swapDirection' | 'truncateLabel' | 'wrongLabel'
export const MUTATIONS: Mutation[] = [
  'missingNode',
  'dropEdge',
  'swapDirection',
  'truncateLabel',
  'wrongLabel',
]

const HEADS = '▶◀▲▼►◄'
const SWAP: Record<string, string> = {
  '▶': '◀',
  '◀': '▶',
  '▲': '▼',
  '▼': '▲',
  '►': '◄',
  '◄': '►',
}

const isWord = (c: string | undefined) => c !== undefined && /\w/.test(c)

/** Index of the first whole-word occurrence of `w` in `text`, or -1. (indexOf, not a RegExp built from input.) */
function wordAt(text: string, w: string): number {
  for (let i = text.indexOf(w); i >= 0; i = text.indexOf(w, i + 1)) {
    if (!isWord(text[i - 1]) && !isWord(text[i + w.length])) return i
  }
  return -1
}

/** First whole-word label (4+ letters) from the source that also appears in the ASCII. */
function pickLabel(s: CombinedSample): string | null {
  for (const w of s.source.match(/[A-Za-z]{4,}/g) ?? []) {
    if (wordAt(s.asciiText, w) >= 0) return w
  }
  return null
}

const SIDE = '│┃║'

/** Blank the whole box (│-bordered rectangle, top to bottom edge) around a source label. Null if none found. */
function blankBox(a: string, s: CombinedSample): string | null {
  const lines = a.split('\n').map((l) => [...l])
  for (const w of s.source.match(/[A-Za-z]{4,}/g) ?? []) {
    const i = lines.findIndex((l) => wordAt(l.join(''), w) >= 0)
    if (i < 0) continue
    const row = lines[i]
    const at = wordAt(row.join(''), w)
    let l = at,
      r = at + w.length - 1
    while (l >= 0 && !SIDE.includes(row[l])) l--
    while (r < row.length && !SIDE.includes(row[r])) r++
    if (l < 0 || r >= row.length) continue
    let t = i,
      b = i
    while (t > 0 && SIDE.includes(lines[t][l] ?? ' ')) t--
    while (b < lines.length - 1 && SIDE.includes(lines[b][l] ?? ' ')) b++
    for (let y = t; y <= b; y++)
      for (let x = l; x <= r; x++) if (x < lines[y].length) lines[y][x] = ' '
    return lines.map((x) => x.join('')).join('\n')
  }
  return null
}

const VERT = '│┃║┆┊'
const HORIZ = '─━═┄╌┈'

/** Blank one whole edge (the first arrowhead plus its straight connector run), leaving boxes and labels in place. */
function blankEdge(a: string): string | null {
  const lines = a.split('\n').map((l) => [...l])
  const at = (y: number, x: number) => lines[y]?.[x] ?? ' '
  for (let y = 0; y < lines.length; y++) {
    for (let x = 0; x < lines[y].length; x++) {
      if (!HEADS.includes(lines[y][x])) continue
      const run = (dy: number, dx: number, set: string) => {
        const out: [number, number][] = [[y, x]]
        for (const d of [-1, 1])
          for (let k = 1; set.includes(at(y + d * k * dy, x + d * k * dx)); k++)
            out.push([y + d * k * dy, x + d * k * dx])
        return out
      }
      // A horizontal head can sit in a lifeline's column (Sequence), so follow its own axis first.
      const vert = run(1, 0, VERT)
      const horiz = run(0, 1, HORIZ)
      const cells = '▶◀►◄'.includes(lines[y][x])
        ? horiz.length > 1
          ? horiz
          : vert
        : vert.length > 1
          ? vert
          : horiz
      if (cells.length < 2) continue
      for (const [cy, cx] of cells) lines[cy][cx] = ' '
      return lines.map((l) => l.join('')).join('\n')
    }
  }
  return null
}

/** Returns the defective ASCII, or null when the mutation does not apply (or would be a no-op). */
export function mutate(s: CombinedSample, m: Mutation): string | null {
  const a = s.asciiText
  let out: string | null = null
  if (m === 'missingNode') {
    out = blankBox(a, s)
  } else if (m === 'dropEdge') {
    out = blankEdge(a)
  } else if (m === 'swapDirection') {
    out = a.replace(/[▶◀▲▼►◄]/g, (c) => SWAP[c])
  } else {
    const w = pickLabel(s)
    if (w) {
      const at = wordAt(a, w)
      const rep =
        m === 'truncateLabel'
          ? w.slice(0, -2) + '  '
          : 'Zzzz'.padEnd(w.length, 'z').slice(0, w.length)
      out = a.slice(0, at) + rep + a.slice(at + w.length)
    }
  }
  return out !== null && out !== a ? out : null
}

/** Clean + planted-defect cases for one known-faithful sample. Id = `<id>__clean|<mutation>`. */
export function buildCalibrationCases(s: CombinedSample): CombinedSample[] {
  const cases = [{ ...s, id: `${s.id}__clean` }]
  for (const m of MUTATIONS) {
    const asciiText = mutate(s, m)
    if (asciiText) cases.push({ ...s, id: `${s.id}__${m}`, asciiText })
  }
  return cases
}

export interface Score {
  clean: number
  falsePositives: number
  defects: number
  caught: number
  /** Null when there is no clean case: an unmeasured rate is not zero. */
  fpr: number | null
  recall: number
  /** Per mutation: planted defects and how many the judge flagged. */
  byMutation: Record<string, { n: number; caught: number }>
  missing: string[]
  pass: boolean
}

export const THRESHOLDS = { maxFpr: 0.1, minRecall: 0.8 }

/** Score verdict JSONL lines (the judge's results format) against case ids. */
export function scoreVerdicts(lines: string[], caseIds: string[]): Score {
  const verdicts = new Map<string, boolean>()
  for (const l of lines) {
    if (!l.trim()) continue
    const v = JSON.parse(l) as { id: string; faithful?: boolean }
    if (typeof v.faithful === 'boolean') verdicts.set(v.id, v.faithful)
  }
  let clean = 0,
    falsePositives = 0,
    defects = 0,
    caught = 0
  const missing: string[] = []
  const byMutation: Score['byMutation'] = {}
  for (const id of caseIds) {
    const f = verdicts.get(id)
    if (f === undefined) {
      missing.push(id)
      continue
    }
    if (id.endsWith('__clean')) {
      clean++
      if (!f) falsePositives++
    } else {
      defects++
      if (!f) caught++
      const m = (byMutation[id.split('__').pop()!] ??= { n: 0, caught: 0 })
      m.n++
      if (!f) m.caught++
    }
  }
  const fpr = clean ? falsePositives / clean : null
  const recall = defects ? caught / defects : 0
  return {
    clean,
    falsePositives,
    defects,
    caught,
    fpr,
    recall,
    byMutation,
    missing,
    pass:
      !missing.length &&
      fpr !== null &&
      fpr <= THRESHOLDS.maxFpr &&
      recall >= THRESHOLDS.minRecall,
  }
}

/** `--limit` operand: absent means unlimited; anything but a non-negative integer throws. */
export function parseLimit(v: string | undefined): number {
  if (v === undefined) return Infinity
  if (!/^\d+$/.test(v))
    throw new Error(`--limit must be a non-negative integer, got "${v}"`)
  return Number(v)
}

/** Blind the judge: opaque ids (the real `<sample>__<mutation>` id would leak the answer). Returns cases plus opaque -> real map. */
export function blindCases(
  cases: CombinedSample[],
  only?: string[],
): { blind: CombinedSample[]; map: Record<string, string> } {
  const map: Record<string, string> = {}
  const blind = cases
    .filter((c) => !only || only.includes(c.id.split('__').pop()!))
    .map((c, i) => {
      const id = `case-${String(i).padStart(3, '0')}`
      map[id] = c.id
      return { ...c, id }
    })
  return { blind, map }
}

/** Rewrite opaque ids in judge JSONL back to real ids (unknown ids pass through). */
export function remapVerdicts(
  lines: string[],
  map: Record<string, string>,
): string[] {
  return lines
    .filter((l) => l.trim())
    .map((l) => {
      const v = JSON.parse(l) as { id: string }
      return JSON.stringify({ ...v, id: map[v.id] ?? v.id })
    })
}

/** Fills the judge prompt template's `__NAME__` placeholders; throws if any are left unfilled. */
export function renderPrompt(
  template: string,
  vars: Record<string, string>,
): string {
  const out = template.replace(/__([A-Z_]+)__/g, (m, k: string) =>
    k in vars ? vars[k]! : m,
  )
  const left = out.match(/__[A-Z_]+__/)
  if (left) throw new Error(`unfilled placeholder ${left[0]}`)
  return out
}

export const calibrationPrompt = (
  template: string,
  dataPath: string,
  resultsPath: string,
): string =>
  renderPrompt(template, {
    CATEGORY: 'Calibration',
    DATA_PATH: dataPath,
    RESULTS_PATH: resultsPath,
    BATCH_SIZE: '5',
  })
