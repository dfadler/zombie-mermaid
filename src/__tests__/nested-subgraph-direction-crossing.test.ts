/**
 * Regression tests for issue #73: nested-subgraph `direction` overrides
 * breaking cross-subgraph edge routing.
 *
 * Background: `src/layout-engine/to-elk.ts` uses ELK's
 * `hierarchyHandling: SEPARATE` to let nested subgraphs override the parent
 * diagram's layout direction. Under SEPARATE, ELK only resolves an edge
 * automatically when both endpoints are visible from the edge's declared
 * container (a direct child, or a port on the container/one of its direct
 * children) — it does not search further down the hierarchy. Edges crossing
 * more than one subgraph boundary therefore need to be decomposed into a
 * chain of sub-edges joined at explicit ports, one hop per boundary, with
 * each hop living in the correct container level.
 *
 * These tests lock in:
 *  - a `direction` override on a *nested* subgraph actually changes the
 *    layout axis for that subgraph's contents (previously silently ignored
 *    because the SEPARATE/INCLUDE_CHILDREN choice only scanned top-level
 *    subgraphs for overrides)
 *  - edges crossing one or more subgraph boundaries route with real
 *    ELK-computed bends instead of failing to route at all or falling back
 *    to a naive Z-path through the vertical midpoint
 *  - `mergeEdges` trunk-bundling still works for edges that go through this
 *    decomposition
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG, parseMermaid } from '../index.ts'
import { layoutGraphSync } from '../layout.ts'

/**
 * Extract an attribute value from the first `<tag ...>` in `xml` whose
 * opening tag contains `marker` verbatim (e.g. `data-id="X"`).
 *
 * Plain string search rather than a dynamically-built RegExp — `marker`/
 * `attr` here are always hardcoded test ids, not attacker-controlled input,
 * but Semgrep's non-literal-regexp rule flags `new RegExp(...\${x}...)`
 * regardless (same pattern already addressed this way elsewhere in this
 * repo, see `renderer.test.ts`'s marker tests).
 */
function attrAfter(xml: string, marker: string, attr: string): string {
  const tagStart = xml.indexOf(marker)
  if (tagStart < 0)
    throw new Error(`marker ${JSON.stringify(marker)} not found in SVG`)
  const tagEnd = xml.indexOf('>', tagStart)
  const tag = xml.slice(tagStart, tagEnd + 1)
  const needle = `${attr}="`
  const valueStart = tag.indexOf(needle)
  if (valueStart < 0) {
    throw new Error(
      `attribute ${attr} not found on tag containing ${JSON.stringify(marker)}`,
    )
  }
  const start = valueStart + needle.length
  const end = tag.indexOf('"', start)
  return tag.slice(start, end)
}

/** Extract the {x, y, width, height} of a top-level node's rect from rendered SVG. */
function nodeRect(
  svg: string,
  id: string,
): { x: number; y: number; width: number; height: number } {
  const marker = `<g class="node" data-id="${id}"`
  const groupStart = svg.indexOf(marker)
  if (groupStart < 0) throw new Error(`node ${id} not found in SVG`)
  const rectStart = svg.indexOf('<rect', groupStart)
  const rectEnd = svg.indexOf('>', rectStart)
  const rectTag = svg.slice(rectStart, rectEnd + 1)
  const num = (attr: string): number =>
    Number(attrAfter(rectTag, '<rect', attr))
  return {
    x: num('x'),
    y: num('y'),
    width: num('width'),
    height: num('height'),
  }
}

/** Extract the polyline `points` attribute for a given edge. */
function edgePoints(svg: string, from: string, to: string): string {
  const marker = `data-from="${from}" data-to="${to}"`
  return attrAfter(svg, marker, 'points')
}

function parsePoints(pointsAttr: string): Array<{ x: number; y: number }> {
  return pointsAttr
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number)
      return { x: x!, y: y! }
    })
}

