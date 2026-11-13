/**
 * State layouts against recorded mermaid@12.3.0 renders (headless Chromium via
 * scripts/lib/real-mermaid.ts), as node offsets from the start dot, in px:
 * #3004 (notes), #3005 (connection lifecycle), #3007 (composite, two [*] pairs).
 * Offsets, not absolutes, because mermaid pads the diagram by 8px and we by 40.
 */
import { describe, it, expect } from 'vitest'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'
import { parseMermaid } from '../index.ts'

function offsets(source: string): Record<string, [number, number]> {
  const g = layoutGraphSync(parseMermaid(source))
  const start = g.nodes.find((n) => n.id === '_start')!
  return Object.fromEntries(
    g.nodes.map((n) => [
      n.id,
      [Math.round(n.x - start.x), Math.round(n.y - start.y)],
    ]),
  )
}
const near = (a: [number, number], b: [number, number]) => {
  expect(Math.abs(a[0] - b[0])).toBeLessThanOrEqual(6) // edge-label text widths differ a little from Chromium's
  expect(Math.abs(a[1] - b[1])).toBeLessThanOrEqual(1)
}

describe('state layout matches mermaid@12.3.0', () => {
  it('notes (#3004)', () => {
    const o = offsets(`stateDiagram-v2
  [*] --> Active
  note right of Active : this is a note
  Active --> Idle
  note left of Idle
    a note
    over two lines
  end note
  Idle --> [*]`)
    near(o.Active!, [-61, 149])
    near(o['Active----note-1']!, [-87, 342])
    near(o['Idle----note-3']!, [139, 129])
    near(o.Idle!, [127, 317])
    near(o._end!, [188, 460])
  })

  it('connection lifecycle (#3005)', () => {
    const o = offsetsOf(`stateDiagram-v2
  [*] --> Closed
  Closed --> Connecting : connect
  Connecting --> Connected : success
  Connecting --> Closed : timeout
  Connected --> Disconnecting : close
  Connected --> Reconnecting : error
  Reconnecting --> Connected : success
  Reconnecting --> Closed : max_retries
  Disconnecting --> Closed : done
  Closed --> [*]`)
    near(o.Closed!, [-61, 54])
    near(o.Connecting!, [-30, 238])
    near(o.Connected!, [-30, 382])
    near(o.Disconnecting!, [-151, 526])
    near(o.Reconnecting!, [33, 526])
    near(o._end!, [-83, 174])
  })

  it('composite with two [*] pairs (#3007)', () => {
    const g = layoutGraphSync(
      parseMermaid(`stateDiagram-v2
  state X {
    [*] --> a
    a --> [*]
    [*] --> b
    b --> [*]
  }
  [*] --> X
  X --> [*]`),
    )
    const x = g.groups.find((s) => s.id === 'X')!
    expect([Math.round(x.width), Math.round(x.height)]).toEqual([370, 287])
    const y = (id: string) => g.nodes.find((n) => n.id === id)!.y
    expect(y('_end2') - y('_start2')).toBe(381)
    expect(y('a') - y('_start')).toBe(86)
  })

  it('lays out a note inside a composite state', () => {
    const g = layoutGraphSync(
      parseMermaid(
        'stateDiagram-v2\n  state S {\n    [*] --> a\n    a --> b\n    note right of b : hi\n  }',
      ),
    )
    const note = g.nodes.find((n) => n.id === 'b----note-2')!
    expect([note.width, note.height]).toEqual([150, 54])
    const s = g.groups.find((x) => x.id === 'S')!
    expect(note.x).toBeGreaterThanOrEqual(s.x)
    expect(note.x + note.width).toBeLessThanOrEqual(s.x + s.width)
  })

  it('centres a marker on its neighbour in a left-to-right diagram', () => {
    const g = layoutGraphSync(
      parseMermaid('stateDiagram-v2\n  direction LR\n  [*] --> A\n  A --> B'),
    )
    const [s, a] = ['_start', 'A'].map((id) =>
      g.nodes.find((n) => n.id === id)!,
    )
    expect(s!.y + s!.height / 2).toBeCloseTo(a!.y + a!.height / 2)
  })
})

const offsetsOf = offsets
