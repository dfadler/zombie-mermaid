/**
 * #1308: edges leaving `develop` in the git branching sample were merged onto
 * one trunk, and the `approved` edge returning to `develop` ended on the same
 * side, on top of that trunk. A fan-out/fan-in bundle is only drawn when
 * nothing else attaches to the side it uses.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'

const GIT_BRANCHING = `graph LR
  A[main] --> B[develop]
  B --> C[feature/auth]
  B --> D[feature/ui]
  C --> E{PR Review}
  D --> E
  E -->|approved| B
  B --> F[release/1.0]
  F --> G{Tests?}
  G -->|pass| A
  G -->|fail| F`

const BUNDLED = `graph LR
  B --> C[one]
  B --> D[two]
  B --> F[three]`

function route(source: string, from: string, to: string) {
  const edge = layoutGraphSync(parseMermaid(source)).edges.find(
    (e) => e.source === from && e.target === to,
  )
  expect(edge).toBeDefined()
  return edge?.points ?? []
}

type Pt = { x: number; y: number }

/** Count orthogonal segment pairs that cross at an interior point. */
function crossings(a: Pt[], b: Pt[]): number {
  let n = 0
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) {
      const [p, q, r, s] = [a[i]!, a[i + 1]!, b[j]!, b[j + 1]!]
      const pH = Math.abs(p.y - q.y) < 0.5
      const rH = Math.abs(r.y - s.y) < 0.5
      if (pH === rH) continue
      const [h1, h2, v1, v2] = pH ? [p, q, r, s] : [r, s, p, q]
      if (
        v1.x > Math.min(h1.x, h2.x) + 0.5 &&
        v1.x < Math.max(h1.x, h2.x) - 0.5 &&
        h1.y > Math.min(v1.y, v2.y) + 0.5 &&
        h1.y < Math.max(v1.y, v2.y) - 0.5
      )
        n++
    }
  }
  return n
}

describe('parallel edges leaving one node (#1308)', () => {
  it('gives each edge out of develop its own first run', () => {
    const exits = ['C', 'D', 'F'].map((t) => route(GIT_BRANCHING, 'B', t)[1])
    const ys = new Set(exits.map((p) => Math.round(p?.y ?? 0)))
    // The bundle drew all three as one run along y = develop's centre line.
    expect(ys.size).toBe(3)
  })

  it('does not cross the approved edge over the runs leaving develop', () => {
    const approved = route(GIT_BRANCHING, 'E', 'B')
    for (const t of ['C', 'D', 'F']) {
      expect(crossings(approved, route(GIT_BRANCHING, 'B', t))).toBe(0)
    }
  })

  it('still bundles a plain fan-out with nothing else on that side', () => {
    const exits = ['C', 'D', 'F'].map((t) => route(BUNDLED, 'B', t)[1]!)
    expect(new Set(exits.map((p) => Math.round(p.y))).size).toBe(1)
  })
})
