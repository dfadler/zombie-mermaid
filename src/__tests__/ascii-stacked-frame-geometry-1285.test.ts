/**
 * Regression tests for #1285 — uneven subgraph frame geometry in a stacked
 * layout. Two of its three complaints are fixed:
 *
 * - a back edge running beside a frame keeps a clear column from the wall
 *   (it used to sit directly against it: `││`, then cross it with `┼┘`);
 * - a title widened for an entering stroke keeps a clear column before the
 *   right wall (`Layer Three │`, not `Layer Three│`).
 *
 * The third (frames not left-aligned) is deliberate: real mermaid centres
 * frames, so it is left alone.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SOURCE = `graph TD
subgraph L1[Layer One]
  A
end
subgraph L2[Layer Two]
  C
end
subgraph L3[Layer Three]
  E
end
A --> C
C --> E
E --> A`

describe('ASCII: stacked frames keep clear columns beside walls and titles (#1285)', () => {
  const lines = renderMermaidASCII(SOURCE).split('\n')

  it('never draws the back edge directly against a frame wall', () => {
    expect(lines.some((l) => l.includes('││'))).toBe(false)
  })

  it('keeps a clear column when the edge runs left of a frame it passes', () => {
    const out = renderMermaidASCII(`graph TD
subgraph S1[One]
 a
end
subgraph S2[Two]
 b
end
subgraph S3[Three]
 c
end
a --> b
b --> c
a --> x
a --> c`)
    const trimmed = out
      .split('\n')
      .map((l) => l.trimEnd())
      .join('\n')
    expect(trimmed).toBe(
      [
        '┌───────┐',
        '│  One  │',
        '│       │',
        '│       │',
        '│ ┌───┐ │',
        '│ │   │ │',
        '│ │ a ├─┼───────────┬───────────┐',
        '│ │   │ │           │           │',
        '│ └─┬─┘ │           │           │',
        '│   │   │           │           │',
        '└───┼───┘           │           │',
        '    │               │           │',
        '    │               │           │',
        '    │       ┌───────┼─────┐     │',
        '┌───┼─────┐ │       │     │ ┌───┼───────┐',
        '│   │ Two │ │       │     │ │   │ Three │',
        '│   │     │ │       │     │ │   │       │',
        '│   ▼     │ │       ▼     │ │   ▼       │',
        '│ ┌───┐   │ │     ┌───┐   │ │ ┌───┐     │',
        '│ │   │   │ │     │   │   │ │ │   │     │',
        '│ │ b ├───┼─┘     │ x │   └─┼►│ c │     │',
        '│ │   │   │       │   │     │ │   │     │',
        '│ └───┘   │       └───┘     │ └───┘     │',
        '│         │                 │           │',
        '└─────────┘                 └───────────┘',
      ].join('\n'),
    )
  })

  it('keeps a clear column between a widened title and the right wall', () => {
    for (const title of ['Layer Two', 'Layer Three']) {
      const line = lines.find((l) => l.includes(title))!
      expect(line).toMatch(new RegExp(`${title} +│`))
    }
  })
})
