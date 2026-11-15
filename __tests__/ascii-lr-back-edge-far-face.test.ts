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
import { allForkFixes } from '../demo/fork-fixes-data.ts'
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
    expect(text).toMatch(/├◄──┤ success/)
  })
})

describe('a hub with six ends on one face (ascii-longest-path-layering)', () => {
  const longest = allForkFixes.find(
    (f) => f.id === 'ascii-longest-path-layering',
  )!.source
  it.each(['LR', 'RL'])(
    '%s: every end is on ELK’s face, each with an arrowhead',
    (d) => {
      const src = longest.replace('graph TD', `graph ${d}`)
      const c = measureSample(src)
      expect(c.faceOk).toBe(c.faceEnds)
      expect(c.arrows).toBeGreaterThanOrEqual(c.arrowsWant - 2)
    },
  )

  it('LR: A grows a cell per end, so none shares a cell with another', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const text = renderMermaidASCII(longest.replace('graph TD', 'graph LR'), {
      colorMode: 'none',
      layoutHints: true,
    })
    const rows = text.split('\n')
    const top = rows.findIndex((r) => r.startsWith('┌───┐'))
    const bottom = rows.findIndex((r) => r.startsWith('└───┘'))
    // A's box holds one row per end on its right face (six ends).
    expect(bottom - top).toBeGreaterThanOrEqual(8)
    // Six ends on A's right face: three strokes meet it with no arrowhead, two arrowheads enter.
    const face = rows.slice(top + 1, bottom).map((r) => r.slice(4, 6))
    expect(face.filter((c) => c[0] === '├').length).toBe(3)
    expect(face.filter((c) => c[1] === '◄').length).toBe(2)
    expect(text.match(/long label/g)).toHaveLength(2)
  })
})
