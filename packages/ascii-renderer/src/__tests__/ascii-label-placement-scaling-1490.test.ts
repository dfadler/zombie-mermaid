/**
 * #1490: `besideGeometryFree` scanned every edge's segments per candidate. It
 * now reads a per-layout row index of drawn segments, so label placement stays
 * well-behaved on shared legs (the #1433/#1463 shape).
 *
 * Measured on a quiet machine (#1746): 80 labelled edges (`labelled(40)`)
 * render in ~0.45 s, unchanged since #1490; v8 coverage makes it ~1.5 s and a
 * loaded CI runner several times that. A fixed wall-clock budget flaked at
 * 5 s, so this checks scaling instead: the time ratio between n=40 and n=20
 * measured in the same run (cost is roughly cubic, ~5-7x per doubling; a
 * per-candidate edge scan coming back would push it well past the cap).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../index.ts'

function labelled(n: number): string {
  const lines = ['flowchart LR']
  for (let i = 0; i < n; i++) {
    lines.push(`  S${i} -->|l${2 * i}| Sink`, `  S${i} -->|l${2 * i + 1}| Hub`)
    if (i > 0) lines.push(`  S${i - 1} --> S${i}`)
  }
  return lines.join('\n')
}

/** Fastest of `runs` renders, in ms (min is the least load-sensitive statistic). */
function best(n: number, runs = 3): number {
  const src = labelled(n)
  let min = Infinity
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    renderMermaidASCII(src, { colorMode: 'none' })
    min = Math.min(min, performance.now() - t0)
  }
  return min
}

describe('label placement scaling (#1490)', () => {
  it('renders 80 labelled edges on shared legs', () => {
    expect(renderMermaidASCII(labelled(40), { colorMode: 'none' })).toContain(
      'l79',
    )
  })

  it('grows no worse than ~cubic from n=20 to n=40', () => {
    best(10, 1) // warm up JIT before timing
    const ratio = best(40) / best(20)
    expect(ratio).toBeLessThan(20)
    // 60 s timeout: ~7 renders; coverage + a loaded runner blow the 5 s default.
  }, 60_000)
})
