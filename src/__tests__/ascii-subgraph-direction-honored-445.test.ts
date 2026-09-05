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
import { renderMermaidASCII } from '../ascii/index.ts'

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

      // Honored `direction LR`/`RL` (both normalize to LR) places A, B, C on
      // the same row (left-to-right), not stacked one per row as the outer
      // `TD` would.
      expect(rowA).toBe(rowB)
      expect(rowB).toBe(rowC)

      const colA = lines[rowA]!.indexOf('A')
      const colB = lines[rowB]!.indexOf('B')
      const colC = lines[rowC]!.indexOf('C')
      expect(colA).toBeLessThan(colB)
      expect(colB).toBeLessThan(colC)
    },
  )

  it('normalizes direction BT to TD (vertical stacking), same as the outer graph', () => {
    // Exercises the ternary's final `: 'TD'` fallback arm — BT is neither
    // 'LR' nor 'RL', so it normalizes to 'TD' just like an unset direction
    // would default to matching the outer graph's own TD flow.
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

    expect(rowA).toBeLessThan(rowB)
    expect(rowB).toBeLessThan(rowC)
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
