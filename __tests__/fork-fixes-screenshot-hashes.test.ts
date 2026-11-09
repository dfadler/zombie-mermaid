/**
 * Stale-screenshot guard for the fork-fixes page (#2916).
 *
 * `fork-fixes-ascii-snapshots.test.ts` fails when an After render changes, but
 * the author can silence it with `vitest -u` and forget the PNG (the capture
 * needs asciinema, agg and ffmpeg, so CI cannot redo it). The capture script
 * records a hash of the After text it captured in
 * `scripts/fork-fixes-screenshot-hashes.json`; this fails when the current
 * render no longer matches, so a snapshot change without a re-capture cannot merge.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { forkFixes } from '../demo/fork-fixes-data.ts'
import {
  readHashes,
  recordHash,
  staleIds,
} from '../scripts/lib/fork-fixes-screenshot-hashes.ts'
import { renderMermaidASCII } from '../src/index.ts'

const asciiEntries = forkFixes.filter((f) => f.render === 'ascii' && !f.excerpt)
const current = Object.fromEntries(
  asciiEntries.map((f) => [
    f.id,
    renderMermaidASCII(f.source, { colorMode: 'none' }),
  ]),
)

describe('fork-fixes screenshots match their After render', () => {
  test('every shown ASCII entry has a screenshot captured from its current render', () => {
    const stale = staleIds(current, readHashes())
    expect(
      stale,
      `Re-run \`pnpm exec tsx scripts/capture-fork-fixes-terminal.ts ${stale.join(' ')}\` ` +
        '(needs asciinema, agg, ffmpeg), open the new PNGs, and commit them with the hash file.',
    ).toEqual([])
  })

  test('every entry has its -after.png on disk', () => {
    const dir = join(
      import.meta.dirname,
      '..',
      'public',
      'fork-fixes-screenshots',
    )
    const missing = asciiEntries
      .filter((f) => !existsSync(join(dir, `${f.id}-after.png`)))
      .map((f) => f.id)
    expect(missing).toEqual([])
  })

  test('staleIds flags a changed or unrecorded render, and recordHash round-trips', () => {
    const path = new URL(
      `file://${join(import.meta.dirname, '..', 'node_modules', '.tmp-hash-test.json')}`,
    )
    recordHash('a', 'one', path)
    recordHash('b', 'two', path)
    const rec = readHashes(path)
    expect(staleIds({ a: 'one', b: 'two' }, rec)).toEqual([])
    expect(staleIds({ a: 'one!', b: 'two', c: 'new' }, rec)).toEqual(['a', 'c'])
  })
})
