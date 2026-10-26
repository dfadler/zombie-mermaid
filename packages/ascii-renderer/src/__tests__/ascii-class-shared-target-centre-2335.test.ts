/**
 * Regression test for issue #2335: when two relationships share a class and
 * only one carries an arrowhead there, both lines converge on the box's centre
 * (as mermaid does) instead of fanning to its corner columns, so the head sits
 * directly against the border and every junction keeps its arms.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = `classDiagram
  class A
  class B
  class C
  class D
  A <|-- B
  C <|-- D
  A --> C
  B --> D`

describe('ASCII class diagram — shared ends merge at the centre (issue #2335)', () => {
  it('draws one trunk under A and one head above D, with joined junctions', () => {
    const rows = renderMermaidASCII(SRC)
      .split('\n')
      .map((r) => r.trimEnd())
    expect(rows.join('\n').trimEnd()).toBe(
      [
        '┌───┐',
        '│ A │',
        '└───┘',
        '  △',
        '  ├────────┐',
        '  │        ▼',
        '┌───┐    ┌───┐',
        '│ B │    │ C │',
        '└───┘    └───┘',
        '  │        △',
        '  └────┬───┘',
        '       ▼',
        '     ┌───┐',
        '     │ D │',
        '     └───┘',
      ].join('\n'),
    )
  })
})
