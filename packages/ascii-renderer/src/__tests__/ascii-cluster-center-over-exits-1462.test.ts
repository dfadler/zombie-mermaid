/**
 * A cluster whose only member fans out through cluster exits is centred over
 * its targets, as a plain node is (#1462). `centerParentsOverChildren` used to
 * skip any node inside a subgraph, so the frame hung over the first target.
 * A cluster with other members still stays put: moving one member would skew
 * the frame.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string, opts: Record<string, unknown> = {}): string[] =>
  renderMermaidASCII(src, { colorMode: 'none', ...opts })
    .split('\n')
    .map((l) => l.trimEnd())

/** Column of the middle of `label` on the first row that carries it. */
function centerOf(lines: string[], label: string): number {
  const row = lines.find((l) => l.includes(label))
  if (row === undefined) throw new Error(`no row contains ${label}`)
  return row.indexOf(label) + (label.length - 1) / 2
}

const offBy = (lines: string[], a: string, b: string): number =>
  Math.abs(centerOf(lines, a) - centerOf(lines, b))

const lone = `flowchart TD
  subgraph S [Cluster]
    a
  end
  S -->|one| X
  S -->|two| Y
  S -->|three| Z
`

describe('cluster centred over its exit targets (#1462)', () => {
  it.each([false, true])(
    'centres a lone-member cluster over the middle target (useAscii=%s)',
    (useAscii) => {
      const out = render(lone, { useAscii })
      expect(offBy(out, 'Cluster', 'Y')).toBeLessThanOrEqual(1)
      expect(offBy(out, 'a', 'Y')).toBeLessThanOrEqual(1)
    },
  )

  it('keeps every exit label and arrowhead', () => {
    const text = render(lone).join('\n')
    for (const label of ['one', 'two', 'three']) expect(text).toContain(label)
    expect(text.match(/▼/g)).toHaveLength(3)
  })

  it('centres a nested lone-member cluster', () => {
    const out = render(`flowchart TD
  subgraph Outer
    subgraph Inner
      a
    end
  end
  Inner --> X
  Inner --> Y
  Inner --> Z
`)
    expect(offBy(out, 'a', 'Y')).toBeLessThanOrEqual(1)
  })

  it('leaves a cluster alone when the member also has a plain edge out', () => {
    // `a --> D` leaves the member sideways, so centring the frame over C and
    // D would only make that route cross the wall.
    const out = render(`flowchart TD
  subgraph S
    a
  end
  S --> C
  a --> D
`)
    expect(out.some((l) => l.startsWith('┌'))).toBe(true)
  })

  it('does not centre over parallel lanes: every lane keeps its own arrowhead', () => {
    // Centred, the third lane's shifted final run (#1331) lost its horizontal
    // leg and arrowhead, leaving a dangling `┘` under T.
    const text = render(`flowchart TD
  subgraph S [Cluster]
    a
  end
  Start --> S
  S -->|first| T
  S -->|second| T
  S -->|third| T
  S -->|other| U
`).join('\n')
    expect(text.match(/◄/g)).toHaveLength(2) // second and third lanes
    expect(text.match(/▼/g)).toHaveLength(3) // Start->S, first, other
  })

  it('leaves a multi-member cluster where it was', () => {
    const out = render(`flowchart TD
  subgraph S [Cluster]
    a
    b
  end
  S --> X
  S --> Y
  S --> Z
`)
    expect(offBy(out, 'Cluster', 'Y')).toBeGreaterThan(1)
  })
})
