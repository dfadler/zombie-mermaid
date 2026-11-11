/**
 * #2919 / #2913, two edge-end faces the topology gate counted off:
 *
 * - A decision's start on its upper or lower slant (ELK T or B in an LR flow)
 *   is drawn on the slant, but the grid's start direction for it is Right. The
 *   gate now reads the slant off the drawn first stroke cell.
 * - `State: Composite States`: the `Error --> Idle` back edge leaves Error's
 *   top and reaches Idle's bottom (mermaid@12.3.0: Error:T to Idle:B) by the
 *   gutter right of the composite, instead of looping Idle's right side.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { nestedSides } from '../packages/ascii-renderer/src/port-offsets.ts'
import type {
  PortRun,
  Slot,
} from '../packages/ascii-renderer/src/port-offsets.ts'
import { samples } from '../samples/samples-data.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import {
  measureSample,
  readGrid,
  redirectDirection,
} from '../scripts/lib/ascii-topology.ts'

const sample = (title: string): string =>
  samples.find((s) => s.title === title)!.source

const draw = (source: string): string => {
  registerAsciiLayout(asciiLayoutProvider)
  try {
    return renderMermaidASCII(source, { layoutHints: true } as never)
  } finally {
    registerAsciiLayout(undefined)
  }
}

describe('a decision’s slant start is measured where it is drawn (#2919)', () => {
  const source = sample('Decision Self-Loop with Duplicate Edges')

  it.each(['LR', 'RL'] as const)(
    'every end of the sample is on ELK’s face in %s',
    (dir) => {
      registerAsciiLayout(asciiLayoutProvider)
      const { faceOk, faceEnds } = measureSample(
        source.replace('flowchart LR', `flowchart ${dir}`),
      )
      expect(faceOk).toBe(faceEnds)
    },
  )

  it('reads the upper and lower slant starts as diagonal ends, the tip as Right', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const starts = readGrid(source).edges.map((e) => e.start.join(''))
    // Edge order: self-loop, n0->n2 (T), n0->n2 (R), n0->n1 (R), n1->n0, n0->n1 (B)
    expect(starts[1]).toBe('TR')
    expect(starts[5]).toBe('BR')
    expect(starts[3]).toBe('R')
  })

  it('keeps a start on the tip as Right', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const [e] = readGrid('flowchart LR\n  A{d} --> B').edges
    expect(e!.start).toEqual(['R'])
  })

  it('draws the T and B starts off the slants, not the tip', () => {
    const lines = draw(source).split('\n')
    const tip = lines.findIndex((l) => l.startsWith('< gSQ21Q >'))
    expect(tip).toBeGreaterThan(0)
    expect(lines[tip - 1]).toMatch(/╲─{2,}/)
    expect(lines[tip + 1]).toMatch(/╱─{2,}/)
  })
})

describe('a back edge reaches the bottom face by the gutter beside a composite (#2919)', () => {
  const source = sample('State: Composite States')

  it.each(['TD', 'BT'] as const)(
    'puts every end of the sample on ELK’s face in %s',
    (dir) => {
      registerAsciiLayout(asciiLayoutProvider)
      const { faceOk, faceEnds } = measureSample(
        redirectDirection(
          source.replace(
            'stateDiagram-v2',
            `stateDiagram-v2\n  direction ${dir}`,
          ),
        ),
      )
      expect(faceOk).toBe(faceEnds)
    },
  )

  it('retry arrives under Idle and clears the Processing frame', () => {
    const lines = draw(source).split('\n')
    const idle = lines.findIndex((l) => l.includes('Idle'))
    const frame = lines.findIndex((l) => l.includes('Processing'))
    // The arrowhead sits under Idle, between it and the composite
    expect(lines.slice(idle + 1, frame).join('\n')).toContain('▲')
    expect(lines[idle]).not.toContain('◄')
    // The label sits in the gap above the frame, its run turns right of the wall
    const wall = lines[frame]!.indexOf('│', lines[frame]!.indexOf('Processing'))
    const retry = lines.findIndex((l) => l.includes('retry'))
    expect(retry).toBeLessThan(frame)
    expect(lines[retry]!.indexOf('┐')).toBeGreaterThan(wall)
  })

  it('takes the cell right of submit’s stem under Idle and crosses no stroke', () => {
    const out = draw(source)
    const lines = out.split('\n')
    const idle = lines.findIndex((l) => l.includes('Idle'))
    const arrow = lines.slice(idle).find((l) => l.includes('▲'))!
    // Submit leaves at the centre (│), retry arrives right of it (▲)
    expect(arrow.indexOf('▲')).toBeGreaterThan(arrow.indexOf('│'))
    expect(out).not.toContain('┼')
  })

  it('draws the same diagram without hints as before', () => {
    registerAsciiLayout(undefined)
    const text = renderMermaidASCII(source)
    expect(text).toContain('retry')
    expect(text).toMatch(/Error ├/)
  })
})

describe('nestedSides guards (#2919)', () => {
  const slot = (
    role: 'S' | 'E',
    turn: -1 | 0 | 1,
    extent: number,
    over: Partial<Slot> & { axis?: 'v' | 'h'; side?: PortRun['side'] } = {},
  ): Slot => ({
    run: {
      axis: over.axis ?? 'v',
      line: 0,
      from: 0,
      to: 1,
      side: over.side ?? 'bottom',
      node: {} as never,
      cell: { x: 0, y: 0 },
      turn,
    },
    role,
    fixed: false,
    elbow: false,
    extent,
    far: 0,
    down: 1,
    gutter: over.gutter ?? true,
  })
  const port = (): string => 'p'

  it('does nothing for an edge off the gutter, a side run, or no bend', () => {
    const mate = slot('S', -1, 2)
    const off = new Map([
      ['a', slot('E', 1, 5, { gutter: false })],
      ['b', mate],
    ])
    expect(nestedSides(off, 'a', port)).toBeUndefined()
    const side = new Map([
      ['a', slot('E', 1, 5, { axis: 'h' })],
      ['b', mate],
    ])
    expect(nestedSides(side, 'a', port)).toBeUndefined()
    const straight = new Map([
      ['a', slot('E', 0, 5)],
      ['b', mate],
    ])
    expect(nestedSides(straight, 'a', port)).toBeUndefined()
  })

  it('does nothing without a partner on the same face going the other way', () => {
    expect(
      nestedSides(new Map([['a', slot('E', 1, 5)]]), 'a', port),
    ).toBeUndefined()
    for (const mate of [
      slot('E', 1, 2),
      slot('S', 1, 2, { axis: 'h' }),
      slot('S', 1, 2, { side: 'top' }),
      slot('S', 0, 2),
    ]) {
      const m = new Map([
        ['a', slot('E', 1, 5)],
        ['b', mate],
      ])
      expect(nestedSides(m, 'a', port)).toBeUndefined()
    }
  })

  it('puts an end on the side its leg comes from when the legs head opposite ways', () => {
    // E from the right (turn -1 -> side +1), S heading left (side -1)
    const m = new Map([
      ['a', slot('E', -1, 5)],
      ['b', slot('S', -1, 2)],
    ])
    expect(nestedSides(m, 'a', port)).toBe(-1 * -1)
  })

  it('nests same-side bends: nearer inside, farther outside, a tie left alone', () => {
    const near = (e: number) =>
      new Map([
        ['a', slot('S', -1, e)],
        ['b', slot('E', 1, 5)],
      ])
    expect(nestedSides(near(2), 'a', port)).toBe(-1)
    expect(nestedSides(near(9), 'a', port)).toBe(1)
    expect(nestedSides(near(5), 'a', port)).toBeUndefined()
  })
})
