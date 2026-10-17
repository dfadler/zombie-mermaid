/**
 * Whole-canvas invariants and A* cap for every gallery class diagram drawn
 * with `direction LR` and `direction RL` (#2158). The gallery only has three
 * samples that set a direction, but LR/RL goes through the flowchart grid, so
 * every class sample is a case here (checker: __tests__/helpers/ascii-invariants.ts,
 * same rules as ascii-invariants-1858.test.ts, no KNOWN entries).
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { takeCapHits } from '../packages/ascii-renderer/src/pathfinder.ts'
import { samples } from '../packages/site/samples-data.ts'
import { checkAll } from './helpers/ascii-invariants.ts'

const classSamples = samples.filter((s) => /^\s*classDiagram/m.test(s.source))

/** The sample with its own `direction` replaced by `dir`. */
function withDirection(source: string, dir: 'LR' | 'RL'): string {
  return source
    .replace(/^\s*direction\s+\w+\s*$/m, '')
    .replace(/classDiagram(-v2)?/, (header) => `${header}\n  direction ${dir}`)
}

describe('class diagrams drawn LR and RL keep the canvas invariants (#2158)', () => {
  it('has class samples to check', () => {
    expect(classSamples.length).toBeGreaterThan(20)
  })
  for (const s of classSamples) {
    for (const dir of ['LR', 'RL'] as const) {
      for (const useAscii of [false, true]) {
        it(`${s.title} ${dir} (${useAscii ? 'ascii' : 'unicode'})`, () => {
          const source = withDirection(s.source, dir)
          takeCapHits()
          const out = renderMermaidASCII(source, {
            colorMode: 'none',
            useAscii,
          })
          const hits = takeCapHits()
          expect(hits, `A* cap hit ${hits} time(s)`).toBe(0)
          // the direction was honoured: not the top-down drawing
          const top = renderMermaidASCII(
            source.replace(`direction ${dir}`, 'direction TB'),
            { colorMode: 'none', useAscii },
          )
          if (/-->|<\|--|\.\.>|\*--|o--|\.\.\|>|\(\)--|--\(\)/.test(source)) {
            expect(out).not.toBe(top)
          }
          const vs = checkAll(out, { unicode: !useAscii, skip: [], er: false })
          expect(vs.map((x) => x.message)).toEqual([])
        })
      }
    }
  }
})
