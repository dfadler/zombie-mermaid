/**
 * Refs #3161. The topology gate reads a decision's start off the drawn first stroke
 * cell: in a vertical flow a start left of the diamond's middle column is on its
 * lower-left slant (B/L), right of it the lower-right one (B/R), on it the vertex (B).
 * mermaid@12.3.0 and ELK leave a decision on its slants; the grid draws the strokes
 * under the slant glyphs, which is what the gate now measures.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { allForkFixes } from '../demo/fork-fixes-data.ts'
import { samples } from '../samples/samples-data.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { measureSample, readGrid } from '../scripts/lib/ascii-topology.ts'

const lanes = allForkFixes.find(
  (f) => f.id === 'ascii-parallel-lanes-hint-order',
)!.source
const decision = samples.find(
  (s) => s.title === 'Decision Self-Loop with Duplicate Edges',
)!.source

const dirOf = (src: string, dir: string): string =>
  src.replace(/^(\s*(?:graph|flowchart))\s+\w+/m, `$1 ${dir}`)

const starts = (src: string): string[] =>
  readGrid(src).edges.map((e) => e.start.join(''))

describe('a decision’s slant start in TD/BT is measured where it is drawn', () => {
  it.each([
    ['TD', ['B', 'BL', 'BR', 'BR']],
    ['BT', ['T', 'TL', 'TR', 'TR']],
  ] as const)(
    'lanes sample %s: left and right slants, the vertex stays the flow face',
    (dir, want) => {
      registerAsciiLayout(asciiLayoutProvider)
      // Edge order: VW (vertex), 38 (left slant), Fp (right slant), Zq (right slant, leaves right).
      expect(starts(dirOf(lanes, dir))).toEqual(want)
    },
  )

  it.each(['TD', 'BT'] as const)(
    'lanes sample %s: only VW (ELK L, drawn on the vertex) stays a miss',
    (dir) => {
      registerAsciiLayout(asciiLayoutProvider)
      const c = measureSample(dirOf(lanes, dir))
      expect(c.faceEnds - c.faceOk).toBe(1)
    },
  )

  it.each(['TD', 'BT'] as const)(
    'decision sample %s: the left lane start reads as a slant, the vertex start stays a miss',
    (dir) => {
      registerAsciiLayout(asciiLayoutProvider)
      const s = starts(dirOf(decision, dir))
      expect([s[1], s[5]]).toEqual(dir === 'TD' ? ['BL', 'B'] : ['TL', 'T'])
    },
  )

  it('keeps LR on the right-leaving reading', () => {
    registerAsciiLayout(asciiLayoutProvider)
    expect(starts(dirOf(decision, 'LR'))[1]).toBe('TR')
  })
})
