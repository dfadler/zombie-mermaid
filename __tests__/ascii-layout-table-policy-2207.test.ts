import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const run = (...args: string[]) =>
  spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/ascii-layout-table.ts', ...args],
    { encoding: 'utf8' },
  )

describe('ascii-layout-table --policy validation (#2207)', () => {
  it.each(['--policy=grow-onli', '--policy='])(
    'rejects %s before rendering',
    (arg) => {
      const r = run(arg)
      expect(r.status).toBe(1)
      expect(r.stderr).toContain('merge-then-grow, grow-only')
      expect(r.stderr).not.toMatch(/TypeError/)
      expect(r.stdout).toBe('')
    },
    60_000,
  )

  it.each(['--policy=grow-only', '--policy=merge-then-grow', ''])(
    'accepts "%s"',
    (arg) => {
      const r = run(...(arg ? [arg] : []))
      expect(r.status).toBe(0)
      expect(r.stdout).toContain(
        `SUMMARY policy=${arg ? arg.slice(9) : 'merge-then-grow'}`,
      )
    },
    120_000,
  )
})
