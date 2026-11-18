/**
 * #2886: the siblings leaving a cluster for one target, left to right.
 *
 * mermaid@12.3.0 (`scripts/lib/real-mermaid.ts`) routes the outer siblings round
 * the target: the first ones rise beside the cluster, run over the target and
 * drop beside it, the last ones dip under it the same way, and the middle one
 * stays straight. The drop is the longer leg (strict bends vs real: Five 0.90,
 * 0.80, 0.70, 0.80, 0.90; the grid draws 0.86, 0.77 and 0.80s). The routes nest
 * and never cross.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { renderMermaidSVG } from '../packages/svg-renderer/src/index.ts'
import { samples } from '../samples/samples-data.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { readGrid } from '../scripts/lib/ascii-topology.ts'

const source = (name: string, dir: 'LR' | 'RL'): string =>
  samples
    .find((s) => s.title.includes(name))!
    .source.replace('flowchart TD', `flowchart ${dir}`)

const withHints = <T>(run: () => T): T => {
  registerAsciiLayout(asciiLayoutProvider)
  try {
    return run()
  } finally {
    registerAsciiLayout(undefined)
  }
}

const draw = (src: string): string =>
  withHints(() => renderMermaidASCII(src, { colorMode: 'none' }))

const CASES = [
  // [sample, siblings, over, under]
  ['Five Cluster Exit', 5, 2, 2],
  ['Six Cluster Exit', 6, 3, 3],
  ['Nine Cluster Exit', 9, 4, 4],
  ['No Other Exit', 3, 1, 1],
] as const

describe('cluster exit siblings go round the target (#2886)', () => {
  for (const dir of ['LR', 'RL'] as const) {
    const head = dir === 'LR' ? '►' : '◄'
    for (const [name, n, over, under] of CASES) {
      const src = source(name, dir)

      it(`${name} ${dir}: ${n} arrowheads into T, the first ${over} over it and the last ${under} under it`, () => {
        const lines = draw(src).split('\n')
        // One arrowhead per sibling into T, one into S and, where there is a U, one for it.
        const heads = n + 1 + (name.includes('No Other') ? 0 : 1)
        expect(lines.join('').split(head).length - 1).toBe(heads)
        const middle = lines.findIndex((l) => /│ T +│/.test(l))
        const at = lines[middle]!.indexOf('T') - 2
        const top = lines.findLastIndex((l, i) => i < middle && l[at] === '┌')
        const bottom = lines.findIndex((l, i) => i > middle && l[at] === '└')
        const rowOf = (label: string): number =>
          lines.findIndex((l) => new RegExp(`─${label}─`).test(l))
        // The first sibling's run is above T's top border, the last one's below its bottom.
        expect(rowOf('1')).toBeLessThan(top)
        expect(rowOf(String(n))).toBeGreaterThan(bottom)
      })

      it(`${name} ${dir}: the outer siblings drop beside T, as mermaid draws them`, () => {
        const edges = withHints(() => readGrid(src).edges).filter(
          (e) => e.from === 'S' && e.to === 'T',
        )
        expect(edges).toHaveLength(n)
        const bends = edges.map((e) => e.bend)
        // The outer siblings' longest leg is the drop beside T (real: 0.90 down to 0.64).
        for (const b of [
          ...bends.slice(0, over),
          ...bends.slice(-Math.min(under, 2)),
        ]) {
          expect(b).toBeGreaterThanOrEqual(0.55)
        }
        // Nested, so the outermost is farthest out: the first and last bend nearest T.
        expect(bends[0]!).toBeGreaterThanOrEqual(bends[over - 1]!)
      })

      it(`${name} ${dir}: snapshots SVG and ASCII`, () => {
        expect(renderMermaidSVG(src)).toMatchSnapshot('svg')
        expect(draw(src)).toMatchSnapshot('ascii-hints')
      })
    }
  }
})
