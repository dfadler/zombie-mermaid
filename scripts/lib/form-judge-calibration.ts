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

/** First whole-word label (4+ letters) from the source that also appears in the ASCII. */
function pickLabel(s: CombinedSample): string | null {
  for (const w of s.source.match(/[A-Za-z]{4,}/g) ?? []) {
    if (new RegExp(`\\b${w}\\b`).test(s.asciiText)) return w
  }
  return null
}

const SIDE = '│┃║'

/** Blank the whole box (│-bordered rectangle, top to bottom edge) around a source label. Null if none found. */
function blankBox(a: string, s: CombinedSample): string | null {
  const lines = a.split('\n').map((l) => [...l])
  for (const w of s.source.match(/[A-Za-z]{4,}/g) ?? []) {
    const re = new RegExp(`\\b${w}\\b`)
    const i = lines.findIndex((l) => re.test(l.join('')))
    if (i < 0) continue
    const row = lines[i]
    const at = row.join('').search(re)
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
      const cells: [number, number][] = [[y, x]]
      if (VERT.includes(at(y - 1, x)) || VERT.includes(at(y + 1, x))) {
        for (const d of [-1, 1])
          for (let k = y + d; VERT.includes(at(k, x)); k += d)
            cells.push([k, x])
      } else {
        for (const d of [-1, 1])
          for (let k = x + d; HORIZ.includes(at(y, k)); k += d)
            cells.push([y, k])
      }
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
      const re = new RegExp(`\\b${w}\\b`)
      out = a.replace(
        re,
        m === 'truncateLabel'
          ? w.slice(0, -2) + '  '
          : 'Zzzz'.padEnd(w.length, 'z').slice(0, w.length),
      )
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
  fpr: number
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
  const fpr = clean ? falsePositives / clean : 0
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
      fpr <= THRESHOLDS.maxFpr &&
      recall >= THRESHOLDS.minRecall,
  }
}
