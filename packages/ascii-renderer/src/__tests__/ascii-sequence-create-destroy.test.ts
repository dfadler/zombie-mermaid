// ============================================================================
// ASCII sequence diagrams — `create participant` / `destroy` lifecycle (#419)
//
// A created participant's box sits on the row of the message that creates
// it (the arrow stops at the box's edge, the lifeline starts under it); a
// destroyed participant's footer box sits on the destroying arrow's row (the
// arrow stops at its edge) and the lifeline ends above it, as in Mermaid
// 12.3.0 (#2741). There is no cross.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const source = `sequenceDiagram
  A->>B: one
  create participant C
  A->>C: two
  destroy B
  A->>B: three`

describe('ASCII sequence diagrams – create/destroy', () => {
  it('renders the created box on its creating row and the destroyed footer box on the destroying arrow', () => {
    const result = renderMermaidASCII(source, { useAscii: false })
    expect(result).toBe(
      [
        ' ┌───┐      ┌───┐             ',
        ' │ A │      │ B │             ',
        ' └─┬─┘      └─┬─┘             ',
        '   │          │               ',
        '   │   one    │               ',
        '   │──────────▶               ',
        '   │          │               ',
        '   │   two    │       ┌───┐   ',
        '   │─────────────────▶│ C │   ',
        '   │          │       └─┬─┘   ',
        '   │          │         │     ',
        '   │ three  ┌─┴─┐       │     ',
        '   │───────▶│ B │       │     ',
        '   │        └───┘       │     ',
        '   │                    │     ',
        ' ┌─┴─┐                ┌─┴─┐   ',
        ' │ A │                │ C │   ',
        ' └───┘                └───┘   ',
      ].join('\n'),
    )
  })

  it('uses plain-ASCII corners in ASCII mode', () => {
    const result = renderMermaidASCII(source, { useAscii: true })
    expect(result).toBe(
      [
        ' +---+      +---+             ',
        ' | A |      | B |             ',
        ' +---+      +---+             ',
        '   |          |               ',
        '   |   one    |               ',
        '   |---------->               ',
        '   |          |               ',
        '   |   two    |       +---+   ',
        '   |----------------->| C |   ',
        '   |          |       +---+   ',
        '   |          |         |     ',
        '   | three  +---+       |     ',
        '   |------->| B |       |     ',
        '   |        +---+       |     ',
        '   |                    |     ',
        ' +---+                +---+   ',
        ' | A |                | C |   ',
        ' +---+                +---+   ',
      ].join('\n'),
    )
  })

  it('stops a right-to-left creating arrow at the right edge of the created box', () => {
    const result = renderMermaidASCII(
      `sequenceDiagram
      create participant C
      D->>C: hi`,
      { useAscii: false },
    )
    expect(result).toBe(
      [
        '               ┌───┐   ',
        '               │ D │   ',
        '               └─┬─┘   ',
        '                 │     ',
        ' ┌───┐   hi      │     ',
        ' │ C │◀──────────│     ',
        ' └─┬─┘           │     ',
        '   │             │     ',
        ' ┌─┴─┐         ┌─┴─┐   ',
        ' │ C │         │ D │   ',
        ' └───┘         └───┘   ',
      ].join('\n'),
    )
  })

  it('keeps the alias and stick figure of a created actor, and drops nothing into the text', () => {
    const result = renderMermaidASCII(
      `sequenceDiagram
      A->>B: x
      create actor D as Donald
      B->>D: hi`,
      { useAscii: false },
    )
    expect(result).toContain('Donald')
    expect(result).toContain('/|\\')
    expect(result).not.toContain('create')
    // Donald's box is not in the header row: the first line holds only A and B
    expect(result.split('\n')[1]).not.toContain('Donald')
  })
})

describe('ASCII sequence diagrams – creating message label (#2281)', () => {
  const lines = (src: string) =>
    renderMermaidASCII(src, { useAscii: false }).split('\n')

  it.each(['participant', 'actor'])(
    'puts the label of a message creating a %s on the row above its arrow',
    (kind) => {
      const out = lines(`sequenceDiagram
        A->>B: x
        create ${kind} C
        A->>C: Hi there
        B->>C: bye`)
      const label = out.findIndex((l) => l.includes('Hi there'))
      expect(out[label + 1]).toMatch(/▶/)
    },
  )

  it('does not pad the other headers to a created actor figure height', () => {
    const out = lines(`sequenceDiagram
      A->>B: x
      create actor D as Donald
      A->>D: Hi!`)
    // Header: top border, label, bottom border
    expect(out[2]).toContain('└')
    expect(out[1]).not.toContain('Donald')
  })

  it('keeps the full header box of an actor whose creating message is a self-message', () => {
    const out = lines(`sequenceDiagram
      participant A
      create actor C as Donald
      C->>C: self`)
    // Self-messages can't create their recipient, so Donald stays in the header.
    // so the label shows in the header as well as the footer.
    expect(out.filter((l) => l.includes('Donald'))).toHaveLength(2)
  })

  it("starts a destroyed sender's arrow at the right edge of its footer box (no cross)", () => {
    const result = renderMermaidASCII(
      'sequenceDiagram\n  A->>B: hi\n  destroy B\n  B->>A: bye',
      { useAscii: false },
    )
    expect(result).not.toContain('✕')
    const rows = result.split('\n')
    const arrow = rows.find((r) => r.includes('◀'))!
    expect(arrow).toMatch(/◀─+│ B │/)
    expect(rows.some((r) => r.includes('┌─┴─┐'))).toBe(true)
  })

  it("centres a destroying self-message's footer box on its row, no loop (mermaid 12.3.0)", () => {
    const result = renderMermaidASCII(
      'sequenceDiagram\n  A->>B: hi\n  destroy B\n  B->>B: bye',
      { useAscii: false },
    )
    expect(result).not.toContain('✕')
    expect(result).not.toMatch(/[◀├]/)
    const rows = result.split('\n')
    const label = rows.findIndex((r) => r.includes('bye'))
    const mid = rows.findIndex((r, i) => i > label && /│ B │/.test(r))
    // Label row, box top (┴ joins the lifeline), box middle row
    expect(rows[label + 1]).toContain('┌─┴─┐')
    expect(mid).toBe(label + 2)
  })

  it('draws a destroyed actor footer as a stick figure', () => {
    const result = renderMermaidASCII(
      'sequenceDiagram\n  actor A\n  actor B\n  A->>B: hi\n  destroy B\n  B-->>A: bye',
      { useAscii: false },
    )
    expect(result.match(/ O /g)).toHaveLength(4)
  })
})
