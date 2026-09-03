/**
 * Regression test for #444: when a node fans out into two or more sibling
 * subgraphs (e.g. `E --> A` into `us-east`, `E --> C` into `us-west`, both
 * nested in `Cloud`), this renderer used to place them in source-declaration
 * order (`us-east` left, `us-west` right) — but real mermaid.js's dagre-based
 * layout places the LAST-declared sibling subgraph leftmost instead
 * (verified against a real mermaid.js + Playwright render; see the issue for
 * the exact SVG cluster x-coordinates).
 *
 * The fix (grid.ts): `orderNodesForSiblingSubgraphs` sorts a node's children
 * — and, separately, the outer per-pass traversal order in
 * `placeReachableChildren` — by the REVERSED declaration order of any
 * sibling subgraphs they diverge into, but only when both diverging
 * subgraphs actually have an incoming edge from outside themselves
 * (`computeExternallyFedSubgraphs`). That scoping matters: reordering only
 * the first hop (a parent's direct children) without also reordering which
 * parent's subtree gets *discovered* first in later passes left
 * grandchildren claiming column slots in the original order, misaligning
 * them under the wrong parent entirely — an intermediate version of this fix
 * shipped exactly that bug. And reordering unconditionally (not just
 * genuinely fed sibling subgraphs) broke
 * ascii-subgraph-title-padding.test.ts's connector-less case, where two
 * independent, unconnected subgraphs must keep their declaration order.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII nested subgraph sibling order (#444)', () => {
  it('places the last-declared sibling subgraph leftmost when both are fed by the same external node', () => {
    const mermaid = `graph TD
  subgraph Cloud
    subgraph us-east [US East Region]
      A[Web Server] --> B[App Server]
    end
    subgraph us-west [US West Region]
      C[Web Server] --> D[App Server]
    end
  end
  E[Load Balancer] --> A
  E --> C`

    const output = renderMermaidASCII(mermaid)
    const lines = output.split('\n')

    // Match on "US West"/"US East" rather than the full "...Region" label:
    // the East box's connector line happens to cross through its own title
    // row at this box width, splitting the rendered text into "US
    // East│Region" — a pre-existing, unrelated cosmetic quirk of the label
    // vs. connector layout, present on both sides of this fix.
    const westLine = lines.find((l) => l.includes('US West'))
    const eastLine = lines.find((l) => l.includes('US East'))
    expect(westLine).toBeDefined()
    expect(eastLine).toBeDefined()

    // us-west was declared *second* in the source but must render to the
    // left of us-east (declared first) — matching real mermaid.js.
    const westCol = westLine!.indexOf('US West')
    const eastCol = eastLine!.indexOf('US East')
    expect(westCol).toBeLessThan(eastCol)

    // Each region's own internal structure must stay intact — one "Web
    // Server" and one "App Server" box per region, not cross-wired with the
    // other region's nodes (the grandchild-misalignment failure mode this
    // fix's second pass addresses; see the module doc above).
    for (const label of ['Web Server', 'App Server']) {
      const occurrences = lines.reduce(
        (count, l) => count + l.split(label).length - 1,
        0,
      )
      expect(occurrences).toBe(2)
    }
  })

  it('does not reorder independent sibling subgraphs with no shared external feed', () => {
    // Same shape as ascii-subgraph-title-padding.test.ts's connector-less
    // case: two top-level subgraphs, declared ONE then TWO, with no edge
    // relating them at all. Real mermaid.js has no rank relationship to
    // reverse here, and this renderer must keep declaration order.
    const mermaid = `graph TD
  subgraph ONE["First"]
    A1["a"] --> A2["b"]
  end
  subgraph TWO["Second"]
    B1["c"] --> B2["d"]
  end`

    const output = renderMermaidASCII(mermaid)
    const lines = output.split('\n')

    const firstLine = lines.find((l) => l.includes('First'))
    const secondLine = lines.find((l) => l.includes('Second'))
    expect(firstLine).toBeDefined()
    expect(secondLine).toBeDefined()

    const firstCol = firstLine!.indexOf('First')
    const secondCol = secondLine!.indexOf('Second')
    expect(firstCol).toBeLessThan(secondCol)
  })
})
