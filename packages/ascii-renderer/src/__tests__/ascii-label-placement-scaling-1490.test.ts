/**
 * #1490: `besideGeometryFree` scanned every edge's segments per candidate. It
 * now reads a per-layout row index of drawn segments, so label placement stays
 * well-behaved on shared legs (the #1433/#1463 shape).
 *
 * Measured on a quiet machine (#1746): 80 labelled edges (`labelled(40)`)
 * render in ~0.45 s, unchanged since #1490; v8 coverage makes it ~1.5 s and a
 * loaded CI runner several times that. A fixed wall-clock budget flaked at
 * 5 s, so this checks scaling instead: the time ratio between n=40 and n=20
 * measured in the same run (cost is roughly cubic, measured 5.3-6.3x per doubling; an extra
 * per-candidate edge scan injected as a sabotage check gave 8-12x, so the
 * cap of 10 sits between the two; the old cap of 20 let that regression pass).
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

/**
 * Fastest of `runs` renders of each size, in ms (min is the least
 * load-sensitive statistic). The sizes alternate so a load spike mid-test
 * hits both sides of the ratio instead of only one.
 */
function bestPair(small: number, large: number, runs = 6): [number, number] {
  const srcs: [string, string] = [labelled(small), labelled(large)]
  const min: [number, number] = [Infinity, Infinity]
  for (let i = 0; i < runs * 2; i++) {
    const k = (i % 2) as 0 | 1
    const t0 = performance.now()
    renderMermaidASCII(srcs[k], { colorMode: 'none' })
    min[k] = Math.min(min[k], performance.now() - t0)
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
    bestPair(10, 10, 1) // warm up JIT before timing
    // Transient load (a parallel typecheck, a busy CI runner) can inflate one
    // attempt to ~17x; a real regression is slow in every attempt. So take the
    // best ratio of up to 3 attempts, stopping at the first that passes.
    let ratio = Infinity
    for (let attempt = 0; attempt < 3 && ratio >= 10; attempt++) {
      const [t20, t40] = bestPair(20, 40)
      ratio = Math.min(ratio, t40 / t20)
    }
    expect(ratio).toBeLessThan(10)
    // 60 s timeout: up to ~36 renders; coverage + a loaded runner blow the 5 s default.
  }, 60_000)
})
