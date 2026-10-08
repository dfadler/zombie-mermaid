/**
 * Regression test for #445 — "Flowchart: `direction LR` override inside a
 * subgraph renders wrong."
 *
 * The fix (src/ascii/converter.ts's `subgraphDirectionIsHonored`) only
 * *drops* a subgraph's own `direction` override when a member node has an
 * edge crossing the subgraph's boundary. This test covers the other side of
 * that branch — a subgraph with a `direction` override and NO boundary-
 * crossing edges must still have the override applied, exactly as before
 * this fix. Without this case, a regression that made
 * `subgraphDirectionIsHonored` always return `false` (dropping every
 * override, honored or not) would go undetected.
 */

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

describe('ASCII subgraph direction override — honored case (issue #445)', () => {
  it.each(['LR', 'RL'] as const)(
    'applies direction %s when no member node has a boundary-crossing edge',
    (direction) => {
      const ascii = renderMermaidASCII(
        `graph TD
  subgraph Group
    direction ${direction}
    A --> B --> C
  end`,
        { colorMode: 'none' },
      )

      const lines = ascii.split('\n')
      const rowA = lines.findIndex((l) => l.includes('A'))
      const rowB = lines.findIndex((l) => l.includes('B'))
      const rowC = lines.findIndex((l) => l.includes('C'))

      // Honored `direction LR`/`RL` places A, B, C on the same row, not
      // stacked one per row as the outer `TD` would; RL reads right-to-left
      // (#1421).
      expect(rowA).toBe(rowB)
      expect(rowB).toBe(rowC)

      const colA = lines[rowA]!.indexOf('A')
      const colB = lines[rowB]!.indexOf('B')
      const colC = lines[rowC]!.indexOf('C')
      if (direction === 'LR') {
        expect(colA).toBeLessThan(colB)
        expect(colB).toBeLessThan(colC)
      } else {
        expect(colC).toBeLessThan(colB)
        expect(colB).toBeLessThan(colA)
      }
    },
  )

  it('lays direction BT out as a vertical stack that reads bottom-to-top', () => {
    // BT is neither 'LR' nor 'RL', so it lays out as 'TD' and is then
    // flipped (#1421).
    const ascii = renderMermaidASCII(
      `graph TD
  subgraph Group
    direction BT
    A --> B --> C
  end`,
      { colorMode: 'none' },
    )

    const lines = ascii.split('\n')
    const rowA = lines.findIndex((l) => l.includes('A'))
    const rowB = lines.findIndex((l) => l.includes('B'))
    const rowC = lines.findIndex((l) => l.includes('C'))

    expect(rowC).toBeLessThan(rowB)
    expect(rowB).toBeLessThan(rowA)
  })

  it('does not crash on a subgraph with a direction override and zero member nodes', () => {
    // Exercises subgraphDirectionIsHonored's `memberIds.size === 0` early
    // return: an edge-case subgraph declaring only `direction`, no nodes.
    // There's no member node to check for a boundary-crossing edge, so it
    // trivially counts as "honored" (nothing to un-honor) rather than
    // throwing or mis-rendering the rest of the diagram.
    const ascii = renderMermaidASCII(
      `graph TD
  subgraph Empty
    direction LR
  end
  A --> B`,
      { colorMode: 'none' },
    )

    expect(ascii).toContain('A')
    expect(ascii).toContain('B')
  })
})
