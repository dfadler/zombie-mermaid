/**
 * Review follow-ups to the title-widening work in #1248 / #1254 (PR #1278):
 *
 * - A frame widened so its title clears an entering edge stroke must not grow
 *   past what that needs. Trial widths used to leave an avoiding back edge
 *   inside the growing frame, which read as a second stroke and over-widened
 *   it ("Layer Two" came out 24 columns wide for a 9-column title).
 * - A title beside a stroke keeps one clear column between them. Abutting
 *   (`│Two│`) reads as a narrow box rather than a title.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const LAYERS = `graph TD
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

const MUTUAL_PAIR = `graph TD
subgraph One
  A
end
subgraph Two
  B
end
A -->|x| B
B -->|y| A`

function row(output: string, title: string): string {
  const line = output.split('\n').find((l) => l.includes(title))
  expect(line, `no row with "${title}"`).toBeDefined()
  return line!
}

/** The frame's own span on its title row: from the stroke/wall before the title to the wall after. */
function frameSpan(line: string, title: string): string {
  const at = line.indexOf(title)
  const left = line.slice(0, at).search(/│[^│]*$/)
  // First wall at or past the end of the title that is not the title's own cell.
  const right = line.indexOf('│', at + title.length)
  expect(right, `no right wall after "${title}"`).toBeGreaterThan(-1)
  return line.slice(left, right + 1)
}

describe('title room beside an entering stroke (#1278)', () => {
  const out = renderMermaidASCII(LAYERS)

  it.each(['Layer Two', 'Layer Three'])(
    'keeps a clear column between the stroke and "%s"',
    (title) => {
      const line = row(out, title)
      // A stroke, one blank cell, then the title: never stroke-then-title.
      const before = line.slice(0, line.indexOf(title))
      expect(before).toMatch(/[│┼] $/)
    },
  )

  it('does not widen a frame past what its title needs', () => {
    // Stroke at local column 4/5, one clear column, then the whole title and
    // the right wall: title + 8 and title + 9 columns. The over-widened frames
    // were 25 and 26.
    expect(
      frameSpan(row(out, 'Layer Two'), 'Layer Two').length,
    ).toBeLessThanOrEqual('Layer Two'.length + 8)
    expect(
      frameSpan(row(out, 'Layer Three'), 'Layer Three').length,
    ).toBeLessThanOrEqual('Layer Three'.length + 9)
  })

  it('leaves no run of blank cells after the title beyond one column', () => {
    for (const title of ['Layer Two', 'Layer Three']) {
      const line = row(out, title)
      const after = line.slice(line.indexOf(title) + title.length)
      expect(after, title).toMatch(/^ {0,1}│/)
    }
  })
})

describe('title beside a stroke in a labelled mutual pair (#1278)', () => {
  const out = renderMermaidASCII(MUTUAL_PAIR)

  it('keeps "Two" whole with a clear column after the stroke', () => {
    const line = row(out, 'Two')
    expect(line).toMatch(/[│┼] Two/)
    expect(line).not.toMatch(/[│┼]Two/)
  })

  it('still draws both edge labels', () => {
    expect(out).toContain('x')
    expect(out).toContain('y')
  })
})
