/**
 * A node that fans out to children is centred over them (as dagre does)
 * instead of hanging over the first child, so its edges leave from the
 * middle rather than sideways-and-back.
 *
 * Covers `centerParentsOverChildren` in grid.ts: odd and even child counts
 * (even counts either straddle the padding column or open a slot, depending
 * on whether the labels fit), chains following their moved child, and each
 * condition under which the node must stay where it was.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string): string[] =>
  renderMermaidASCII(src, { colorMode: 'none' })
    .split('\n')
    .map((l) => l.trimEnd())

/** Column of the middle of `label` on the row that carries it. */
function centerOf(lines: string[], label: string): number {
  const row = lines.find((l) => l.includes(label))
  if (row === undefined) throw new Error(`no row contains ${label}`)
  return row.indexOf(label) + (label.length - 1) / 2
}

/** Column of the left border of the box whose label is `label`. */
function boxLeftOf(lines: string[], label: string): number {
  const row = lines.find((l) => l.includes(label))
  if (row === undefined) throw new Error(`no row contains ${label}`)
  return row.lastIndexOf('│', row.indexOf(label))
}

describe('centering a node over its children', () => {
  it('centres over the middle child of an odd fan-out', () => {
    const out = render(`flowchart TB
  Src[Source] --> L[Left]
  Src --> C[Center]
  Src --> R[Right]`)
    expect(
      Math.abs(centerOf(out, 'Source') - centerOf(out, 'Center')),
    ).toBeLessThan(1.5)
    // The middle edge drops straight from the bottom border.
    expect(out.join('\n')).toContain('┼')
  })

  it('straddles the padding column between two children when no label needs the room', () => {
    expect(
      render(`graph TD
  A --> B
  A --> C`),
    ).toEqual([
      '      ┌─────┐',
      '      │     │',
      '      │  A  │',
      '      │     │',
      '      └─────┘',
      '         │',
      '         │',
      '   ┌─────┴────┐',
      '   │          │',
      '   ▼          ▼',
      '┌─────┐     ┌───┐',
      '│     │     │   │',
      '│  B  │     │ C │',
      '│     │     │   │',
      '└─────┘     └───┘',
    ])
  })

  it('opens a slot instead when a label would not fit the straddled run', () => {
    // `approve` is wider than half of Done's box, so straddling would put it
    // on the box; the parent is centred over a wider gap instead.
    const out = render(`graph TD
  A[Start] -->|validate| B[Check]
  B -->|approve| C[Done]
  B -->|reject| D[Fail]`)
    const row = out.find((l) => l.includes('approve'))!
    expect(row).toMatch(/┌─+approve─+┤/)
    // The chain follows: Start sits over Check.
    expect(
      Math.abs(centerOf(out, 'Start') - centerOf(out, 'Check')),
    ).toBeLessThan(1.5)
    const childMidpoint = (centerOf(out, 'Done') + centerOf(out, 'Fail')) / 2
    expect(Math.abs(centerOf(out, 'Check') - childMidpoint)).toBeLessThan(1.5)
  })

  it('still straddles when the labels are short enough to fit', () => {
    const out = render(`graph TD
  A -->|go| B[Wide Child One]
  A -->|no| C[Wide Child Two]`)
    const childMidpoint =
      (centerOf(out, 'Wide Child One') + centerOf(out, 'Wide Child Two')) / 2
    expect(Math.abs(centerOf(out, 'A') - childMidpoint)).toBeLessThan(1.5)
    // Both labels are drawn whole, none glued to a box border or stroke.
    const text = out.join('\n')
    expect(text).toMatch(/[^\w│┤├]go[^\w│┤├]|go$/m)
    expect(text).not.toMatch(/[│┤├]go|go[│┤├]|[│┤├]no|no[│┤├]/)
    expect(text).toContain('no')
  })

  it('opens a slot over a diamond whose branches rejoin', () => {
    const out = render(`graph TD
  A -->|first long label| B
  A -->|second long label| C
  B --> E
  C --> E`)
    const childMidpoint = (centerOf(out, 'B') + centerOf(out, 'C')) / 2
    // E now sits centered between B and C (#1339) in the column the opened
    // slot straddles, and its box widens that column on one side, so A lands
    // a little further off than the plain two-child case.
    expect(Math.abs(centerOf(out, 'A') - childMidpoint)).toBeLessThan(3.5)
  })

  it('leaves the node where it is when a neighbour already occupies the slot', () => {
    // D sits right where A would have to go to straddle B and C.
    const out = render(`graph TD
  A --> B
  A --> C
  D --> E`)
    expect(boxLeftOf(out, 'A')).toBe(boxLeftOf(out, 'B'))
  })

  it('moves the other half of a fan-in apart so the node stays centred under both', () => {
    const out = render(`graph TD
  Input --> Processor
  Config --> Processor
  Processor -->|first path| Output
  Processor -->|second path| Log`)
    const parents = (centerOf(out, 'Input') + centerOf(out, 'Config')) / 2
    const children = (centerOf(out, 'Output') + centerOf(out, 'Log')) / 2
    expect(Math.abs(centerOf(out, 'Processor') - parents)).toBeLessThan(1.5)
    expect(Math.abs(centerOf(out, 'Processor') - children)).toBeLessThan(1.5)
  })

  describe('leaves the node over its first child when', () => {
    it('an edge points back up the graph', () => {
      const out = render(`graph TD
  A --> B
  A --> C
  C --> A`)
      expect(boxLeftOf(out, 'A')).toBe(boxLeftOf(out, 'B'))
    })

    it('a child has another parent', () => {
      // D is shared, so neither parent is pulled towards it: Y would
      // otherwise slide right over D.
      const out = render(`graph TD
  A --> B
  A --> C
  A --> D
  Y --> D`)
      expect(boxLeftOf(out, 'A')).toBe(boxLeftOf(out, 'B'))
      expect(boxLeftOf(out, 'Y')).toBe(boxLeftOf(out, 'C'))
    })

    it('the node and its children are inside a subgraph', () => {
      const out = render(`graph TD
  subgraph S
    A --> B
    A --> C
  end`)
      expect(boxLeftOf(out, 'A')).toBe(boxLeftOf(out, 'B'))
    })

    it('only the node is inside a subgraph', () => {
      const out = render(`graph TD
  subgraph S
    A
  end
  A --> B
  A --> C
  A --> D`)
      expect(boxLeftOf(out, 'A')).toBe(boxLeftOf(out, 'B'))
    })

    it('only the children are inside a subgraph', () => {
      const out = render(`graph TD
  A --> B
  A --> C
  A --> D
  subgraph S
    B
    C
    D
  end`)
      expect(boxLeftOf(out, 'A')).toBe(boxLeftOf(out, 'B'))
    })

    it('opening a slot would drag an unrelated branch wider', () => {
      const out = render(`graph TD
  A -->|a long label| B
  A -->|another long| C
  X --> Y --> Z`)
      expect(boxLeftOf(out, 'A')).toBe(boxLeftOf(out, 'B'))
    })

    it('the graph flows left to right', () => {
      const out = render(`graph LR
  A --> B
  A --> C`)
      expect(boxLeftOf(out, 'A')).toBe(0)
    })
  })
})
