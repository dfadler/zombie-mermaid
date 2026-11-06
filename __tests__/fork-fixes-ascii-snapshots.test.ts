/**
 * Drift guard for the fork-fixes page's real-terminal screenshots (#2619 Q5).
 *
 * Provenance (#2679): the .txt files are our own After output (class b); the sources were
 * audited against mermaid 12.3.0 in the #2606 map, the snapshots only guard against drift.
 *
 * The After PNGs under public/fork-fixes-screenshots/ are captured by hand
 * (scripts/capture-fork-fixes-terminal.ts needs asciinema, agg and ffmpeg), so
 * nothing noticed when a renderer change made them stale: 22 of 44 had drifted
 * by the time of the audit (#2606). This snapshots each shown ASCII entry's
 * After text, rendered the way the capture does (`colorMode: 'none'`), so a PR
 * that changes any of them fails here until the author updates the snapshot.
 * It cannot check the PNG itself (that needs the asciinema pipeline, which
 * does not run in the test job): the failure message says to re-capture, and
 * the updated .txt shows up in the PR diff next to the PNG, where a reviewer
 * can see that one changed without the other.
 */
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { forkFixes } from '../demo/fork-fixes-data.ts'
import { renderMermaidASCII } from '../src/index.ts'

const DIR = join(import.meta.dirname, '__fork-fixes-snapshots__')

const asciiEntries = forkFixes.filter((f) => f.render === 'ascii' && !f.excerpt)

describe('fork-fixes ASCII After snapshots', () => {
  test.each(asciiEntries.map((f) => [f.id, f.source]))(
    '%s',
    async (id, source) => {
      const text = renderMermaidASCII(source, { colorMode: 'none' })
      try {
        await expect(text).toMatchFileSnapshot(join(DIR, `${id}.txt`))
      } catch (err) {
        throw new Error(
          `The After render of fork-fixes entry "${id}" changed, so its committed screenshot ` +
            `(public/fork-fixes-screenshots/${id}-after.png) is stale. Re-run ` +
            `\`pnpm exec tsx scripts/capture-fork-fixes-terminal.ts ${id}\` (needs asciinema, agg, ffmpeg), ` +
            `then update the snapshot with \`pnpm exec vitest run -u -c config/vitest.config.ts ${'__tests__/fork-fixes-ascii-snapshots.test.ts'}\`.\n\n` +
            (err instanceof Error ? err.message : String(err)),
          { cause: err },
        )
      }
    },
  )
})
