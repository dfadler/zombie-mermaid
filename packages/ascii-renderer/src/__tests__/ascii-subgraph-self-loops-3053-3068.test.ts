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
