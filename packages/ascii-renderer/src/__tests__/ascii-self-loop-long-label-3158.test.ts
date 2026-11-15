/**
 * #3158: a labelled self-loop on a box or decision in TD or BT, with a label of
 * four characters or more, drew the label on the hook's last leg and erased the
 * arrowhead into the node. The label now goes on the first leg, as a shorter
 * one already did. mermaid@12.3.0 draws the hook with its arrowhead and the
 * label.
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

describe('#3158 long label on a self-loop keeps its arrowhead', () => {
  it('TD decision', () => {
    const out = renderMermaidASCII(
      'flowchart TD\n  n0{"call"}\n  n0 -->|A0aA| n0',
    )
    expect(out).toContain('A0aA')
    expect(out).toContain('►')
  })

  it('BT box with a second edge', () => {
    const out = renderMermaidASCII(
      'flowchart BT\n  n0["Q30"]\n  n1("BD")\n  n0 -->|a0a0| n0\n  n0 --> n1',
    )
    expect(out).toContain('a0a0')
    expect(out.match(/[►▲]/g)).toHaveLength(2)
  })
})
