// `sequence.actorMargin` / `width` move the ASCII lifeline gap (#2783), measured
// against mermaid@12.3.0 (centres sit `width + actorMargin` px apart).
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const gap = (init: string) => {
  const rows = renderMermaidASCII(`${init}sequenceDiagram\n A->>B: x`).split(
    '\n',
  )
  const arrow = rows.find((r) => r.includes('x'))!
  return arrow.length
}

describe('sequence init spacing in ASCII (#2783)', () => {
  const base = gap('')
  it('actorMargin widens and narrows the gap, 20px a column', () => {
    expect(gap('%%{init: {"sequence": {"actorMargin": 150}}}%%\n')).toBe(
      base + 5,
    )
    expect(gap('%%{init: {"sequence": {"actorMargin": 10}}}%%\n')).toBeLessThan(
      base,
    )
  })
  it('width counts too; defaults change nothing', () => {
    expect(gap('%%{init: {"sequence": {"width": 250}}}%%\n')).toBe(base + 5)
    expect(
      gap('%%{init: {"sequence": {"width": 150, "actorMargin": 50}}}%%\n'),
    ).toBe(base)
  })
})
