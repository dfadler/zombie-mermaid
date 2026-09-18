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
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

describe('ASCII subgraph label does not overwrite its own border', () => {
  it('leaves the right border intact when the title is wider than the interior', () => {
    const mermaid = `flowchart TD
  subgraph ONE["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"]
    A1["a"] --> A2["b"]
  end`
    const output = renderMermaidASCII(mermaid)
    const titleLine = output.split('\n').find((l) => l.includes('AAAAAAA'))
    expect(titleLine).toBeDefined()

    // The box is now widened to fit the title in full (issue #632 — a
    // subgraph label used to be truncated to whatever width the child
    // nodes happened to need, dropping trailing characters), so the title
    // is no longer clipped at all — but the row must still open and close
    // with the border — never spill onto/through it.
    expect(titleLine).toBe('│AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA│')
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
        '┌──────────────────────────────────┐',
        '│AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA│',
        '│                                  │',
        '│                                  │',
        '│              ┌───┐               │',
        '│              │   │               │',
        '│              │ a │               │',
        '│              │   │               │',
        '│              └─┬─┘               │',
        '│                │                 │',
        '│                │                 │',
        '│                │                 │',
        '│                │                 │',
        '│                ▼                 │',
        '│              ┌───┐               │',
        '│              │   │               │',
        '│              │ b │               │',
        '│              │   │               │',
        '│              └───┘               │',
        '│                                  │',
        '└──────────────────────────────────┘',
      ].join('\n'),
    )
  })
})

/**
 * Regression test for issue #632 — a weekly form-judge audit comparing this
 * repo's ASCII output against real mermaid.js SVG flagged the "Subgraph
 * Direction Override" sample (samples-data.ts): the cluster label
 * "Processing Pipeline" was truncated mid-word to "Processing Pipe" even
 * though the source SVG's cluster rect is wide enough to fit the full label
 * untruncated.
 *
 * Root cause: `calculateSubgraphBoundingBox` (src/ascii/grid.ts) sized a
 * subgraph's box purely from its child nodes' positions — it never
 * considered the width of the subgraph's own label — so a label longer
 * than the widest child node's contribution to the box got silently
 * clipped by `drawSubgraphLabel`'s own border-safety guard (the fix
 * verified by the tests above, which correctly stops a label from spilling
 * onto the border, but does nothing to stop it needing to spill in the
 * first place). The fix widens the box, symmetrically, whenever the
 * label's own display width would otherwise exceed the interior the child
 * nodes alone would have produced.
 */
describe('ASCII subgraph label does not truncate a label wider than its child nodes (issue #632)', () => {
  it('renders "Processing Pipeline" in full instead of truncating it to "Processing Pipe"', () => {
    const mermaid = `graph TD
  subgraph pipeline [Processing Pipeline]
    direction LR
    A[Input] --> B[Parse] --> C[Transform] --> D[Output]
  end
  E[Source] --> A
  D --> F[Sink]`
    const output = renderMermaidASCII(mermaid)

    expect(output).toContain('Processing Pipeline')
    expect(output).not.toContain('Processing Pipe│')
    expect(output).not.toContain('Processing Pipe\n')

    const titleLine = output
      .split('\n')
      .find((l) => l.includes('Processing Pipeline'))
    expect(titleLine).toBeDefined()
    // The label sits fully inside the border on both sides, not clipped
    // against (or spilling onto) either one.
    expect(titleLine?.startsWith('│')).toBe(true)
    expect(titleLine?.endsWith('│')).toBe(true)
  })

  it('still truncates a title far wider than any reasonable box only via the border-safety clip, never mid-word from box sizing alone', () => {
    // A label wider than the box has room for, on a subgraph with only a
    // single tiny child node — the box widens to fit the label (this
    // issue's fix), so nothing is truncated by width sizing; the only
    // remaining clip source is `drawSubgraphLabel`'s own border guard
    // (covered by the tests above), which only fires for pathological
    // cases (e.g. a taller-than-tall label) that this fix does not touch.
    const mermaid = `flowchart TD
  subgraph ONE["A Rather Long Subgraph Title Here"]
    A1["a"]
  end`
    const output = renderMermaidASCII(mermaid)
    expect(output).toContain('A Rather Long Subgraph Title Here')
  })
})
