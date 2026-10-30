/**
 * #1490: `besideGeometryFree` scanned every edge's segments per candidate. It
 * now reads a per-layout row index of drawn segments, so label placement stays
 * well-behaved on shared legs (the #1433/#1463 shape).
 *
 * Measured on a quiet machine (#1746): 80 labelled edges (`labelled(40)`)
 * render in ~0.45 s, unchanged since #1490; v8 coverage makes it ~1.5 s and a
 * loaded CI runner several times that. A fixed wall-clock budget flaked at
 * 5 s, so this checks scaling instead: the time ratio between n=40 and n=20
 * measured in the same run (#1785: cost is now roughly quadratic, measured
 * 3.0-3.6x per doubling here, was 5.3-6.3x when the cap was set; the cap of 6
 * leaves ~1.7x margin for load noise and still sits below the 8-12x an extra
 * per-candidate edge scan gave as a sabotage check).
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
    // 30 s timeout: ~4 s alone, several-fold slower under full-suite load (#1825).
  }, 30_000)

  it('grows no worse than ~quadratic from n=20 to n=40', () => {
    bestPair(10, 10, 1) // Warm up JIT before timing
    // Transient load (a parallel typecheck, a busy CI runner) can inflate one
    // attempt to ~17x; a real regression is slow in every attempt. So take the
    // best ratio of up to 3 attempts, stopping at the first that passes.
    let ratio = Infinity
    for (let attempt = 0; attempt < 3 && ratio >= 6; attempt++) {
      const [t20, t40] = bestPair(20, 40)
      ratio = Math.min(ratio, t40 / t20)
    }
    expect(ratio).toBeLessThan(6)
    // 180 s timeout: up to ~36 renders, ~17 s alone; under `verify --full`
    // worker contention it exceeded 60 s (#1825).
  }, 180_000)
})
