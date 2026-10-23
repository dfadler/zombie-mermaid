/**
 * #1915: with `paddingX` 1 or 2, the gap right after an LR parent was too
 * narrow for the junction. The long edge (`A --> C`) dropped from the cell
 * under the `A --> B` arrowhead, so it read as leaving B's border. The gap
 * before a same-row child whose parent also bypasses it is now at least 3 wide.
 *
 * Invariant: a `│` stroke never sits directly under an arrowhead, and every
 * `│` directly under a horizontal edge line is joined to it by a junction.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SOURCES = [
  'flowchart LR\n  A --> B\n  A --> C\n  B --> C',
  'flowchart LR\n  A --> B\n  B --> C\n  C --> D\n  A --> C\n  A --> D',
]

function loose(out: string): string[] {
  const rows = out.split('\n').map((r) => [...r])
  const bad: string[] = []
  rows.forEach((row, y) =>
    row.forEach((ch, x) => {
      const above = rows[y - 1]?.[x]
      if (ch === '│' && (above === '►' || above === '─'))
        bad.push(`${y}:${x} ${above}/${ch}`)
    }),
  )
  return bad
}

describe('LR origin gap junction (#1915)', () => {
  it.each(SOURCES.flatMap((s) => [1, 2, 3].map((p) => [s, p] as const)))(
    'no unjoined stroke below an edge line (paddingX %#)',
    (src, p) => {
      expect(
        loose(renderMermaidASCII(src, { colorMode: 'none', paddingX: p })),
      ).toEqual([])
    },
  )

  // Since #2043 the long edge leaves A's bottom face instead of the gap.
  it('keeps the line out of A unbroken at paddingX 2', () => {
    const rows = renderMermaidASCII(SOURCES[0]!, {
      colorMode: 'none',
      paddingX: 2,
    }).split('\n')
    expect(rows[2]).toMatch(/^│ A ├──►│ B ├──►│ C │$/)
  })
})
