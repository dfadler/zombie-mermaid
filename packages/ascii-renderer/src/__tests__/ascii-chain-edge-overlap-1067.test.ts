/**
 * Regression test for #1067 ("System Architecture" form-judge finding): an
 * edge chained through a shared intermediate node (`C(Mobile App) -->
 * B(API Gateway)` then `B --> E(User Service)`) could render as one
 * unbroken line straight from Mobile App to User Service, even though the
 * source has no direct `Mobile App --> User Service` edge.
 *
 * Root cause: both edges are independently routed (LR direction, so
 * `analyzeEdgeBundles` never groups anything — see its own "LR routing
 * handles merging naturally at corners" comment), and their corners
 * happened to land on the exact same grid cell: `Mobile App --> API
 * Gateway`'s incoming leg travels up API Gateway's own column to the same
 * row `API Gateway --> User Service`'s outgoing leg travels down, before
 * turning right toward User Service. The two legs are collinear, so the
 * drawn result reads as one continuous connector across a shared row.
 *
 * Fix: `edge-cell-styles.ts`'s `findUnrelatedOverlap` (scoped to true
 * *chain* pairs — one edge's `to` equal to the other's `from`, not a
 * fan-in/fan-out sibling pair, which legitimately shares trunk cells; see
 * that module's doc for why the broader "shares neither endpoint" version
 * broke the `ampersand_lhs_and_rhs` golden file) flags a chain pair that
 * shares 2+ open cells beyond their common node's own border, and
 * `rerouteAroundStyleConflicts` (grid.ts) reroutes one of them around the
 * conflicting cell — the same mechanism already used for cross-style
 * conflicts, extended to this same-style chain case.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SYSTEM_ARCHITECTURE = `graph LR
  subgraph clients [Client Layer]
    A([Web App]) --> B[API Gateway]
    C([Mobile App]) --> B
  end
  subgraph services [Service Layer]
    B --> D[Auth Service]
    B --> E[User Service]
    B --> F[Order Service]
  end
  subgraph data [Data Layer]
    D --> G[(Auth DB)]
    E --> H[(User DB)]
    F --> I[(Order DB)]
    F --> J([Message Queue])
  end`

describe('chained edges through a shared intermediate node stay visually distinct (#1067)', () => {
  const lines = renderMermaidASCII(SYSTEM_ARCHITECTURE, { colorMode: 'none' })
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))

  it('renders every label and does not throw', () => {
    const out = lines.join('\n')
    for (const label of [
      'Web App',
      'Mobile App',
      'API Gateway',
      'Auth Service',
      'User Service',
      'Order Service',
    ]) {
      expect(out).toContain(label)
    }
  })

  it("leaves a visual break between Mobile App's own row and User Service — they must not read as one connected line", () => {
    const mobileRow = lines.find((l) => l.includes('Mobile App'))
    expect(mobileRow).toBeDefined()
    // Start just past Mobile App's own right border connector ('├' or
    // '┤'), and end at User Service's own left border ('│  User Service').
    // Both boxes' own padding ("Mobile App │" / "│  User Service")
    // contributes a harmless blank cell or two right next to the label
    // text itself — excluding both box borders from the scanned range
    // means only the *connector* in between is checked, not incidental box
    // padding (see the sabotage check on this test, which caught exactly
    // this false pass on an earlier, looser version of this assertion).
    const afterLabel = mobileRow!.indexOf('Mobile App') + 'Mobile App'.length
    const start = mobileRow!.slice(afterLabel).search(/[├┤]/) + afterLabel + 1
    const end = mobileRow!.indexOf('│  User Service')
    expect(end).toBeGreaterThan(start)
    const between = mobileRow!.slice(start, end)

    // The bug produced a fully packed run of box-drawing characters (no
    // blank cell at all) all the way from Mobile App's own border to User
    // Service's — i.e. one unbroken connector. A genuine visual break
    // requires at least one blank cell somewhere in between.
    expect(between).toMatch(/ /)
  })

  it("does not draw an arrowhead into User Service on Mobile App's own row", () => {
    // User Service's real incoming edge (from API Gateway) is routed on a
    // different row; if Mobile App's row also shows an arrowhead landing
    // directly on User Service's border, the two are still effectively
    // fused into what reads as one edge.
    const mobileRow = lines.find((l) => l.includes('Mobile App'))!
    const userServiceBoxStart = mobileRow.indexOf('│  User Service')
    expect(userServiceBoxStart).toBeGreaterThan(-1)
    expect(mobileRow[userServiceBoxStart - 1]).not.toBe('►')
  })
})
