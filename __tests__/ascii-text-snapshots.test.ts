/**
 * Text snapshots of every gallery sample's ASCII output (#1708), alongside
 * (not instead of) the PNG baselines in visual/ascii-samples.visual.test.ts.
 * The PNG diff tolerates small layout shifts (threshold 0.4,
 * maxDiffPixelRatio 0.002); a plain-text compare does not, and the diff is
 * readable in a PR. Same sample set and options as the PNG suite
 * (TERMINAL_ASCII_OPTS, minus the colour mode: 'none' here), in the unicode
 * and ASCII-only charsets. Runs under normal `pnpm test`.
 *
 * Update after an intentional rendering change, or after adding samples:
 * `pnpm run test:ascii-text:update`, then review the .txt diff.
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { renderMermaidASCII } from '../src/index.ts'
import { samples } from '../packages/site/samples-data.ts'
import { xychartSamples } from '../packages/site/xychart-samples-data.ts'
import { TERMINAL_ASCII_OPTS } from './visual/helpers/terminal-panel.ts'

const DIR = join(import.meta.dirname, '__ascii-snapshots__')
const CHARSETS = { unicode: false, ascii: true } as const

const slug = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// Hero samples have no ASCII panel (same skip as the PNG suite).
const cases = [
  ...samples
    .filter((s) => s.category !== 'Hero')
    .map((s) => ['general', s] as const),
  ...xychartSamples.map((s) => ['xychart', s] as const),
].map(([kind, s]) => ({
  name: `${kind}-${slug(s.category ?? 'uncategorized')}-${slug(s.title)}`,
  source: s.source,
}))

describe('ASCII text snapshots', () => {
  test('sample names are unique', () => {
    const names = cases.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  for (const [charset, useAscii] of Object.entries(CHARSETS)) {
    describe(charset, () => {
      test.each(cases)('$name', async ({ name, source }) => {
        let text: string
        try {
          text = renderMermaidASCII(source, {
            ...TERMINAL_ASCII_OPTS,
            colorMode: 'none',
            useAscii,
          })
        } catch {
          // Same fallback as the PNG suite: a type gaining/losing ASCII
          // support shows up as a diff.
          text = '(ASCII not supported for this diagram type)'
        }
        await expect(text + '\n').toMatchFileSnapshot(
          join(DIR, charset, `${name}.txt`),
        )
      })

      // `-u` never deletes snapshots of removed samples; fail instead.
      test('no orphaned snapshot files', () => {
        const want = new Set(cases.map((c) => `${c.name}.txt`))
        const orphans = readdirSync(join(DIR, charset)).filter(
          (f) => !want.has(f),
        )
        expect(orphans).toEqual([])
      })
    })
  }
})
