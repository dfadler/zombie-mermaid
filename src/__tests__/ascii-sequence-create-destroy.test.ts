// ============================================================================
// ASCII sequence diagrams — `create participant` / `destroy` lifecycle (#419)
//
// A created participant's box sits on the row of the message that creates
// it (the arrow stops at the box's edge, the lifeline starts under it); a
// destroyed participant's lifeline ends with a cross on the row under the
// destroying arrow, and it gets no footer box.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

const source = `sequenceDiagram
  A->>B: one
  create participant C
  A->>C: two
  destroy B
  A->>B: three`

describe('ASCII sequence diagrams – create/destroy', () => {
  it('renders the created box on its creating row and the destroy cross under the destroying arrow', () => {
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
        '   │        two               ',
        '   │          │       ┌───┐   ',
        '   │─────────────────▶│ C │   ',
        '   │          │       └─┬─┘   ',
        '   │          │         │     ',
        '   │  three   │         │     ',
        '   │──────────▶         │     ',
        '   │          ✕         │     ',
        '   │                    │     ',
        ' ┌─┴─┐                ┌─┴─┐   ',
        ' │ A │                │ C │   ',
        ' └───┘                └───┘   ',
      ].join('\n'),
    )
  })

  it('uses the plain-ASCII cross and corners in ASCII mode', () => {
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
        '   |        two               ',
        '   |          |       +---+   ',
        '   |----------------->| C |   ',
        '   |          |       +---+   ',
        '   |          |         |     ',
        '   |  three   |         |     ',
        '   |---------->         |     ',
        '   |          x         |     ',
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
        '           ┌───┐   ',
        '           │ D │   ',
        '           └─┬─┘   ',
        '             │     ',
        '       hi    │     ',
        ' ┌───┐       │     ',
        ' │ C │◀──────│     ',
        ' └─┬─┘       │     ',
        '   │         │     ',
        ' ┌─┴─┐     ┌─┴─┐   ',
        ' │ C │     │ D │   ',
        ' └───┘     └───┘   ',
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
