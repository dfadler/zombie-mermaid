/**
 * Edges repeated between the same two nodes keep a lane each (#1592).
 *
 * `bundleEdgePaths` collapses a fan-out onto one trunk, which drew four
 * `a --> b` edges as four polylines with identical points. mermaid.js draws a
 * lane per edge, so repeated pairs are left out of the bundle.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

/** The `points` of every edge from `from` to `to`, in document order. */
function pointsOf(svg: string, from: string, to: string): string[] {
  return [
    ...svg.matchAll(
      /data-from="([^"]+)" data-to="([^"]+)"[^>]*points="([^"]+)"/g,
    ),
  ]
    .filter((m) => m[1] === from && m[2] === to)
    .map((m) => m[3]!)
}

describe('repeated edges between one pair of nodes', () => {
  for (const dir of ['TD', 'LR'] as const) {
    it(`${dir}: four a-->b edges have four distinct paths`, async () => {
      const svg = await renderMermaidSVG(`flowchart ${dir}
  a --> b
  a --> b
  a --> b
  a --> b
  a --> c`)
      const ab = pointsOf(svg, 'a', 'b')
      expect(ab).toHaveLength(4)
      expect(new Set(ab).size).toBe(4)
    })
  }

  it('still bundles a fan-out of distinct targets', async () => {
    const svg = await renderMermaidSVG(`flowchart TD
  a --> b
  a --> c
  a --> d`)
    const starts = ['b', 'c', 'd'].map(
      (t) => pointsOf(svg, 'a', t)[0]!.split(' ')[0],
    )
    expect(new Set(starts).size).toBe(1)
  })

  it('still bundles a fan-in of distinct sources', async () => {
    const svg = await renderMermaidSVG(`flowchart TD
  b --> a
  c --> a
  d --> a`)
    const ends = ['b', 'c', 'd'].map((s) =>
      pointsOf(svg, s, 'a')[0]!.split(' ').at(-1),
    )
    expect(new Set(ends).size).toBe(1)
  })
})
