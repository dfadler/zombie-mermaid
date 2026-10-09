/**
 * #1458: label placement asked `pathToDrawing` for every other edge on every
 * candidate (edges² × candidates). Within one draw it is now computed once per
 * edge, so the grid->drawing conversions stay linear in the edge count.
 */
import { describe, it, expect, vi } from 'vitest'

const calls = vi.hoisted(() => ({ n: 0 }))
vi.mock('../grid.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../grid.ts')>()
  return {
    ...mod,
    lineToDrawing: (...a: Parameters<typeof mod.lineToDrawing>) => {
      calls.n++
      return mod.lineToDrawing(...a)
    },
  }
})

import { renderMermaidASCII } from '../index.ts'

function dense(n: number): { src: string; edges: number } {
  const lines = ['graph TD']
  let edges = 0
  for (let i = 0; i < n; i++) {
    for (const d of [1, 2, 3]) {
      if (i + d < n) {
        lines.push(`  n${i} -->|e${i}_${d}| n${i + d}`)
        edges++
      }
    }
  }
  return { src: lines.join('\n'), edges }
}

describe('pathToDrawing cache (#1458)', () => {
  it('converts each edge path a bounded number of times per render', () => {
    const { src, edges } = dense(24)
    calls.n = 0
    renderMermaidASCII(src)
    // ~18k cached vs ~2.1M uncached (66 edges); scales with edges².
    expect(calls.n).toBeLessThan(edges * 500)
  })
})
