// ============================================================================
// ASCII ER: a self-relationship is drawn as a loop on the entity's left side
// with its label further left, like mermaid (issue #2284). It was dropped.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = `erDiagram
  EMPLOYEE ||--o{ EMPLOYEE : manages`

describe('ASCII ER self-relationship (issue #2284)', () => {
  const draw = (opts?: { useAscii: boolean }) =>
    renderMermaidASCII(SRC, opts)
      .trimEnd()
      .split('\n')
      .map((l) => l.trimEnd())
      .join('\n')

  it('draws the loop, both markers and the label (unicode)', () => {
    expect(draw()).toBe(
      [
        '             ┌──────────┐',
        ' manages ┌─│ │ EMPLOYEE │',
        '         └─○╟│          │',
        '             └──────────┘',
      ].join('\n'),
    )
  })

  it('draws the loop, both markers and the label (ASCII only)', () => {
    expect(draw({ useAscii: true })).toBe(
      [
        '             +----------+',
        ' manages +-| | EMPLOYEE |',
        '         +-o<|          |',
        '             +----------+',
      ].join('\n'),
    )
  })

  it('keeps a self loop clear of its left neighbour and its label intact', () => {
    const out = renderMermaidASCII(
      'erDiagram\n  A ||--o{ B : owns\n  B |o--o| B : reports to',
    )
    expect(out).toContain('reports to')
    expect(out).toContain('owns')
  })

  it('draws two loops on one entity', () => {
    const out = renderMermaidASCII(
      `${SRC}\n  EMPLOYEE ||--|| EMPLOYEE : mentors`,
    )
    expect(out).toContain('manages')
    expect(out).toContain('mentors')
  })
})
