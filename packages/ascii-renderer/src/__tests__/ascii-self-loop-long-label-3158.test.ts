/**
 * #3158: a labelled self-loop on a box or decision in TD or BT, with a label of
 * four characters or more, drew the label on the hook's return leg and erased
 * the arrowhead into the node. The label now sits left of the hook's vertical
 * run, clear of every stroke, as mermaid@12.3.0 draws it (label to the left of
 * the loop, arrowhead intact).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  registerAsciiLayout,
  getAsciiLayout,
  renderMermaidASCII,
} from '@zombie-mermaid/ascii-renderer'
import { asciiLayoutProvider } from '../../../../src/ascii-layout-provider.ts'

const saved = getAsciiLayout()
beforeEach(() => registerAsciiLayout(asciiLayoutProvider))
afterEach(() => registerAsciiLayout(saved))

const lines = (src: string): string[] =>
  renderMermaidASCII(src)
    .split('\n')
    .map((l) => l.trimEnd())

describe('#3158 self-loop label sits left of the hook, strokes intact', () => {
  it('TD decision, label of four characters', () => {
    expect(lines('flowchart TD\n  n0{"call"}\n  n0 -->|A0aA| n0')).toEqual([
      '           ╱╲',
      '     ┌────╱  ╲',
      'A0aA │  < call >',
      '     └───►╲  ╱',
      '           ╲╱',
    ])
  })

  it('TD decision, label of three characters', () => {
    expect(lines('flowchart TD\n  n0{"call"}\n  n0 -->|A0a| n0')).toEqual([
      '          ╱╲',
      '    ┌────╱  ╲',
      'A0a │  < call >',
      '    └───►╲  ╱',
      '          ╲╱',
    ])
  })

  it('BT box with a second edge', () => {
    const out = lines(
      'flowchart BT\n  n0["Q30"]\n  n1("BD")\n  n0 -->|a0a0| n0\n  n0 --> n1',
    )
    expect(out.slice(-4)).toEqual([
      '     ┌─►│     │',
      'a0a0 │  │ Q30 │',
      '     └──┤     │',
      '        └─────┘',
    ])
    expect(out.join('\n').match(/[►▲]/g)).toHaveLength(2)
  })
})
