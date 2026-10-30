// Issue #2335: with two lines arriving at one narrow class box, the
// arrowhead used to sit on a corner glyph of the box's top border. Each line
// now lands on its own interior border cell and the lines no longer cross
// above the box (mermaid keeps them uncrossed too).
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '../index.ts'

const TWO_PARENTS = `classDiagram
  A <|-- B
  C <|-- D
  A --> C
  B --> D`

const ONE_NAMESPACE = `classDiagram
  namespace One {
    class A
    class B
    class D
  }
  A <|-- D
  B --> D`

const render = (src: string, useAscii: boolean): string =>
  renderMermaidASCII(src, { useAscii, colorMode: 'none' })
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trimEnd()

describe('ASCII class diagram: two incoming lines on one box (#2335)', () => {
  it('Unicode: two parents, arrowhead off the corner, no crossing', () => {
    expect(render(TWO_PARENTS, false)).toBe(
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

  it('ASCII: two parents, arrowhead off the corner, no crossing', () => {
    expect(render(TWO_PARENTS, true)).toBe(
      [
        '+---+',
        '| A |',
        '+---+',
        '  ^',
        '  ----------',
        '  |        v',
        '+---+    +---+',
        '| B |    | C |',
        '+---+    +---+',
        '  |        ^',
        '  ----------',
        '       v',
        '     +---+',
        '     | D |',
        '     +---+',
      ].join('\n'),
    )
  })

  it('Unicode: a labelled line keeps its arrowhead off the corner', () => {
    expect(render(`${TWO_PARENTS} : uses`, false)).toBe(
      [
        '┌───┐',
        '│ A │',
        '└───┘',
        '  △',
        '  └┬────────┐',
        '   │        ▼',
        ' ┌───┐    ┌───┐',
        ' │ B │    │ C │',
        ' └───┘    └───┘',
        '   │        △',
        '   │        │',
        '  uses      │',
        '     │      │',
        '     └─▼  ┌─┘',
        '      ┌───┐',
        '      │ D │',
        '      └───┘',
      ].join('\n'),
    )
  })

  it('Unicode: two parents in one namespace', () => {
    expect(render(ONE_NAMESPACE, false)).toBe(
      [
        '┌─ One ──────────────┐',
        '│                    │',
        '│ ┌───┐        ┌───┐ │',
        '│ │ A │        │ B │ │',
        '│ └───┘        └───┘ │',
        '│   △            │   │',
        '│   │            │   │',
        '│   └──────┬─────┘   │',
        '│          │         │',
        '│          │         │',
        '│          ▼         │',
        '│        ┌───┐       │',
        '│        │ D │       │',
        '│        └───┘       │',
        '│                    │',
        '└────────────────────┘',
      ].join('\n'),
    )
  })

  it('ASCII: two parents in one namespace', () => {
    expect(render(ONE_NAMESPACE, true)).toBe(
      [
        '+- One --------------+',
        '|                    |',
        '| +---+        +---+ |',
        '| | A |        | B | |',
        '| +---+        +---+ |',
        '|   ^            |   |',
        '|   |            |   |',
        '|   --------------   |',
        '|          |         |',
        '|          |         |',
        '|          v         |',
        '|        +---+       |',
        '|        | D |       |',
        '|        +---+       |',
        '|                    |',
        '+--------------------+',
      ].join('\n'),
    )
  })
})
