import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../index.ts'

// #2027: a connector glyph must join the stroke it leads to, and a fork/join
// bar must touch the stems that attach to it.
describe('state diagram orphan stubs (#2027)', () => {
  it('Active -> Idle stroke starts at the box connector, no blank gap', () => {
    const out = renderMermaidASCII(
      `stateDiagram-v2
  [*] --> Active
  note right of Active : this is a note
  Active --> Idle
  note left of Idle
    a note
    over two lines
  end note
  Idle --> [*]`,
    )
    const row = out.split('\n').find((l) => l.includes('Active'))!
    expect(row).toMatch(/Active\s+├─+┐/)
  })

  it('fork/join bars touch their stems', () => {
    const lines = renderMermaidASCII(
      `stateDiagram-v2
  state f <<fork>>
  state j <<join>>
  [*] --> f
  f --> A
  f --> B
  A --> j
  B --> j
  j --> [*]`,
    ).split('\n')
    const isBar = (l: string) => l.includes('█')
    const bars = lines.flatMap((l, i) => (isBar(l) ? [i] : []))
    expect(bars.length).toBeGreaterThan(0)
    for (const i of bars) {
      // Neighbouring rows are the bar, or carry a stem/arrow glyph: never blank.
      for (const j of [i - 1, i + 1]) {
        if (isBar(lines[j]!)) continue
        expect(lines[j]!.trim()).not.toBe('')
      }
    }
  })
})
