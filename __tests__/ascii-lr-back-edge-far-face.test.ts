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

const trimmed = (text: string): string[] => {
  const rows = text.split('\n').map((l) => l.trimEnd())
  const pad = Math.min(
    ...rows.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length),
  )
  return rows.map((l) => l.slice(pad))
}

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

  it('LR: Connected’s right face takes close, error and success on rows of their own', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const text = renderMermaidASCII(source('LR'), {
      colorMode: 'none',
      layoutHints: true,
    })
    expect(trimmed(text)).toEqual([
      '                                                                                      ╭───────────────╮',
      '                                                                               ┌done──┤               │',
      '                   ┌───►◉                                                      │      │ Disconnecting │',
      '                   │                                                       ┌───┼close►│               │',
      '     ╭────────╮    │                                                       │   │      ╰───────────────╯',
      '     │        │◄───┼───────────────────────────────────────────────────────┼───┘',
      '     │        ├────┘                                                       │',
      '●───►│ Closed ├─────┐                                                      │',
      '     │        │◄──┐ │                                                      │',
      '     │        │◄┐ │ │                                                      │',
      '     ╰────────╯ │ │ │            ╭────────────╮             ╭───────────╮  │',
      '                │ │ └──connect──►│            │             │           ├──┘',
      '                │ │              │ Connecting ├───success──►│ Connected ├───error──┐',
      '                │ └───timeout────┤            │             │           │◄─┐       │',
      '                │                ╰────────────╯             ╰───────────╯  │       │  ╭───────────────╮',
      '                │                                                          │       └─►│               │',
      '                │                                                          └success───┤  Reconnecting │',
      '                └─────────────────────────────max_retries─────────────────────────────┤               │',
      '                                                                                      ╰───────────────╯',
    ])
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

  it('LR: the six ends take rows of their own on A’s face, labels on the runs', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const text = renderMermaidASCII(longest.replace('graph TD', 'graph LR'), {
      colorMode: 'none',
      layoutHints: true,
    })
    expect(trimmed(text)).toEqual([
      '                     ┌───┐',
      '       ┌──────x─────►│   │',
      '       │             │ B ├mid─┐',
      '       │ ┌long label─┤   │    │',
      '       │ │           └───┘    │',
      '       │ │                    │',
      '       │ │                    │',
      '       │ │                    │',
      '       │ │                    │',
      '┌───┐  │ │           ┌───┐    │',
      '│   ├──┘ │           │   │    │',
      '│   │◄───┘           │   │    │',
      '│ A ├────long label─►│ C │    │',
      '│   │◄──────ab───────┤   │    │',
      '│   ├───┐            │   │    │',
      '│   │◄┐ │            │   │    │',
      '└───┘ │ │            └───┘    │    ┌───┐',
      '      │ │                     └───►│   │',
      '      │ └───────────ab────────────►│ D │',
      '      └─────────────x──────────────┤   │',
      '                                   └───┘',
    ])
  })
})

describe('a decision with more than three ends on a face', () => {
  const src = `graph LR
D{d} -->|a| B
B -->|b| D
D -->|c| C
C -->|e| D
D -->|f| E
D -->|g| F
E -->|h| D`
  it('keeps the grid’s faces for a labelled reciprocal pair: its labels stay apart', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const text = renderMermaidASCII(src, {
      colorMode: 'none',
      layoutHints: true,
    })
    for (const l of 'abcefgh')
      expect(text).toMatch(new RegExp(`(?<![a-zA-Z])${l}(?![a-zA-Z])`))
    // `b` runs down into the decision’s top, its arrowhead just below it.
    expect(text).toMatch(/(?<![a-zA-Z])b[^\n]*\n\s*▼/)
  })

  it('keeps them when the decision’s edge of the pair is routed second', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const text = renderMermaidASCII(
      `graph LR
D{d} -->|f| E
D -->|g| F
E -->|h| D
G -->|i| D
D -->|j| G
B -->|b| D
D -->|a| B`,
      { colorMode: 'none', layoutHints: true },
    )
    // The decision keeps the grid’s faces for the pair: `◄` arrowheads inside its side.
    expect(
      text
        .split('\n')
        .filter((l) => l.includes('◄'))
        .map((l) => l.trim()),
    ).toEqual(['< d ◄>─────┐', '╲ ◄╱──┼─┐ │'])
  })
})
