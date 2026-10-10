/**
 * Calibration helpers for the form-judge LLM judge (#1609): plant known
 * defects into a known-faithful ASCII render, then score the judge's verdicts.
 * Pure functions, no LLM calls. CLI: scripts/form-judge-calibrate.ts.
 */
import type { CombinedSample } from './form-judge-cache.ts'

export type Mutation = 'dropEdge' | 'swapDirection' | 'truncateLabel' | 'wrongLabel'
export const MUTATIONS: Mutation[] = ['dropEdge', 'swapDirection', 'truncateLabel', 'wrongLabel']

const HEADS = '▶◀▲▼►◄'
const SWAP: Record<string, string> = { '▶': '◀', '◀': '▶', '▲': '▼', '▼': '▲', '►': '◄', '◄': '►' }
// A connector-only line (no label text) that carries an arrowhead.
const EDGE_LINE = /^[\s│─┌┐└┘├┤┬┴┼┃━▶◀▲▼►◄]+$/

/** First whole-word label (4+ letters) from the source that also appears in the ASCII. */
function pickLabel(s: CombinedSample): string | null {
  for (const w of s.source.match(/[A-Za-z]{4,}/g) ?? []) {
    if (new RegExp(`\\b${w}\\b`).test(s.asciiText)) return w
  }
  return null
}

/** Returns the defective ASCII, or null when the mutation does not apply (or would be a no-op). */
export function mutate(s: CombinedSample, m: Mutation): string | null {
  const a = s.asciiText
  let out: string | null = null
  if (m === 'dropEdge') {
    const lines = a.split('\n')
    const i = lines.findIndex((l) => EDGE_LINE.test(l) && [...HEADS].some((h) => l.includes(h)))
    if (i >= 0) out = lines.filter((_, j) => j !== i).join('\n')
  } else if (m === 'swapDirection') {
    out = a.replace(/[▶◀▲▼►◄]/g, (c) => SWAP[c])
  } else {
    const w = pickLabel(s)
    if (w) {
      const re = new RegExp(`\\b${w}\\b`)
      out = a.replace(re, m === 'truncateLabel' ? w.slice(0, -2) + '  ' : 'Zzzz'.padEnd(w.length, 'z').slice(0, w.length))
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
  let clean = 0, falsePositives = 0, defects = 0, caught = 0
  const missing: string[] = []
  for (const id of caseIds) {
    const f = verdicts.get(id)
    if (f === undefined) { missing.push(id); continue }
    if (id.endsWith('__clean')) { clean++; if (!f) falsePositives++ }
    else { defects++; if (!f) caught++ }
  }
  const fpr = clean ? falsePositives / clean : 0
  const recall = defects ? caught / defects : 0
  return { clean, falsePositives, defects, caught, fpr, recall, missing,
    pass: !missing.length && fpr <= THRESHOLDS.maxFpr && recall >= THRESHOLDS.minRecall }
}
