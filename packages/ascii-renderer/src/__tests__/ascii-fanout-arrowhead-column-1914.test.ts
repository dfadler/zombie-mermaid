/**
 * A fan-out arrowhead must sit in its stem's column (issue #1914).
 *
 * A target box an even number of cells wide has a half-column centre; the
 * bundled-edge arrowhead used the box's own `floor(width / 2)` while the
 * routed stem used the middle grid column's centre, so one head landed a
 * column right of its stem. Geometry invariant: the cell directly above
 * every TD `▼` is a vertical stroke.
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '../index.ts'

const VERTICAL = new Set('│┬┼┴├┤┆┊')

function floatingHeads(text: string): string[] {
  const lines = text.split('\n')
  const bad: string[] = []
  lines.forEach((line, y) => {
    for (const [x, ch] of [...line].entries()) {
      if (ch !== '▼') continue
      const above = [...(lines[y - 1] ?? '')][x] ?? ' '
      if (!VERTICAL.has(above)) bad.push(`(${x},${y}) above=${above}`)
    }
  })
  return bad
}

describe('fan-out arrowhead column (#1914)', () => {
  it('the #1914 repro keeps every head under its stem', () => {
    const out = renderMermaidASCII(
      `flowchart TD
    A --> B
    A -->|no| C
    C --> D
    D --> E
    D --> F
    F --> G
    G --> H
    G --> I`,
      { colorMode: 'none' },
    )
    expect(floatingHeads(out)).toEqual([])
  })

  it.each(['H', 'Hh', 'Hhh', 'Hhhh', 'Hhhhh', 'Hhhhhh', 'Hhhhhhh'])(
    'fan-out to a %s-labelled box (any width parity)',
    (label) => {
      const out = renderMermaidASCII(
        `flowchart TD
    G --> H[${label}]
    G --> I[I]`,
        { colorMode: 'none' },
      )
      expect(floatingHeads(out)).toEqual([])
    },
  )
})
