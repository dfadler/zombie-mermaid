/**
 * #2913 / #2919 cause A: the siblings leaving a cluster for one target.
 *
 * mermaid@12.3.0 (`scripts/lib/real-mermaid.ts`) draws every `S --> T` sibling
 * from the cluster's bottom (S:B) to T's top (T:T), each stroke on its own port,
 * and `S --> U` the same way into U's top. The grid left the first sibling by
 * the stand-in's left face and sent the rest round T's bottom; the hint was
 * never matched to the edge (it is keyed by the frame id, not the stand-in).
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { renderMermaidSVG } from '../packages/svg-renderer/src/index.ts'
import { samples } from '../samples/samples-data.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { measureSample } from '../scripts/lib/ascii-topology.ts'

const CASES = [
  ['Five', 5],
  ['Six', 6],
  ['Nine', 9],
] as const

const source = (name: string): string =>
  samples.find(
    (s) => s.title === `Flowchart: ${name} Cluster Exit Siblings (TD)`,
  )!.source

const draw = (src: string, hints: boolean): string => {
  registerAsciiLayout(hints ? asciiLayoutProvider : undefined)
  try {
    return renderMermaidASCII(src, { colorMode: 'none' })
  } finally {
    registerAsciiLayout(undefined)
  }
}

describe('cluster exit siblings take ELK’s faces (#2913)', () => {
  for (const [name, n] of CASES) {
    const src = source(name)

    it.each(['TD', 'LR', 'RL', 'BT'] as const)(
      `${name}: every edge end is on ELK’s face in %s`,
      (dir) => {
        registerAsciiLayout(asciiLayoutProvider)
        try {
          const { faceOk, faceEnds } = measureSample(
            src.replace('flowchart TD', `flowchart ${dir}`),
          )
          expect(faceOk).toBe(faceEnds)
        } finally {
          registerAsciiLayout(undefined)
        }
      },
      // ELK layout under coverage instrumentation is slow.
      90_000,
    )

    it(`${name}: ${n} strokes enter T's top, one arrowhead each, below an intact wall`, () => {
      const lines = draw(src, true).split('\n')
      // The row of arrowheads above T's and U's top borders: n for T, one for U.
      const heads = lines.find((l) => (l.match(/▼/g) ?? []).length >= n + 1)
      expect(heads).toBeDefined()
      expect((heads!.match(/▼/g) ?? []).length).toBe(n + 1)
      expect(heads).toMatch(/^\s*▼+\s+▼\s*$/)
      // The cluster's bottom wall is its own row, not a stroke's bend row.
      expect(lines.some((l) => /^\s*└[─┼]+┘\s*$/.test(l))).toBe(true)
    })

    it(`${name}: snapshots SVG and ASCII (grid and ELK hints)`, () => {
      expect(renderMermaidSVG(src)).toMatchSnapshot('svg')
      expect(draw(src, false)).toMatchSnapshot('ascii-grid')
      expect(draw(src, true)).toMatchSnapshot('ascii-hints')
    })
  }
})
