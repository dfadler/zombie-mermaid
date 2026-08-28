/**
 * Regression tests for edge bundling routing a branch through a node box.
 *
 * `bundleEdgePaths` replaces a routed edge with a trunk plus a straight branch
 * to each endpoint. That substitution is only sound when the branch spans the
 * gap between two adjacent layers. When a fan-out (or fan-in) reaches an
 * endpoint several layers away, the branch crosses every layer in between,
 * and any node sitting in its column gets a line drawn straight through it.
 *
 * The layout engine already routes those edges around the obstacles, so a
 * bundle whose branch would collide is rejected and the routed path kept.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** Every `<polyline class="edge">` path in `svg`, keyed as `FROM->TO`. */
function edgePaths(svg: string): Map<string, { x: number; y: number }[]> {
  const out = new Map<string, { x: number; y: number }[]>()
  for (const m of svg.matchAll(
    /data-from="([^"]+)" data-to="([^"]+)"[^>]*points="([^"]+)"/g,
  )) {
    const points = m[3]!
      .split(/\s+/)
      .filter(Boolean)
      .map((pair) => {
        const [x, y] = pair.split(',')
        return { x: Number(x), y: Number(y) }
      })
    out.set(`${m[1]}->${m[2]}`, points)
  }
  return out
}

/** Every node's box in `svg`, keyed by node id. */
function nodeBoxes(svg: string): Map<string, Box> {
  const out = new Map<string, Box>()
  for (const m of svg.matchAll(
    /<g class="node" data-id="([^"]+)"[\s\S]{0,400}?<rect[^>]*x="([\d.-]+)"[^>]*y="([\d.-]+)"[^>]*width="([\d.-]+)"[^>]*height="([\d.-]+)"/g,
  )) {
    out.set(m[1]!, {
      x: Number(m[2]),
      y: Number(m[3]),
      width: Number(m[4]),
      height: Number(m[5]),
    })
  }
  return out
}

/**
 * Node ids whose box a rectilinear `path` passes through, ignoring the path's
 * own endpoints (which it must touch). A 0.5px inset keeps a line that merely
 * grazes a border from counting.
 */
function nodesCrossedBy(
  path: { x: number; y: number }[],
  boxes: Map<string, Box>,
  endpoints: string[],
): string[] {
  const hit: string[] = []
  for (const [id, box] of boxes) {
    if (endpoints.includes(id)) continue
    const minX = box.x + 0.5
    const maxX = box.x + box.width - 0.5
    const minY = box.y + 0.5
    const maxY = box.y + box.height - 0.5
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!
      const b = path[i + 1]!
      if (
        Math.min(a.x, b.x) < maxX &&
        Math.max(a.x, b.x) > minX &&
        Math.min(a.y, b.y) < maxY &&
        Math.max(a.y, b.y) > minY
      ) {
        hit.push(id)
        break
      }
    }
  }
  return hit
}

describe('edge bundling keeps clear of node boxes', () => {
  it('does not bundle a fan-out branch through the layers it skips', () => {
    /*
     * A fans out to B (next layer) and to C (three layers down). Bundling both
     * put C's branch in a single straight drop from A's own exit gap, through
     * B and F.
     */
    const src = `flowchart TB
  A[PR push] --> B[11 CI workflows]
  A --> C[PR merge status bot]
  D[Review comment] --> E[claude mention job]
  D --> C
  B --> F[workflow_run completion events]
  F --> C`

    const svg = renderMermaidSVG(src, { mergeEdges: true })
    const boxes = nodeBoxes(svg)
    const paths = edgePaths(svg)

    const ac = paths.get('A->C')
    expect(ac).toBeDefined()
    expect(nodesCrossedBy(ac!, boxes, ['A', 'C'])).toEqual([])
  })

  it('leaves no edge in the diagram crossing an unrelated node', () => {
    const src = `flowchart TB
  A[PR push] --> B[11 CI workflows]
  A --> C[PR merge status bot]
  D[Review comment] --> E[claude mention job]
  D --> C
  B --> F[workflow_run completion events]
  F --> C`

    const svg = renderMermaidSVG(src, { mergeEdges: true })
    const boxes = nodeBoxes(svg)

    for (const [key, path] of edgePaths(svg)) {
      const [from, to] = key.split('->')
      expect({
        key,
        crosses: nodesCrossedBy(path, boxes, [from!, to!]),
      }).toEqual({ key, crosses: [] })
    }
  })

  it('still bundles a fan-out whose targets share a layer', () => {
    const src = `flowchart TB
  A[next build] --> S[Static]
  A --> P[Partial Prerender]
  A --> D[Dynamic]`

    const svg = renderMermaidSVG(src, { mergeEdges: true })
    const paths = edgePaths(svg)

    const as = paths.get('A->S')!
    const ap = paths.get('A->P')!
    const ad = paths.get('A->D')!

    // A shared trunk means an identical exit point and first bend.
    expect(as[0]).toEqual(ap[0])
    expect(as[0]).toEqual(ad[0])
    expect(as[1]!.y).toEqual(ap[1]!.y)
    expect(as[1]!.y).toEqual(ad[1]!.y)
  })

  it('does not bundle a fan-in arriving from a layer it would cut through', () => {
    /*
     * The mirror case: three edges converge on C, but A sits three layers up,
     * so its branch into the shared trunk would cross B and F.
     */
    const src = `flowchart TB
  A[start] --> B[step one]
  B --> F[step two]
  F --> C[sink]
  A --> C
  G[other] --> C`

    const svg = renderMermaidSVG(src, { mergeEdges: true })
    const boxes = nodeBoxes(svg)

    for (const [key, path] of edgePaths(svg)) {
      const [from, to] = key.split('->')
      expect({
        key,
        crosses: nodesCrossedBy(path, boxes, [from!, to!]),
      }).toEqual({ key, crosses: [] })
    }
  })
})
