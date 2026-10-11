/**
 * Platform-independent geometry guard for #1796. The Playwright PNG suite
 * tolerates ~680 changed pixels, so a 2px -> 8px trunk move (#1782) slipped
 * past it. This asserts the invariant `clearBorders`
 * (packages/svg-renderer/src/layout-engine/compound-flat.ts) enforces, on the
 * SVG numbers directly: no edge segment runs parallel to a subgraph box side
 * within BORDER_GAP px of it unless it is the edge's first or last segment
 * (the one attached to a node).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import { samples } from '../packages/site/samples-data.ts'

const BORDER_GAP = 8
const EPS = 0.01

type Pt = [number, number]
interface Box {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Samples that violate the invariant today, so the test asserts everything
 * else. Keyed by sample title -> reason. Do not add entries to hide new bugs.
 * Empty today: no sample violates it. Known gap (reported unfixed by #1782):
 * with nested boxes the outer side wins, so a run can sit closer than 8px to
 * the inner box's side; no current sample shows it.
 */
const KNOWN_VIOLATIONS: Record<string, string> = {}

function geometry(svg: string): { boxes: Box[]; edges: Pt[][] } {
  const boxes = [
    ...svg.matchAll(
      /<g class="subgraph"[^>]*>\s*<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/g,
    ),
  ].map((m) => ({ x: +m[1]!, y: +m[2]!, w: +m[3]!, h: +m[4]! }))
  const edges = [
    ...svg.matchAll(/<polyline class="edge"[^>]* points="([^"]+)"/g),
  ].map((m) =>
    m[1]!
      .trim()
      .split(/\s+/)
      .map((p) => p.split(',').map(Number) as Pt),
  )
  return { boxes, edges }
}

/** Every inner (non-first, non-last) axis-parallel segment within the gap of a box side. */
function nearBorderRuns(svg: string): string[] {
  const { boxes, edges } = geometry(svg)
  const found: string[] = []
  edges.forEach((pts, ei) => {
    for (let i = 1; i < pts.length - 2; i++) {
      const [a, b] = [pts[i]!, pts[i + 1]!]
      for (const [c, d] of [
        [0, 1],
        [1, 0],
      ] as const) {
        if (Math.abs(a[c]! - b[c]!) > EPS) continue // not constant on axis c
        const lo = Math.min(a[d]!, b[d]!)
        const hi = Math.max(a[d]!, b[d]!)
        for (const bx of boxes) {
          const [pos, len, opos, olen] =
            c === 0 ? [bx.x, bx.w, bx.y, bx.h] : [bx.y, bx.h, bx.x, bx.w]
          if (hi <= opos + EPS || lo >= opos + olen - EPS) continue
          for (const side of [pos, pos + len]) {
            const gap = Math.abs(a[c]! - side)
            if (gap < BORDER_GAP - EPS)
              found.push(
                `edge#${ei} seg ${a}->${b} is ${gap.toFixed(2)}px from box side ${c === 0 ? 'x' : 'y'}=${side}`,
              )
          }
        }
      }
    }
  })
  return found
}

const scanned = samples
  .filter((s) => s.category === 'Flowchart' || s.category === 'State')
  .map((s) => ({ s, svg: renderMermaidSVG(s.source) }))
  .filter(({ svg }) => svg.includes('class="subgraph"'))

describe('subgraph border clearance (#1796)', () => {
  it('scans some samples', () => {
    expect(scanned.length).toBeGreaterThan(5)
  })

  it.each(scanned.map(({ s, svg }) => [s.title, svg] as const))(
    '%s: no edge run hugs a subgraph side',
    (title, svg) => {
      const runs = nearBorderRuns(svg)
      if (title in KNOWN_VIOLATIONS) return
      expect(runs).toEqual([])
    },
  )

  it('System Architecture: the API Gateway fan-out shares a trunk >= 8px from Client Layer', () => {
    const svg = renderMermaidSVG(
      samples.find((s) => s.title === 'System Architecture')!.source,
    )
    const { boxes } = geometry(svg)
    const client = boxes[0]! // first <g class="subgraph"> is clients (graph LR)
    const right = client.x + client.w
    const out = [
      ...svg.matchAll(
        /<polyline class="edge" data-from="B" data-to="([DEF])"[^>]* points="([^"]+)"/g,
      ),
    ]
    expect(out.map((m) => m[1])).toEqual(['D', 'E', 'F'])
    const trunks = out.map(
      (m) =>
        m[2]!
          .trim()
          .split(/\s+/)
          .map((p) => +p.split(',')[0]!)[1]!,
    )
    // one shared trunk x, exactly BORDER_GAP right of the Client Layer side
    expect(new Set(trunks).size).toBe(1)
    expect(trunks[0]! - right).toBeCloseTo(BORDER_GAP, 1)
  })
})
