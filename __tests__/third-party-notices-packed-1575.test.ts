import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')

// Packs (dry run) each published package and asserts the notice ships (#1575).
describe.each([
  ['zombie-mermaid', '.'],
  ['@zombie-mermaid/svg-renderer', 'packages/svg-renderer'],
  ['@zombie-mermaid/ascii-renderer', 'packages/ascii-renderer'],
])('%s tarball', (_name, dir) => {
  it('includes THIRD_PARTY_NOTICES.md', () => {
    const out = execFileSync(
      'npm',
      ['pack', '--dry-run', '--json', '--ignore-scripts'],
      {
        cwd: resolve(root, dir),
        encoding: 'utf8',
      },
    )
    const files = (
      JSON.parse(out) as { files: { path: string }[] }[]
    )[0]!.files.map((f) => f.path)
    expect(files).toContain('THIRD_PARTY_NOTICES.md')
    // 30 s timeout: spawns `npm pack`, 1-9 s depending on load (#1825).
  }, 30_000)
})
