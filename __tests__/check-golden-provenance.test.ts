import { describe, expect, it, vi } from 'vitest'
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
  it('runs main() and sets the exit code when invoked as the script', async () => {
    const [argv1, code] = [process.argv[1], process.exitCode]
    process.argv[1] = 'scripts/check-golden-provenance.ts'
    process.exitCode = 7
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.resetModules()
    await import('../scripts/check-golden-provenance.ts?as-script')
    expect(process.exitCode).toBe(0)
    log.mockRestore()
    process.argv[1] = argv1!
    process.exitCode = code
  })
  it('exits 1 and reports a golden that has no entry', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(main(['pkg/__snapshots__/new.snap'])).toBe(1)
    expect(err.mock.calls[0]![0]).toMatch(/new\.snap: no entry.*\n\d+ golden/)
    err.mockRestore()
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
