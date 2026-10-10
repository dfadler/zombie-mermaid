import { describe, it, expect } from 'vitest'
import { buildCalibrationCases, mutate, scoreVerdicts } from '../scripts/lib/form-judge-calibration.ts'

const s = {
  id: 'x', title: 'X', source: 'graph TD\n Start --> Finish', trimmedSvg: '<g/>',
  asciiText: '┌───────┐\n│ Start │\n└───────┘\n    │\n    ▼\n┌────────┐\n│ Finish │\n└────────┘',
}

describe('form-judge calibration', () => {
  it('plants every defect kind and changes the ASCII', () => {
    const cases = buildCalibrationCases(s)
    expect(cases.map((c) => c.id)).toEqual(['x__clean', 'x__dropEdge', 'x__swapDirection', 'x__truncateLabel', 'x__wrongLabel'])
    expect(cases.slice(1).every((c) => c.asciiText !== s.asciiText)).toBe(true)
    expect(mutate(s, 'swapDirection')).toContain('▲')
    expect(mutate(s, 'dropEdge')).not.toContain('▼')
  })
  it('skips inapplicable mutations', () => {
    expect(mutate({ ...s, asciiText: 'plain' }, 'swapDirection')).toBeNull()
  })
  it('scores FPR and recall, and fails on missing verdicts', () => {
    const ids = ['a__clean', 'a__dropEdge', 'b__clean', 'b__dropEdge']
    const v = (id: string, faithful: boolean) => JSON.stringify({ id, faithful })
    const good = scoreVerdicts([v('a__clean', true), v('a__dropEdge', false), v('b__clean', true), v('b__dropEdge', false)], ids)
    expect(good).toMatchObject({ fpr: 0, recall: 1, pass: true })
    const bad = scoreVerdicts([v('a__clean', false), v('a__dropEdge', true), v('b__clean', true), v('b__dropEdge', false)], ids)
    expect(bad).toMatchObject({ fpr: 0.5, recall: 0.5, pass: false })
    expect(scoreVerdicts([], ids).missing).toHaveLength(4)
  })
})
