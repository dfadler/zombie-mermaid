/**
 * No gallery sample may hit an A* cap (per-call MAX_ITERATIONS or the
 * render-wide budget) in either charset (#1859). A cap hit does not throw: it
 * silently degrades routing (#1475), so wall-clock gates cannot see it.
 * A sample that legitimately hits it goes in KNOWN with its issue number (an
 * entry that stops hitting the cap is itself an error, so it can't rot).
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { takeCapHits } from '../packages/ascii-renderer/src/pathfinder.ts'
import { samples } from '../samples/samples-data.ts'
import { xychartSamples } from '../samples/xychart-samples-data.ts'

/** Sample title -> issue tracking why it hits the cap. */
const KNOWN: Record<string, string> = {}

describe('A* cap hits over all samples (#1859)', () => {
  for (const s of [...samples, ...xychartSamples]) {
    for (const useAscii of [false, true]) {
      it(`${s.title} (${useAscii ? 'ascii' : 'unicode'})`, () => {
        takeCapHits()
        renderMermaidASCII(s.source, { colorMode: 'none', useAscii })
        const hits = takeCapHits()
        const known = KNOWN[s.title]
        if (known) {
          expect(
            hits,
            `${known} may be fixed: drop from KNOWN`,
          ).toBeGreaterThan(0)
        } else {
          expect(
            hits,
            `"${s.title}" (${useAscii ? 'ascii' : 'unicode'}) hit the A* cap ${hits} time(s)`,
          ).toBe(0)
        }
      })
    }
  }
})
