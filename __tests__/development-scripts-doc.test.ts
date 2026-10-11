import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  generateDevelopmentScriptsDoc,
  renderDevelopmentScriptsDoc,
} from '../scripts/generate-development-scripts-doc'

describe('docs/development-scripts.md', () => {
  it('matches what scripts/generate-development-scripts-doc.ts produces (run `pnpm run docs:scripts` if this fails)', async () => {
    const committed = await readFile(
      new URL('../docs/development-scripts.md', import.meta.url),
      'utf8',
    )
    expect(committed).toBe(await generateDevelopmentScriptsDoc())
  })

  it('throws when a script has no description', () => {
    expect(() =>
      renderDevelopmentScriptsDoc({ a: 'x', b: 'y' }, { a: 'does a' }),
    ).toThrow(/Missing descriptions: \[b\]/)
  })

  it('throws when a description names a script that no longer exists', () => {
    expect(() =>
      renderDevelopmentScriptsDoc({ a: 'x' }, { a: 'does a', gone: 'old' }),
    ).toThrow(/unknown scripts: \[gone\]/)
  })

  it('groups scripts by purpose and lists each exactly once', () => {
    const doc = renderDevelopmentScriptsDoc(
      { test: 't', 'bench:x': 'b', mystery: 'm' },
      {
        test: 'runs tests',
        'bench:x': 'benchmarks x',
        mystery: 'unclassified',
      },
    )
    expect(doc).toMatch(/## Testing\n\n- `pnpm run test` — runs tests/)
    expect(doc).toMatch(/## Benchmarks and checks\n\n- `pnpm run bench:x`/)
    expect(doc).toMatch(/## Other tooling\n\n- `pnpm run mystery`/)
  })
})
