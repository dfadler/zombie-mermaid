/**
 * #2100: `a --> a`, `b --> a`, `a --> c`, `b --> c`, `c --> a` drew `b --> c`
 * as a branch of `b --> a` and merged it into `a --> c`, so one arrowhead
 * served two edges and `b --> c` had none of its own. Cause: `c`'s top face
 * holds a fan-in (`a --> c`, `b --> c`) and an edge going up (`c --> a`). The
 * fan-in was bundled onto one trunk and junction, which that face has no room
 * for, and the face (one cell per end) was too short to land the strokes
 * apart. Such a fan-in is no longer bundled (`canBundle`), its node is wide
 * enough for a cell per end (`spreadCandidates`), and `separateFanIns` lands
 * the strokes beyond the cells the other role holds.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const source = (dir: string): string => `flowchart ${dir}
  a["a"]
  b["b"]
  c["c"]
  a --> a
  b --> a
  a --> c
  b --> c
  c --> a`

const render = (dir: string, useAscii = false): string[] =>
  renderMermaidASCII(source(dir), { useAscii })
    .split('\n')
    .map((l) => l.trimEnd())

describe('crowded fan-in keeps a stroke and an arrowhead per edge (#2100)', () => {
  it('TD: b->c lands beside a->c, with its own arrowhead', () => {
    expect(render('TD').join('\n')).toBe(`┌───────┐
│       │
│   b   │
│       │
└───┬─┬─┘
    │ │
    │ │
    │ └────┐
    │      │
    ▼      │
┌───────┐  │
│       │  │
│   a   │◄┐│
│       │ ││
└────┬─┬┘ ││
   ▲ │ │  ││
   │ │ │  ││
   │ │ └──┘│
   │ │     │
   │ │     │
   │ │ ┌───┘
   │ ▼ ▼
┌──┴────┐
│       │
│   c   │
│       │
└───────┘`)
  })

  it('BT: the same source mirrored', () => {
    expect(render('BT').join('\n')).toBe(`┌───────┐
│       │
│   c   │
│       │
└──┬────┘
   │ ▲ ▲
   │ │ └───┐
   │ │     │
   │ │     │
   │ │ ┌──┐│
   │ │ │  ││
   ▼ │ │  ││
┌────┴─┴┐ ││
│       │ ││
│   a   │◄┘│
│       │  │
└───────┘  │
    ▲      │
    │      │
    │ ┌────┘
    │ │
    │ │
┌───┴─┴─┐
│       │
│   b   │
│       │
└───────┘`)
  })

  it('TD: the row above c holds two arrowheads, a stroke spacing apart', () => {
    const lines = render('TD')
    const top = lines.findIndex((l) => l.startsWith('┌') && l.includes('┴'))
    const heads = [...lines[top - 1]!].flatMap((ch, x) =>
      ch === '▼' ? [x] : [],
    )
    expect(heads).toHaveLength(2)
    expect(heads[1]! - heads[0]!).toBeGreaterThanOrEqual(2)
  })
})
