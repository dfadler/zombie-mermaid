/**
 * A duplicate pair plus a reciprocal between two stacked nodes draws three
 * straight strokes on the facing faces, in declaration order, as ELK and
 * mermaid@12.3.0 do, instead of sending the second duplicate round the side
 * faces. (SVG has no analogue: this is the grid's own face choice.)
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { measureSample } from '../scripts/lib/ascii-topology.ts'

const source = (dir: string): string => `flowchart ${dir}
    n0["L6rc9iw"]
    n1(["9B531Zk"])
    n1 --> n0
    n0 --> n1
    n1 --> n0`

describe('duplicate pair with a reciprocal (TD/BT)', () => {
  it.each(['TD', 'BT'])('%s: every end is on ELK’s face', (d) => {
    const c = measureSample(source(d))
    expect(c.faceOk).toBe(c.faceEnds)
  })

  it.each(['TD', 'BT'])('%s: three strokes, none on a side face', (d) => {
    registerAsciiLayout(asciiLayoutProvider)
    const text = renderMermaidASCII(source(d), {
      colorMode: 'none',
      layoutHints: true,
    })
    const rows = text.split('\n')
    // Three arrowheads, one per edge, and no stroke bends beside the nodes.
    expect(text.match(/[▲▼]/g)).toHaveLength(3)
    expect(text).not.toMatch(/[◄►]/)
    // The strokes run in columns two cells apart: ▲ │ ▲ / │ ▼ │ (TD),
    // mirrored for BT.
    const stroke = rows.find((r) => /^\s*[▲│▼] [▲│▼] [▲│▼]\s*$/.test(r))
    expect(stroke).toBeDefined()
  })

  const render = (d: string): string => {
    registerAsciiLayout(asciiLayoutProvider)
    return renderMermaidASCII(source(d), {
      colorMode: 'none',
      layoutHints: true,
    })
  }

  // The exact grids, one row per entry (the repo keeps snapshot matchers to an
  // allow-list). The same source in RL has a gallery snapshot of its own.
  it('TD: the exact grid', () => {
    expect(render('TD').split('\n')).toEqual([
      ' ┌──────────┐',
      ' │          │',
      ' │ L6rc9iw  │',
      ' │          │',
      ' └────┬─────┘',
      '    ▲ │ ▲    ',
      '    │ │ │    ',
      '    │ │ │    ',
      '    │ │ │    ',
      '    │ ▼ │    ',
      ' ╭──┴───┴───╮',
      ' (          )',
      ' ( 9B531Zk  )',
      ' (          )',
      ' ╰──────────╯',
    ])
  })

  it('BT: the exact grid', () => {
    expect(render('BT').split('\n')).toEqual([
      ' ╭──────────╮',
      ' (          )',
      ' ( 9B531Zk  )',
      ' (          )',
      ' ╰──┬───┬───╯',
      '    │ ▲ │    ',
      '    │ │ │    ',
      '    │ │ │    ',
      '    │ │ │    ',
      '    ▼ │ ▼    ',
      ' ┌────┴─────┐',
      ' │          │',
      ' │ L6rc9iw  │',
      ' │          │',
      ' └──────────┘',
    ])
  })
})
