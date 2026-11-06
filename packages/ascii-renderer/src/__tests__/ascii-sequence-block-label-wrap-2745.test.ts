// Long block tab and divider labels wrap onto extra rows instead of widening
// the participant gap (#2745, mermaid 12.3.0).
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = `sequenceDiagram
  participant A
  participant B
  par a branch with a long descriptive title
    A->>B: x
  and another branch with an equally long title
    B->>A: y
  end`

const lifelineGap = (out: string): number => {
  const header = out.split('\n')[1]!
  return header.lastIndexOf('│') - header.indexOf('│') - 4
}

describe('sequence block label wrapping (#2745)', () => {
  it('keeps the default participant gap and wraps tab and divider labels as mermaid 12.3.0', () => {
    const out = renderMermaidASCII(SRC, { useAscii: false })
    const plain = renderMermaidASCII(
      'sequenceDiagram\n participant A\n participant B\n A->>B: x',
      { useAscii: false },
    )
    expect(lifelineGap(out)).toBe(lifelineGap(plain))
    expect(out).toContain('[a branch with a long')
    expect(out).toContain('descriptive title]')
    expect(out).toContain('[another branch with')
    expect(out).toContain('an equally long title]')
  })

  it('wraps a divider label onto several rows inside the frame', () => {
    const out = renderMermaidASCII(
      `sequenceDiagram
  participant A
  participant B
  alt ok
    A->>B: x
  else the first part of a very long divider label and a second part of it and more
    A->>B: y
  end`,
      { useAscii: true },
    )
    const rows = out.split('\n')
    const div = rows.findIndex((r) => r.includes('[the first'))
    // The label continues on the rows below the divider, not past the wall.
    expect(rows[div + 1]).toContain('divider')
    expect(rows[div + 1]!.trimEnd().endsWith('|')).toBe(true)
    expect(out).toContain('more]')
  })

  it('does not wrap a label that fits the lifeline span', () => {
    const out = renderMermaidASCII(
      'sequenceDiagram\n participant A\n participant B\n loop every day\n A->>B: x\n end',
      { useAscii: false },
    )
    expect(out).toContain('[every day]')
  })
})
