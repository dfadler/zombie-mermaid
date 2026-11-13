/**
 * #1943: three or more labelled edges between one pair spread the target off
 * the source's column, as mermaid 12.1.0 and 12.2.0 do (T is 25px left of
 * Start in "Five Cluster Exit Siblings").
 */
import { describe, it, expect } from 'vitest'
import { layoutFlowchartSync } from '@zombie-mermaid/svg-renderer'
import { parseMermaid } from '../src/index.ts'

function offset(count: number): number {
  const edges = Array.from({ length: count }, (_, i) => `  S -->|${i}| T`).join(
    '\n',
  )
  const g = layoutFlowchartSync(
    parseMermaid(`flowchart TD\n${edges}\n  S -->|other| U`),
  )
  const mid = (id: string): number => {
    const n = g.nodes.find((x) => x.id === id)!
    return n.x + n.width / 2
  }
  return mid('T') - mid('S')
}

describe('labelled parallel edges (#1943)', () => {
  // mermaid@12.3.0 puts T 14-22px left of S from two labelled edges up (with
  // its 120px minimum node width); the old 40px spacing hack is gone (#2717).
  it.each([2, 3, 5])(
    'offsets the target from the source column at %i edges',
    (n) => {
      const d = offset(n)
      expect(d).toBeLessThanOrEqual(-10)
      expect(d).toBeGreaterThanOrEqual(-30)
    },
  )
})
