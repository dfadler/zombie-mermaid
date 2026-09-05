// ============================================================================
// ASCII sequence diagrams — `box ... end` participant grouping (#419)
//
// A non-empty box becomes a labelled bracket around its members' header
// boxes, and an unlabelled bracket around their footer boxes, spanning from
// the leftmost to the rightmost member. Colour is not representable in
// ASCII and is ignored (only the label, if any, is drawn).
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII sequence diagrams – box...end', () => {
  const source = `sequenceDiagram
  box Aqua Group 1
  participant A
  participant B
  end
  participant C
  A->>B: hello
  B->>C: world`

  it('draws a labelled bracket around the grouped participants (Unicode)', () => {
    const result = renderMermaidASCII(source, { useAscii: false })
    expect(result).toBe(
      [
        ' ┌─ Group 1 ────────┐            ',
        ' │ ┌───┐      ┌───┐ │    ┌───┐   ',
        ' │ │ A │      │ B │ │    │ C │   ',
        ' │ └─┬─┘      └─┬─┘ │    └─┬─┘   ',
        ' └───┼──────────┼───┘      │     ',
        '     │          │          │     ',
        '     │  hello   │          │     ',
        '     │──────────▶          │     ',
        '     │          │          │     ',
        '     │          │  world   │     ',
        '     │          │──────────▶     ',
        '     │          │          │     ',
        ' ┌───┼──────────┼───┐      │     ',
        ' │ ┌─┴─┐      ┌─┴─┐ │    ┌─┴─┐   ',
        ' │ │ A │      │ B │ │    │ C │   ',
        ' │ └───┘      └───┘ │    └───┘   ',
        ' └──────────────────┘            ',
      ].join('\n'),
    )
  })

  it('uses the plain-ASCII cross and corners in ASCII mode', () => {
    const result = renderMermaidASCII(source, { useAscii: true })
    expect(result).toBe(
      [
        ' +- Group 1 --------+            ',
        ' | +---+      +---+ |    +---+   ',
        ' | | A |      | B | |    | C |   ',
        ' | +---+      +---+ |    +---+   ',
        ' +---+----------+---+      |     ',
        '     |          |          |     ',
        '     |  hello   |          |     ',
        '     |---------->          |     ',
        '     |          |          |     ',
        '     |          |  world   |     ',
        '     |          |---------->     ',
        '     |          |          |     ',
        ' +---+----------+---+      |     ',
        ' | +---+      +---+ |    +---+   ',
        ' | | A |      | B | |    | C |   ',
        ' | +---+      +---+ |    +---+   ',
        ' +------------------+            ',
      ].join('\n'),
    )
  })

  it('draws an unlabelled bracket for a box with a colour but no label', () => {
    const result = renderMermaidASCII(
      `sequenceDiagram
  box Aqua
  participant A
  participant B
  end
  A->>B: hi`,
      { useAscii: false },
    )
    expect(result).toBe(
      [
        ' ┌─────────────────┐  ',
        ' │ ┌───┐     ┌───┐ │  ',
        ' │ │ A │     │ B │ │  ',
        ' │ └─┬─┘     └─┬─┘ │  ',
        ' └───┼─────────┼───┘  ',
        '     │         │      ',
        '     │   hi    │      ',
        '     │─────────▶      ',
        '     │         │      ',
        ' ┌───┼─────────┼───┐  ',
        ' │ ┌─┴─┐     ┌─┴─┐ │  ',
        ' │ │ A │     │ B │ │  ',
        ' │ └───┘     └───┘ │  ',
        ' └─────────────────┘  ',
      ].join('\n'),
    )
  })

  it('lets a loop opened inside a box nest cleanly inside the bracket', () => {
    const result = renderMermaidASCII(
      `sequenceDiagram
  box G1
  participant A
  participant B
  loop every day
  A->>B: hi
  end
  end
  A->>B: bye`,
      { useAscii: false },
    )
    expect(result).toBe(
      [
        ' ┌─ G1 ────────────┐  ',
        ' │ ┌───┐     ┌───┐ │  ',
        ' │ │ A │     │ B │ │  ',
        ' │ └─┬─┘     └─┬─┘ │  ',
        ' └───┼─────────┼───┘  ',
        '     │         │      ',
        ' ┌loop [every day]─┐  ',
        ' │   │         │   │  ',
        ' │   │   hi    │   │  ',
        ' │   │─────────▶   │  ',
        ' │   │         │   │  ',
        ' └─────────────────┘  ',
        '     │         │      ',
        '     │   bye   │      ',
        '     │─────────▶      ',
        '     │         │      ',
        ' ┌───┼─────────┼───┐  ',
        ' │ ┌─┴─┐     ┌─┴─┐ │  ',
        ' │ │ A │     │ B │ │  ',
        ' │ └───┘     └───┘ │  ',
        ' └─────────────────┘  ',
      ].join('\n'),
    )
  })

  it('does not draw a bracket for a box with no members', () => {
    const withEmptyBox = renderMermaidASCII(
      `sequenceDiagram
  box Empty
  end
  A->>B: hi`,
      { useAscii: false },
    )
    const withoutBox = renderMermaidASCII(
      `sequenceDiagram
  A->>B: hi`,
      { useAscii: false },
    )
    expect(withEmptyBox).not.toContain('Empty')
    expect(withEmptyBox).toBe(withoutBox)
  })
})
