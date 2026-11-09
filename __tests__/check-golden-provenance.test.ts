import { describe, expect, it } from 'vitest'
import {
  checkGoldens,
  main,
  type Manifest,
} from '../scripts/check-golden-provenance.ts'

const e = (o: object) => ({
  paths: ['a/x.snap'],
  class: 'b',
  source: 's',
  owner: 't.ts',
  ...o,
})
const m = (...entries: object[]): Manifest =>
  ({ classes: { a: '', b: '' }, entries }) as Manifest
const ok = () => true

describe('check-golden-provenance', () => {
  it('covers every golden tracked in this checkout', () => {
    expect(main()).toBe(0)
  })
  it('passes a covered file, prefix entries included', () => {
    expect(checkGoldens(['a/x.snap'], m(e({})), ok)).toEqual([])
    expect(checkGoldens(['d/y.txt'], m(e({ paths: ['d/'] })), ok)).toEqual([])
  })
  it('flags a golden with no entry and an entry matching nothing', () => {
    expect(checkGoldens(['a/new.snap'], m(e({})), ok)).toEqual([
      expect.stringContaining('matches no golden file'),
      'a/new.snap: no entry in docs/golden-provenance.json',
    ])
  })
  it('flags bad class, missing source/owner, class a without version, version without verdict', () => {
    const errs = checkGoldens(
      ['a/x.snap'],
      m(e({ class: 'z', source: '', mermaid: '12.3.0' }), e({ class: 'a' })),
      (p) => p !== 't.ts',
    )
    expect(errs.join('\n')).toMatch(/unknown class "z"/)
    expect(errs.join('\n')).toMatch(/missing source/)
    expect(errs.join('\n')).toMatch(/owner t\.ts does not exist/)
    expect(errs.join('\n')).toMatch(/without a verdict/)
    expect(errs.join('\n')).toMatch(/class a needs a mermaid version/)
  })
})
