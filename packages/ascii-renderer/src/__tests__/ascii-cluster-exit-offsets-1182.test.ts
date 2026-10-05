/**
 * Per-edge cluster-exit offsets (#1182). Real mermaid clips every edge that
 * leaves a cluster at its own point on the cluster border; the planner's
 * shared stub (#1148) put every exit on one wall cell. Each exit now starts
 * at its own cell on the flow-side wall, nearest its target and in target
 * order so the strokes never cross. This is drawn, not routed: the shared
 * stub still reserves the cells, so occupancy and routing are unchanged.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string, opts: Record<string, unknown> = {}): string[] =>
  renderMermaidASCII(src, { colorMode: 'none', ...opts })
    .split('\n')
    .map((l) => l.trimEnd())

const twin = (first: string, second: string): string => `flowchart TD
  subgraph S [Cluster]
    a
  end
  Start --> S
  S --> ${first}
  S --> ${second}
`

/** The cluster's bottom wall: the last `└──┬──┬──┘` style row. */
const wallRow = (lines: string[]): number =>
  lines.findLastIndex((l) => /^└[─┬]+┘$/.test(l))

describe('cluster exits leave at their own wall cell (#1182)', () => {
  it('TD: two exits get two junctions, left target on the left', () => {
    const lines = render(twin('T', 'U'))
    const wall = wallRow(lines)
    expect(wall).toBeGreaterThan(-1)
    const first = lines[wall]!.indexOf('┬')
    const second = lines[wall]!.lastIndexOf('┬')
    expect(second).toBeGreaterThan(first)
    // T is the left target: its stroke drops straight to the arrowhead, U's
    // turns right on the gutter row.
    expect(lines[wall + 1]![first]).toBe('│')
    expect(lines[wall + 1]![second]).toBe('└')
    const arrows = lines.findIndex((l) => (l.match(/▼/g) ?? []).length === 2)
    expect(lines[arrows]![first]).toBe('▼')
  })

  it('the junction order follows the target order, so strokes never cross', () => {
    const lines = render(`flowchart TD
  subgraph S [Cluster]
    a
  end
  T
  S --> U
  S --> T
`)
    const targets = lines.findIndex((l) => /U/.test(l) && /T/.test(l))
    const uCol = lines[targets]!.indexOf('U')
    const tCol = lines[targets]!.indexOf('T')
    const arrows = lines.findIndex((l) => (l.match(/▼/g) ?? []).length === 2)
    const left = lines[arrows]!.indexOf('▼')
    const right = lines[arrows]!.lastIndexOf('▼')
    // The target placed left (U) is reached by the left arrowhead.
    expect(Math.abs(left - uCol)).toBeLessThanOrEqual(2)
    expect(Math.abs(right - tCol)).toBeLessThanOrEqual(2)
    // The run out to the right target starts at the right junction and no
    // other run passes through it: the left stroke ends in the left column.
    const wall = wallRow(lines)
    const first = lines[wall]!.indexOf('┬')
    const second = lines[wall]!.lastIndexOf('┬')
    expect(second).toBeGreaterThan(first)
    expect(lines[wall + 1]!.indexOf('┐', second)).toBe(right)
    expect(lines[wall + 1]![second]).toBe('└')
  })

  it('a label sits on its own run, clear of the exit’s corner', () => {
    const lines = render(`flowchart TD
  subgraph S [Cluster]
    a
  end
  Start --> S
  S -->|first| T
  S -->|other| U
`)
    // The corner is drawn right before the label's run, not under the text.
    expect(lines.join('\n')).toMatch(/└─+other─+┐/)
  })

  it('LR mirror: two tees on the right wall, on different rows', () => {
    const lines = render(`flowchart LR
  subgraph S [Cluster]
    a
  end
  Start --> S
  S --> T
  S --> U
`)
    const aRow = lines.findIndex((l) => /│ a │/.test(l))
    const wallCol = lines[aRow]!.indexOf('│', lines[aRow]!.indexOf('a │') + 3)
    const tees = lines.flatMap((l, row) => (l[wallCol] === '├' ? [row] : []))
    expect(tees).toHaveLength(2)
    expect(new Set(tees).size).toBe(2)
    // The member keeps its own border.
    expect(lines[aRow]).not.toMatch(/a ├/)
  })

  it('ASCII mode: a straight exit has no stray `+` where it passes the gutter', () => {
    const lines = render(twin('T', 'U'), { useAscii: true })
    const wall = lines.findLastIndex((l) => /^\+-+\+-+\+-*\+$/.test(l))
    expect(wall).toBeGreaterThan(-1)
    const col = lines[wall]!.indexOf('+', 1)
    const arrow = lines.findIndex((l, i) => i > wall && l[col] === 'v')
    expect(arrow).toBeGreaterThan(wall)
    for (const l of lines.slice(wall + 1, arrow)) expect(l[col]).toBe('|')
  })

  it('a landing that meets a routed corner draws no stray corner glyph', () => {
    // Outer's exit to F lands on the row F's centre sits on, so the drawn
    // stroke runs straight out; a zero-length run there once drew a `┌`.
    const lines = render(`flowchart LR
  subgraph Outer [A very long outer label here]
    subgraph Inner [Inner label]
      a
    end
    b --> z
  end
  Inner --> C
  Inner --> D
  Outer --> E
  Outer --> F
`)
    const fRow = lines.find((l) => /│ F │/.test(l))!
    expect(fRow).toMatch(/├─+►│ F │/)
  })

  it('a wall too narrow to give every exit its own cell keeps the shared tee', () => {
    const lines = render(`flowchart TD
  subgraph S [C]
    a
  end
  S --> T
  S --> U
  S --> V
  S --> W
  S --> X
`)
    const wall = wallRow(lines)
    expect(lines[wall]!.match(/┬/g)).toHaveLength(1)
    // The shared bus still reaches all five targets.
    expect(lines.join('\n').match(/▼/g)).toHaveLength(5)
  })

  it('three exits get three junctions in target order', () => {
    const lines = render(`flowchart TD
  subgraph S [Cluster]
    a
  end
  Start --> S
  S -->|one| T
  S -->|two| U
  S -->|three| V
`)
    const wall = wallRow(lines)
    const cols = [...lines[wall]!.matchAll(/┬/g)].map((m) => m.index!)
    expect(cols).toHaveLength(3)
    expect(cols).toEqual([...cols].sort((a, b) => a - b))
    for (const label of ['one', 'two', 'three']) {
      expect(lines.join('\n')).toContain(label)
    }
  })
})
