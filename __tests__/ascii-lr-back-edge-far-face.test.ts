/**
 * A labelled back edge in a horizontal flow enters the far face of its target
 * where ELK and mermaid@12.3.0 end it, instead of a U into the bottom face that
 * shares an arrowhead with the edge beside it. (SVG has no analogue: this is
 * the grid's own face choice.)
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { measureSample } from '../scripts/lib/ascii-topology.ts'

const source = (dir: string): string => `stateDiagram-v2
  direction ${dir}
  [*] --> Closed
  Closed --> Connecting : connect
  Connecting --> Connected : success
  Connecting --> Closed : timeout
  Connected --> Disconnecting : close
  Connected --> Reconnecting : error
  Reconnecting --> Connected : success
  Reconnecting --> Closed : max_retries
  Disconnecting --> Closed : done
  Closed --> [*]`

describe('back edge into the far face (LR/RL)', () => {
  it.each(['LR', 'RL'])('%s: every end is on ELK’s face', (d) => {
    const c = measureSample(source(d))
    expect(c.faceOk).toBe(c.faceEnds)
  })

  it('LR: `success` enters Connected’s right face with its own arrowhead', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const text = renderMermaidASCII(source('LR'), {
      colorMode: 'none',
      layoutHints: true,
    })
    expect(text).toMatch(/╰───────────╯\s+│\s+╭/)
    expect(text).toMatch(/├◄──┤ success/)
    expect(text.match(/◄/g)).toHaveLength(2)
  })
})
