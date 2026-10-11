import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// Every gallery sample needs an SVG and an ASCII baseline on darwin + linux
// (#1562). Runs the script so a sample added without baselines fails here.
describe('scripts/check-visual-baselines.ts', () => {
  it('finds no gallery sample missing an SVG or ASCII baseline', () => {
    const out = execFileSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/check-visual-baselines.ts'],
      { encoding: 'utf8' },
    )
    expect(out).not.toMatch(/^missing:/m)
    const [, have, total] = /(\d+)\/(\d+) baselines present/.exec(out) ?? []
    expect(Number(total)).toBeGreaterThan(0)
    expect(have).toBe(total)
  })
})
