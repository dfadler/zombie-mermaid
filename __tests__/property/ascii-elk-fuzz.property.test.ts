// Seeded fuzz of the ASCII renderer with the ELK layout provider registered,
// as the CLI and the root entry run it (#3146). `flowchart.property.test.ts`
// renders through the package entry, which registers no provider, so the
// hinted path was barely exercised: it threw or ran out of memory on sources
// the other path draws (see `ascii-elk-hinted-crashes-3146.test.ts`).
//
// Fixed seeds keep it deterministic; a failure prints the source and
// `(seed, run, useAscii)`. Replay with `ELK_FUZZ_SEEDS=<seed> ELK_FUZZ_RUNS=<n>`
// (a larger sweep: `ELK_FUZZ_SEEDS=1,2,3 ELK_FUZZ_RUNS=2000`).
//
// Asserted: no throw, a rectangular canvas, no NaN/undefined text. Label
// presence is NOT asserted: the grid path drops some labels too (a label
// wrapped over two lines, a parallel edge's label drawn over a node), which
// is a separate defect from the crashes this guards.
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '../../packages/ascii-renderer/src/index.ts'
// The root entry registers the ELK layout provider (as the CLI does).
import '../../src/index.ts'
import { generate, mulberry32, violation } from '../helpers/ascii-fuzz.ts'

const SEEDS = (process.env.ELK_FUZZ_SEEDS ?? '1,2,3,4').split(',').map(Number)
const RUNS = Number(process.env.ELK_FUZZ_RUNS ?? 50)

describe('ELK-registered ASCII fuzz (#3146)', () => {
  it('never throws and always draws a rectangular canvas', () => {
    for (const seed of SEEDS) {
      const rng = mulberry32(seed)
      for (let run = 0; run < RUNS; run++) {
        const f = generate(rng)
        for (const useAscii of [false, true]) {
          let why: string | undefined
          try {
            why = violation(
              f,
              renderMermaidASCII(f.src, { colorMode: 'none', useAscii }),
              false,
            )
          } catch (e) {
            why = `threw ${String(e)}`
          }
          expect(
            why,
            `seed ${seed} run ${run} useAscii ${useAscii}\n${f.src}`,
          ).toBeUndefined()
        }
      }
    }
    // Bounded for the unit-test budget: ~400 renders; 120 s covers a loaded machine.
  }, 120_000)
})
