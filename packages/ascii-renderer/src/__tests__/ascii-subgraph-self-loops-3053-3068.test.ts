/**
 * #3053: duplicate self-loops of a member of a frame with its own `direction`
 * drew one hook (the nesting helpers read the diagram's direction, and the
 * grid took no ELK hints once a frame set its own). #3068: an unhinted LR
 * self-loop's run below its node shared the row of its frame's bottom wall.
 * mermaid@12.3.0 draws both hooks over the top of the node, in all four outer
 * directions.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  registerAsciiLayout,
  getAsciiLayout,
  renderMermaidASCII,
} from '@zombie-mermaid/ascii-renderer'
import { asciiLayoutProvider } from '../../../../src/ascii-layout-provider.ts'

const frame = (outer: string, loops: number): string =>
  `flowchart ${outer}
    subgraph S
        direction LR
        a --> b
${'        b --> b\n'.repeat(loops)}    end`

const saved = getAsciiLayout()
beforeEach(() => registerAsciiLayout(asciiLayoutProvider))
afterEach(() => registerAsciiLayout(saved))

describe('#3053 duplicate self-loops in a frame with its own direction', () => {
  for (const outer of ['TD', 'LR', 'RL']) {
    it(`draws one hook per loop over the node (${outer})`, () => {
      const lines = renderMermaidASCII(frame(outer, 2)).split('\n')
      const top = lines.findIndex((l) => l.includes('┌┴─┴'))
      expect(top).toBeGreaterThan(0)
      // Two arrowheads land on the node's top face, none on a side.
      expect(lines.filter((l) => l.includes('▼ ▼'))).toHaveLength(1)
      expect(lines.join('\n').match(/▼/g)).toHaveLength(2)
    })
  }

  it('hooks a loop in a frame that repeats the diagram direction', () => {
    const out = renderMermaidASCII(
      'flowchart TD\n subgraph S\n direction TB\n a --> b\n b --> b\n b --> b\n end',
    )
    expect(out.match(/►/g)).toHaveLength(2)
  })

  it('keeps a single loop over the node too', () => {
    const out = renderMermaidASCII(frame('RL', 1))
    expect(out.match(/▼/g)).toHaveLength(1)
    expect(out).toContain('│ a ├')
  })

  it('keeps node labels in place under an RL root with a wide member', () => {
    const out = renderMermaidASCII(
      'flowchart RL\n subgraph S\n direction LR\n a --> bbbbbbbbbbbb\n end',
    )
    expect(out).toMatch(/│ a ├─+►│ bbbbbbbbbbbb │/)
  })
})

/**
 * #2913: mermaid@12.3.0 draws a frame's loops by the frame's own direction, whatever
 * the root's: an LR frame starts them on the left and a TD frame at the top,
 * RL on the right and BT at the bottom (measured in all 16 root/frame pairs).
 * ELK's loop face now follows the frame, so the grid's hints are the frame's own.
 */
describe('#2913 loop hooks follow the frame direction, not the root', () => {
  const src = (root: string, inner: string, loops = 2): string =>
    `flowchart ${root}\n subgraph S\n direction ${inner}\n a --> b\n${' b --> b\n'.repeat(loops)} end`
  /** Where a hook's legs sit against its arrowheads, on the axis the frame lays out along. */
  const startSide = (text: string, inner: string): string => {
    const rows = text.split('\n').map((l) => [...l])
    const at = (re: RegExp, pos: 'row' | 'col'): number =>
      Math.min(
        ...rows.flatMap((l, r) =>
          l.flatMap((c, i) => (re.test(c) ? [pos === 'row' ? r : i] : [])),
        ),
      )
    if (inner === 'LR' || inner === 'RL')
      return at(/[┴┬]/, 'col') < at(/[▼▲]/, 'col') ? 'left' : 'right'
    return at(/[┤├]/, 'row') < at(/[►◄]/, 'row') ? 'top' : 'bottom'
  }
  const want = { LR: 'left', RL: 'right', TD: 'top', BT: 'bottom' } as const

  for (const root of ['TD', 'LR', 'RL', 'BT'])
    for (const inner of ['LR', 'RL', 'TD', 'BT'] as const)
      it(`root ${root}, frame ${inner}: the hooks start ${want[inner]}`, () => {
        expect(startSide(renderMermaidASCII(src(root, inner)), inner)).toBe(
          want[inner],
        )
      })

  it('draws an LR frame the same under a TD, LR and RL root, for any loop count', () => {
    for (const loops of [1, 2, 3]) {
      const td = renderMermaidASCII(src('TD', 'LR', loops))
      expect(renderMermaidASCII(src('LR', 'LR', loops))).toBe(td)
      expect(renderMermaidASCII(src('RL', 'LR', loops))).toBe(td)
    }
  })
})

describe('#3068 unhinted LR loop clears its frame bottom wall', () => {
  it('draws the loop run inside the frame, a row above the wall', () => {
    registerAsciiLayout(undefined)
    const lines = renderMermaidASCII(
      `flowchart LR
  subgraph A
    x
  end
  subgraph B
    p --> q
    q --> q
  end
  x --> p`,
    ).split('\n')
    // The wall is a plain run: the loop's bottom run no longer shares it.
    const wall = lines.findLastIndex((l) => l.includes('└'))
    expect(lines[wall]).not.toContain('┴')
    expect(lines.some((l) => l.includes('└───┘'))).toBe(true)
  })
})
