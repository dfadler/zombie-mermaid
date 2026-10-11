import { describe, it, expect } from 'vitest'
import {
  blindCases,
  buildCalibrationCases,
  mutate,
  parseLimit,
  remapVerdicts,
  scoreVerdicts,
} from '../scripts/lib/form-judge-calibration.ts'

const s = {
  id: 'x',
  title: 'X',
  source: 'graph TD\n Start --> Finish',
  trimmedSvg: '<g/>',
  asciiText:
    '┌───────┐\n│ Start │\n└───────┘\n    │\n    ▼\n┌────────┐\n│ Finish │\n└────────┘',
}

describe('form-judge calibration', () => {
  it('plants every defect kind and changes the ASCII', () => {
    const cases = buildCalibrationCases(s)
    expect(cases.map((c) => c.id)).toEqual([
      'x__clean',
      'x__missingNode',
      'x__dropEdge',
      'x__swapDirection',
      'x__truncateLabel',
      'x__wrongLabel',
    ])
    expect(cases.slice(1).every((c) => c.asciiText !== s.asciiText)).toBe(true)
    expect(mutate(s, 'missingNode')).not.toContain('Start')
    expect(mutate(s, 'missingNode')).toContain('Finish')
    expect(mutate(s, 'swapDirection')).toContain('▲')
    expect(mutate(s, 'dropEdge')).not.toContain('▼')
  })
  it('skips inapplicable mutations', () => {
    expect(mutate({ ...s, asciiText: 'plain' }, 'swapDirection')).toBeNull()
  })
  it('scores FPR and recall, and fails on missing verdicts', () => {
    const ids = ['a__clean', 'a__dropEdge', 'b__clean', 'b__dropEdge']
    const v = (id: string, faithful: boolean) =>
      JSON.stringify({ id, faithful })
    const good = scoreVerdicts(
      [
        v('a__clean', true),
        v('a__dropEdge', false),
        v('b__clean', true),
        v('b__dropEdge', false),
      ],
      ids,
    )
    expect(good).toMatchObject({ fpr: 0, recall: 1, pass: true })
    const bad = scoreVerdicts(
      [
        v('a__clean', false),
        v('a__dropEdge', true),
        v('b__clean', true),
        v('b__dropEdge', false),
      ],
      ids,
    )
    expect(bad).toMatchObject({
      fpr: 0.5,
      recall: 0.5,
      pass: false,
      byMutation: { dropEdge: { n: 2, caught: 1 } },
    })
    expect(scoreVerdicts([], ids).missing).toHaveLength(4)
  })
  it('dropEdge removes the message line, not the lifeline it touches', () => {
    const seq = {
      ...s,
      source: 'sequenceDiagram\n U->>A: Click Login',
      asciiText:
        '    │  Click Login   │\n    │────────────────▶\n    │                │',
    }
    expect(mutate(seq, 'dropEdge')).toBe(
      '    │  Click Login   │\n    │                 \n    │                │',
    )
  })
  it('dropEdge follows a vertical head down its connector', () => {
    expect(mutate({ ...s, asciiText: '  │\n  │\n  ▼\n' }, 'dropEdge')).toBe(
      '   \n   \n   \n',
    )
  })
  it('dropEdge skips a head with no connector and finds a later one', () => {
    const a = '▶\n\n  ─▶'
    expect(mutate({ ...s, asciiText: a }, 'dropEdge')).toBe('▶\n\n    ')
    expect(mutate({ ...s, asciiText: '▶' }, 'dropEdge')).toBeNull()
  })
  it('missingNode is null without a bordered label', () => {
    expect(
      mutate({ ...s, asciiText: 'Start Finish' }, 'missingNode'),
    ).toBeNull()
    expect(mutate({ ...s, asciiText: 'x │ Start' }, 'missingNode')).toBeNull()
  })
  it('label mutations are null when no source label is in the ASCII', () => {
    expect(mutate({ ...s, asciiText: 'xx' }, 'truncateLabel')).toBeNull()
  })
  it('label mutations match whole words only', () => {
    const t = { ...s, source: 'Star', asciiText: 'Starfish Star' }
    expect(mutate(t, 'wrongLabel')).toBe('Starfish Zzzz')
  })
  it('an unmeasured FPR is null and cannot pass', () => {
    const r = scoreVerdicts(
      [JSON.stringify({ id: 'a__dropEdge', faithful: false })],
      ['a__dropEdge'],
    )
    expect(r).toMatchObject({ clean: 0, fpr: null, recall: 1, pass: false })
  })
  it('ignores blank and non-boolean verdict lines', () => {
    const r = scoreVerdicts(
      ['', JSON.stringify({ id: 'a__clean' })],
      ['a__clean'],
    )
    expect(r.missing).toEqual(['a__clean'])
  })
  it('parseLimit: absent is unlimited, junk throws', () => {
    expect(parseLimit(undefined)).toBe(Infinity)
    expect(parseLimit('3')).toBe(3)
    expect(parseLimit('0')).toBe(0)
    for (const bad of ['abc', '-1', '1.5', '', '1e3'])
      expect(() => parseLimit(bad)).toThrow('--limit')
  })
  it('blindCases hides the mutation and honours --only', () => {
    const cases = buildCalibrationCases(s)
    const all = blindCases(cases)
    expect(all.blind.map((c) => c.id)[0]).toBe('case-000')
    expect(all.map['case-002']).toBe('x__dropEdge')
    const some = blindCases(cases, ['dropEdge'])
    expect(some.map).toEqual({ 'case-000': 'x__dropEdge' })
  })
  it('remapVerdicts restores real ids and drops blank lines', () => {
    const out = remapVerdicts(
      [
        '',
        JSON.stringify({ id: 'case-000', faithful: true }),
        JSON.stringify({ id: 'zz' }),
      ],
      { 'case-000': 'x__clean' },
    )
    expect(out.map((l) => JSON.parse(l).id)).toEqual(['x__clean', 'zz'])
  })
})