describe('nested-subgraph direction overrides (issue #73)', () => {
  it('honors a `direction` override on a nested (not top-level) subgraph', () => {
    // Inner has its own direction override; Outer does not. Before the fix,
    // `hasDirectionOverride` only scanned top-level subgraphs, so this
    // diagram silently fell back to INCLUDE_CHILDREN and ignored Inner's LR.
    const src = `
flowchart TD
  subgraph Outer
    subgraph Inner
      direction LR
      X[X node]
      Y[Y node]
      X --> Y
    end
  end
`
    const svg = renderMermaidSVG(src)
    const x = nodeRect(svg, 'X')
    const y = nodeRect(svg, 'Y')

    // LR: Y should be to the right of X, roughly on the same horizontal band —
    // not stacked below it.
    expect(y.x).toBeGreaterThan(x.x + x.width - 1)
    expect(Math.abs(y.y - x.y)).toBeLessThan(Math.max(x.height, y.height))
  })

  it('routes an edge crossing exactly one subgraph boundary with real bends', () => {
    const src = `
flowchart TD
  B[B node]
  subgraph Outer
    direction TB
    subgraph Inner
      direction LR
      X[X node]
      Y[Y node]
      X --> Y
    end
  end
  B --> X
`
    const svg = renderMermaidSVG(src)
    const points = parsePoints(edgePoints(svg, 'B', 'X'))
    // A working cross-boundary route has more than the two raw endpoints
    // (ELK-computed bend points), and every coordinate must be finite —
    // the previously-broken path produced edges with zero sections, which
    // upstream code detects and falls back to a naive Z-path (or, in the
    // deeper-nesting case, no route at all).
    expect(points.length).toBeGreaterThanOrEqual(2)
    for (const p of points) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })

  it('routes an edge crossing two subgraph boundaries (deep nesting) instead of failing to route', () => {
    // Before the fix: the single-hop port mechanism only worked when one
    // endpoint's subgraph was a *direct child* of the other endpoint's
    // container. Here B→X and Y→D each cross two boundaries
    // (root → Outer → Inner), which produced ELK edges with zero sections
    // (no route at all).
    const src = `
flowchart TD
  A[Start] --> B[B node]
  subgraph Outer
    C[C node]
    subgraph Inner
      direction LR
      X[X node]
      Y[Y node]
      X --> Y
    end
    X --> C
  end
  B --> X
  Y --> D[End]
`
    const svg = renderMermaidSVG(src)

    // Inner's `direction LR` is *not* honored here: X has an edge crossing
    // Inner's boundary (B --> X, X --> C) and so does Y (Y --> D), so per
    // mermaid.js's documented precedence rule ("If any of a subgraph's
    // nodes are linked to the outside, subgraph direction will be ignored.
    // Instead the subgraph will inherit the direction of the parent
    // graph." — https://mermaid.js.org/syntax/flowchart.html) Inner
    // inherits the root's TD direction instead. Verified against real
    // mermaid.js output: X and Y render at the same x-coordinate with
    // increasing y, not side by side.
    const x = nodeRect(svg, 'X')
    const y = nodeRect(svg, 'Y')
    expect(y.y).toBeGreaterThan(x.y + x.height - 1)
    expect(Math.abs(y.x - x.x)).toBeLessThan(Math.max(x.width, y.width))

    // Both deep cross-boundary edges must have actually routed (non-empty,
    // finite polylines) rather than being dropped or degenerating to a
    // single point.
    for (const [from, to] of [
      ['B', 'X'],
      ['Y', 'D'],
      ['X', 'C'],
    ] as const) {
      const points = parsePoints(edgePoints(svg, from, to))
      expect(points.length).toBeGreaterThanOrEqual(2)
      for (const p of points) {
        expect(Number.isFinite(p.x)).toBe(true)
        expect(Number.isFinite(p.y)).toBe(true)
      }
    }

    // No duplicate subgraph rendering (a symptom seen while diagnosing this
    // issue: a member-node reference that collides with a nested subgraph's
    // own ID must not produce two "Inner" groups).
    const innerGroupCount = (
      svg.match(/<g class="subgraph" data-id="Inner"/g) ?? []
    ).length
    expect(innerGroupCount).toBe(1)
  })

  it('routes an edge between sibling subgraphs that both need boundary hops', () => {
    // Q is inside InnerA, R is inside InnerB; both are nested in Outer, so
    // the edge needs a hop on *both* sides up to their shared parent (Outer).
    const src = `
flowchart TD
  subgraph Outer
    direction TB
    subgraph InnerA
      direction LR
      P[P node]
      Q[Q node]
      P --> Q
    end
    subgraph InnerB
      direction LR
      R[R node]
      S[S node]
      R --> S
    end
    Q --> R
  end
`
    const svg = renderMermaidSVG(src)
    const points = parsePoints(edgePoints(svg, 'Q', 'R'))
    expect(points.length).toBeGreaterThanOrEqual(2)
    for (const p of points) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })

  it('keeps mergeEdges trunk-bundling working for edges that get decomposed', () => {
    /*
     * No edge between X and Z, so neither constrains the other's rank —
     * both are only linked from B (each via a crossing edge, which is what
     * exercises the port-decomposition machinery under test) and land on
     * the same layer, giving a genuine fan-out from a shared trunk. (An
     * earlier version of this diagram had `X --> Z` and relied on Inner's
     * `direction LR` override to force them onto the same visual row —
     * but that override is dropped per mermaid.js's crossing-edge
     * precedence rule, since B --> X and B --> Z both cross Inner's
     * boundary; with the edge removed, same-layer placement holds
     * regardless of which direction Inner ends up inheriting.) A trunk
     * with a short branch to each is a sound route — which is what makes
     * this diagram a fair test that bundling survives decomposition.
     * Fanning out to targets on genuinely *different* layers is a
     * different scenario, where bundling correctly stands down instead.
     */
    const src = `
flowchart TD
  B[B node]
  B --> X
  B --> Z
  subgraph Outer
    subgraph Inner
      direction LR
      X[X node]
      Z[Z node]
    end
  end
`
    const merged = renderMermaidSVG(src, { mergeEdges: true })
    const unmerged = renderMermaidSVG(src, { mergeEdges: false })

    const mergedBX = parsePoints(edgePoints(merged, 'B', 'X'))
    const mergedBZ = parsePoints(edgePoints(merged, 'B', 'Z'))
    const unmergedBX = parsePoints(edgePoints(unmerged, 'B', 'X'))
    const unmergedBZ = parsePoints(edgePoints(unmerged, 'B', 'Z'))

    // With bundling on, the fan-out from B shares a common trunk: the first
    // two points (the shared exit from B, and the shared bend before the
    // paths diverge to X vs Z) should be identical.
    expect(mergedBX[0]).toEqual(mergedBZ[0])
    expect(mergedBX[1]).toEqual(mergedBZ[1])

    // With bundling off, each edge exits B independently — the two paths
    // should not share that same initial exit point.
    expect(unmergedBX[0]).not.toEqual(unmergedBZ[0])
  })

  it('leaves non-crossing edges and direction-free diagrams unaffected (INCLUDE_CHILDREN path)', () => {
    // No subgraph has a direction override anywhere, so this must still use
    // the simple INCLUDE_CHILDREN path (unchanged from before this fix).
    const src = `
flowchart TD
  A[Start] --> B
  subgraph Outer
    subgraph Inner
      X[X node]
      Y[Y node]
      X --> Y
    end
    C[C node]
  end
  B --> X
  Y --> D[End]
`
    const graph = parseMermaid(src)
    const positioned = layoutGraphSync(graph)
    const nodeIds = positioned.nodes.map((n) => n.id).sort()
    expect(nodeIds).toEqual(['A', 'B', 'C', 'D', 'X', 'Y'])
    expect(positioned.edges).toHaveLength(4)
    for (const edge of positioned.edges) {
      for (const p of edge.points) {
        expect(Number.isFinite(p.x)).toBe(true)
        expect(Number.isFinite(p.y)).toBe(true)
      }
    }
  })
})
