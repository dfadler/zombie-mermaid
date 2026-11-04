/** #2587: `Note over A,B` spans both lifelines like mermaid 12.3.0. */
import { describe, it, expect } from 'vitest'
import { parseSequenceDiagram } from '@zombie-mermaid/mermaid-parser'
import { layoutSequenceDiagram } from '../sequence/layout.ts'

const lay = (src: string) =>
  layoutSequenceDiagram(
    parseSequenceDiagram(src.split('\n').map((text, line) => ({ text, line }))),
  )
const cx = (a: { x: number }) => a.x

describe('multi-actor over note width (#2587)', () => {
  it('overhangs both lifelines by 25px', () => {
    const l = lay('sequenceDiagram\nA->>B: hi\nNote over A,B: x')
    const [a, b] = l.actors
    const n = l.notes[0]!
    expect(n.x).toBeCloseTo(cx(a!) - 25)
    expect(n.x + n.width).toBeCloseTo(cx(b!) + 25)
  })
  it('keeps a long text wider than the span, centred', () => {
    const l = lay(
      'sequenceDiagram\nA->>B: hi\nNote over A,B: ' + 'long text '.repeat(30),
    )
    const [a, b] = l.actors
    const n = l.notes[0]!
    expect(n.width).toBeGreaterThan(Math.abs(cx(b!) - cx(a!)) + 50)
    expect(n.x + n.width / 2).toBeCloseTo((cx(a!) + cx(b!)) / 2)
  })
  it('leaves left/right notes unchanged', () => {
    const l = lay(
      'sequenceDiagram\nA->>B: hi\nNote right of B: r\nNote left of A: l',
    )
    expect(l.notes.map((n) => n.width)).toEqual([60, 60])
  })
})
