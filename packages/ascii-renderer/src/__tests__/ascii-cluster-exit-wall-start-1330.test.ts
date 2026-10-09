/**
 * A cluster exit (#1148, #1182) starts on the cluster's own flow-side wall,
 * not on the stand-in member's face (#1330): the member's border stays
 * intact and the wall carries the junctions, so the edge reads as
 * `Cluster --> T` rather than `a --> T`. Each exit has its own wall junction
 * (#1182), so two exits show two tees.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string, opts: Record<string, unknown> = {}): string[] =>
  renderMermaidASCII(src, { colorMode: 'none', ...opts })
    .split('\n')
    .map((l) => l.trimEnd())

const source = (dir: 'TD' | 'LR'): string => `flowchart ${dir}
  subgraph S [Cluster]
    a
  end
  Start --> S
  S -->|first| T
  S -->|other| U
`

describe('cluster exits start on the cluster wall (#1330)', () => {
  it('TD: the member keeps a plain bottom border and the wall carries the junction', () => {
    const lines = render(source('TD'))
    // a's bottom border: the box corner row inside the cluster. No tee.
    const memberBottom = lines.findIndex((l) => /^│ └─+┘ │$/.test(l))
    expect(memberBottom).toBeGreaterThan(-1)
    // The cluster's bottom wall is the next full-width border row below it.
    const wall = lines.findIndex(
      (l, i) => i > memberBottom && /^└─+┬─+┬─+┘$/.test(l),
    )
    expect(wall).toBeGreaterThan(memberBottom)
    // Nothing between the member and the wall carries the exit's stroke.
    for (const l of lines.slice(memberBottom + 1, wall)) {
      expect(l).not.toMatch(/[┬┼]/)
    }
    // Each stroke continues down from its wall junction: straight on, or
    // (the staircase bus, #1331) turning off along its own row.
    for (const col of [
      lines[wall]!.indexOf('┬'),
      lines[wall]!.lastIndexOf('┬'),
    ]) {
      expect(lines[wall + 1]![col]).toMatch(/[│└]/)
    }
    // Labels and arrowheads are unchanged: both targets are reached.
    expect(lines.join('\n')).toContain('first')
    expect(lines.join('\n')).toContain('other')
    expect(lines.join('\n').match(/▼/g)).toHaveLength(3) // Start->S, T, U
  })

  it('LR: the member keeps its right border and the wall carries the junction', () => {
    const lines = render(source('LR'))
    const row = lines.findIndex((l) => /│ a │/.test(l))
    expect(row).toBeGreaterThan(-1)
    // The member's row ends in the cluster wall, not a tee on the member.
    expect(lines[row]).toMatch(/│ a │ │/)
    expect(lines[row]).not.toMatch(/a ├/)
    // Two exits, so two tees on the wall.
    const wallCol = lines[row]!.indexOf('│ a │ │') + '│ a │ '.length
    expect(lines.filter((l) => l[wallCol] === '├')).toHaveLength(2)
  })

  it('ASCII mode: the member border is intact and the wall holds the only `+`', () => {
    const lines = render(source('TD'), { useAscii: true })
    const memberBottom = lines.findIndex((l) => /^\| \+-+\+ \|$/.test(l))
    expect(memberBottom).toBeGreaterThan(-1)
    const wall = lines.findIndex(
      (l, i) => i > memberBottom && /^\+-+\+-+\+-+\+$/.test(l),
    )
    expect(wall).toBeGreaterThan(memberBottom)
    // The wall has its two corners plus one junction per exit.
    expect(lines[wall]!.match(/\+/g)).toHaveLength(4)
  })

  it('a state-diagram pseudo-state stand-in also leaves through the wall', () => {
    const lines = render(`stateDiagram-v2
  state Processing {
    [*] --> execute
  }
  Processing --> Done: done
  Processing --> Error: fail
`)
    const wall = lines.findIndex((l) => /^└─+┬─+┬─+┘$/.test(l))
    expect(wall).toBeGreaterThan(-1)
    expect(lines.join('\n')).not.toMatch(/┼/)
  })

  it('LR in ASCII mode: the member border is intact and the wall holds the junction', () => {
    const lines = render(source('LR'), { useAscii: true })
    const row = lines.findIndex((l) => /\| a \|/.test(l))
    expect(row).toBeGreaterThan(-1)
    // The member's row ends in the wall, with no junction on the member.
    expect(lines[row]).toMatch(/\| a \| \|/)
    // One `+` junction on the wall per exit, each followed by its stroke.
    // Inside the cluster (after a `|` or `+`), a stroke follows its wall
    // junction: the staircase (#1331) gives each exit its own column, so the
    // nearer one is a short `+--+` rather than a three-dash `+---+` member.
    expect(lines.filter((l) => /[|+] \+-{2,}\+? {2,}/.test(l))).toHaveLength(2)
  })

  it.each([0, 3])('paddings %i: the exit still starts on the wall', (pad) => {
    for (const dir of ['TD', 'LR'] as const) {
      const out = render(source(dir), { paddingX: pad, paddingY: pad })
      expect(out.join('\n')).toMatch(dir === 'TD' ? /└─*┬─*┬─*┘/ : /├─+/)
      expect(out.join('\n')).toContain('first')
    }
  })
})
