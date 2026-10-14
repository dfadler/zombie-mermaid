/**
 * #1943: three or more labelled edges between one pair spread the target off
 * the source's column, as mermaid 12.1.0 and 12.2.0 do (T is 25px left of
 * Start in "Five Cluster Exit Siblings"). With two labelled edges nothing moves.
 */
import { describe, it, expect } from 'vitest'
import { layoutFlowchartSync } from '@zombie-mermaid/svg-renderer'
import { parseMermaid } from '../src/index.ts'

function offset(count: number): number {
  const edges = Array.from(
    { length: count },
    (_, i) => `  S -->|${i}| T`,
  ).join('\n')
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
  it('offsets the target from the source column at five edges', () => {
    expect(Math.abs(offset(5))).toBeGreaterThanOrEqual(20)
  })
  it('keeps the old spacing at two edges', () => {
    expect(Math.abs(offset(2))).toBeLessThan(20)
  })
})
