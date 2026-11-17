/**
 * A back edge whose ends ELK puts a node apart on the cross axis keeps them on
 * separate rows, so its long run sits on a row of its own and the riser beside
 * the target is the longer vertical, as mermaid@12.3.0's layout (ELK) draws
 * `Fix & Retry` -.-> `Push Code`. Before, both snapped to one slot and the
 * jog beside the source was as long as the riser. (SVG has no analogue: this
 * is the grid's own slot choice.)
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

const source = (dir: string): string =>
  allForkFixes
    .find((f) => f.id === 'ascii-feedback-edge-sibling-order')!
    .source.replace(/^graph TD/, `graph ${dir}`)

describe('back edge between ends ELK keeps apart (LR/RL)', () => {
  it.each(['LR', 'RL'])(
    '%s: every end is on ELK’s face and no bend side is lost',
    (d) => {
      const c = measureSample(source(d))
      expect(c.faceOk).toBe(c.faceEnds)
      expect(c.bends - c.bendOk).toBeLessThanOrEqual(1)
    },
  )

  it('LR: the dotted return runs below both nodes and rises beside Push Code', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const text = renderMermaidASCII(source('LR'), {
      colorMode: 'none',
      layoutHints: true,
    })
    expect(trimmed(text)).toEqual([
      '┌────────────────────────────────────────────────────────┐',
      '│                       CI Pipeline                      │',
      '│                                                        │',
      '│                                                        │',
      '│                                        ┌─────────────┐ │    ╭─────────────────╮',
      '│                                        │             │ │    (                 )',
      '│                                     ┌─►│ Build Image ├─┼───►(  Deploy Staging )──┐',
      '│                                     │  │             │ │    (                 )  │',
      '│                          ╱╲         │  └─────────────┘ │    ╰─────────────────╯  │         ╱╲               ╭────────╮',
      '│                        ╱    ╲      Yes                 │                         │       ╱    ╲             ╱        ╲',
      '│                     ╱          ╲────┘                  │                         └───►╱          ╲         ╱          ╲',
      '│                ┌─►< Tests Pass?  >                     │                            < QA Approved? >─Yes─►( Production )',
      '│                │    ╲          ╱────┐                  │                         ┌────╲          ╱         ╲          ╱',
      '│                │       ╲    ╱       │                  │                         │       ╲    ╱             ╲        ╱',
      '│ ┌───────────┐  │         ╲╱         │                  │                         │         ╲╱               ╰────────╯',
      '│ │           ├──┘                   No                  │                         │',
      '│ │ Push Code │                       │                  │                        No',
      '│ │           │◄┄┐                    │                  │                         │',
      '│ └───────────┘  ┆                    │  ┌─────────────┐ │                         │',
      '│                ┆                    └─►│             │ │                         │',
      '│                ┆                       │ Fix & Retry │◄┼─────────────────────────┘',
      '│                ┆                    ┌┄┄┤             │ │',
      '│                └┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘  └─────────────┘ │',
      '│                                                        │',
      '└────────────────────────────────────────────────────────┘',
    ])
  })

  it('RL: the dotted return runs below both nodes and rises beside Push Code', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const text = renderMermaidASCII(source('RL'), {
      colorMode: 'none',
      layoutHints: true,
    })
    expect(trimmed(text)).toEqual([
      '                                                                ┌────────────────────────────────────────────────────────┐',
      '                                                                │                      CI Pipeline                       │',
      '                                                                │                                                        │',
      '                                                                │                                                        │',
      '                                         ╭─────────────────╮    │ ┌─────────────┐                                        │',
      '                                         (                 )    │ │             │                                        │',
      '                                      ┌──(  Deploy Staging )◄───┼─┤ Build Image │◄─┐                                     │',
      '                                      │  (                 )    │ │             │  │                                     │',
      '  ╭────────╮               ╱╲         │  ╰─────────────────╯    │ └─────────────┘  │         ╱╲                          │',
      '  ╱        ╲             ╱    ╲       │                         │                 Yes      ╱    ╲                        │',
      ' ╱          ╲         ╱          ╲◄───┘                         │                  └────╱          ╲                     │',
      '( Production )◄─Yes─< QA Approved? >                            │                     < Tests Pass?  >◄─┐                │',
      ' ╲          ╱         ╲          ╱────┐                         │                  ┌────╲          ╱    │                │',
      '  ╲        ╱             ╲    ╱       │                         │                  │       ╲    ╱       │                │',
      '  ╰────────╯               ╲╱         │                         │                  │         ╲╱         │  ┌───────────┐ │',
      '                                      │                         │                  No                   └──┤           │ │',
      '                                      No                        │                  │                       │ Push Code │ │',
      '                                      │                         │                  │                    ┌┄►│           │ │',
      '                                      │                         │ ┌─────────────┐  │                    ┆  └───────────┘ │',
      '                                      │                         │ │             │◄─┘                    ┆                │',
      '                                      └─────────────────────────┼►│ Fix & Retry │                       ┆                │',
      '                                                                │ │             ├┄┄┐                    ┆                │',
      '                                                                │ └─────────────┘  └┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘                │',
      '                                                                │                                                        │',
      '                                                                └────────────────────────────────────────────────────────┘',
    ])
  })
})
