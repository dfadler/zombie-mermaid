import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

// scripts/ is outside tsconfig, and vitest's transform does not check named
// exports, so a stale import (e.g. pinnedMermaidVersion from the wrong module)
// only fails under real Node ESM. Load the oracle entry points with Node itself.
// Runs via tsx like `pnpm run layout:oracle`; only the missing-export SyntaxError
// is asserted, other load failures are environment state, not this regression.
describe('oracle scripts load under node', () => {
  it.each(['scripts/layout-oracle.ts', 'scripts/lib/label-position.ts'])(
    '%s has no missing named exports',
    (p) => {
      const r = spawnSync(
        process.execPath,
        ['--import', 'tsx', '--input-type=module', '-e', `await import(${JSON.stringify(resolve(p))})`],
        { encoding: 'utf8' },
      )
      expect(r.stderr).not.toMatch(/does not provide an export named/)
    },
    30_000,
  )
})
