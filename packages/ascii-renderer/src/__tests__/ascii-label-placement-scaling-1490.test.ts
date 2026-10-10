/**
 * #1490: `besideGeometryFree` scanned every edge's segments per candidate. It
 * now reads a per-layout row index of drawn segments, so 80 labelled edges on
 * shared legs (the #1433/#1463 shape) render well inside the budget below
 * (~13 s before the label-placement fixes, ~0.5 s now).
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

describe('label placement scaling (#1490)', () => {
  it('renders 80 labelled edges on shared legs within budget', () => {
    const t0 = performance.now()
    const out = renderMermaidASCII(labelled(40), { colorMode: 'none' })
    expect(performance.now() - t0).toBeLessThan(5000)
    expect(out).toContain('l79')
  })
})
