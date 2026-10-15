import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bundleSource } from '../scripts/vite-bundle.ts'

describe('bundleSource (#2066)', () => {
  it('bundles in-memory source, resolving imports from resolveDir, keeping exports', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bundle-source-'))
    writeFileSync(
      join(dir, 'dep.js'),
      'export const marker = "zm-marker-2066"\n',
    )
    const out = await bundleSource(`export { marker } from './dep.js'`, dir)
    expect(out).toContain('zm-marker-2066')
    expect(out).toMatch(/export\s*\{/)
  })
})
