/**
 * Regression test for a border-corruption bug introduced while migrating
 * `drawSubgraphLabel` (src/ascii/draw-subgraphs.ts) to the shared
 * `write()` primitive (src/ascii/canvas.ts).
 *
 * The deleted guard here was `labelX + j < width && labelY < height`.
 * `mkCanvas(width, height)` is inclusive (valid indices `0..width` /
 * `0..height`), so that guard deliberately clipped *before* the border
 * column/row. `write()`'s own clip is `x > maxX` / `y > maxY` with
 * `maxX === width` / `maxY === height` — correct for `drawSubgraphBox`'s
 * border-drawing calls (which legitimately write the border itself at
 * `x === width` / `y === height`), but too permissive for the label: it
 * allowed writing exactly on the border, so any subgraph title wider than
 * its interior, or taller than its box, silently overwrote its own frame.
 *
 * The fix keeps the original, tighter exclusive bound at this call site
 * specifically rather than changing `write()`'s bounds (every other
 * migrated call site relies on `write()`'s inclusive bounds).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII subgraph label does not overwrite its own border', () => {
  it('leaves the right border intact when the title is wider than the interior', () => {
    const mermaid = `flowchart TD
  subgraph ONE["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"]
    A1["a"] --> A2["b"]
  end`
    const output = renderMermaidASCII(mermaid)
    const titleLine = output.split('\n').find((l) => l.includes('AAAAAAA'))
    expect(titleLine).toBeDefined()

    // The title is truncated by the box's fixed width, but the row must
    // still open and close with the border — never spill onto/through it.
    expect(titleLine).toBe('│AAAAAAA│')
    expect(titleLine?.startsWith('│')).toBe(true)
    expect(titleLine?.endsWith('│')).toBe(true)
  })

  it('leaves the bottom border intact when the title has more lines than the box has rows', () => {
    const labelLines = Array.from({ length: 15 }, (_, i) =>
      String.fromCharCode(65 + i),
    ).join('<br/>')
    const mermaid = `flowchart TD
  subgraph ONE["${labelLines}"]
    A1["a"]
  end`
    const output = renderMermaidASCII(mermaid)
    const rows = output.split('\n')
    const bottomBorder = rows[rows.length - 1]!

    // The bottom border row must be all border characters — no label
    // character should have punched through it.
    expect(bottomBorder).toBe('└───────┘')
  })

  it('matches known-good output captured from a real renderMermaidASCII run (locks in the exact fix)', () => {
    const mermaid = `flowchart TD
  subgraph ONE["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"]
    A1["a"] --> A2["b"]
  end`
    const output = renderMermaidASCII(mermaid)
    expect(output).toBe(
      [
        '┌───────┐',
        '│AAAAAAA│',
        '│       │',
        '│       │',
        '│ ┌───┐ │',
        '│ │   │ │',
        '│ │ a │ │',
        '│ │   │ │',
        '│ └─┬─┘ │',
        '│   │   │',
        '│   │   │',
        '│   │   │',
        '│   │   │',
        '│   ▼   │',
        '│ ┌───┐ │',
        '│ │   │ │',
        '│ │ b │ │',
        '│ │   │ │',
        '│ └───┘ │',
        '│       │',
        '└───────┘',
      ].join('\n'),
    )
  })
})
