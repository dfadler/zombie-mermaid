/**
 * LR/RL routes that mermaid@12.3.0 bends beside the target, not beside the source:
 * a back edge whose run has to clear another stroke of its source (`Git Branching
 * Workflow` G->A, `pass`) and a forward edge across more than one layer (`Edges
 * Into and Out of Subgraphs` B->Z). The search takes the shortest route, which
 * puts the riser or drop beside the source. (SVG has no analogue: this is the
 * grid's own routing.)
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { samples } from '../samples/samples-data.ts'
import { measureSample } from '../scripts/lib/ascii-topology.ts'

const sample = (title: string, dir: string): string =>
  samples
    .find((s) => s.title === title)!
    .source.replace(/^(graph|flowchart) \w+/, `$1 ${dir}`)

const draw = (source: string): string[] => {
  registerAsciiLayout(asciiLayoutProvider)
  try {
    return renderMermaidASCII(source, { colorMode: 'none' })
      .split('\n')
      .map((l) => l.trimEnd())
  } finally {
    registerAsciiLayout(undefined)
  }
}

describe('G->A in Git Branching Workflow (LR/RL)', () => {
  it.each(['LR', 'RL'])('%s: the pass return runs below every node', (d) => {
    const rows = draw(sample('Git Branching Workflow', d)).filter((l) =>
      l.trim(),
    )
    // The last row is the run; real mermaid@12.3.0 draws it at y 354, below F and G.
    expect(rows[rows.length - 1]).toMatch(/pass/)
    expect(rows[rows.length - 1]).toMatch(/[└┘]/)
  })

  it.each(['LR', 'RL'])('%s: only E->B and G->F keep a bend side', (d) => {
    const c = measureSample(sample('Git Branching Workflow', d))
    // E->B (ends share one slot, so both legs are as long) and G->F (a lane
    // of the F<->G pair) are not placed yet; G->A was a third miss.
    expect(c.bends - c.bendOk).toBe(2)
  })
})

describe('B->Z in Edges Into and Out of Subgraphs (LR/RL)', () => {
  it('LR: the drop sits beside Audit, with a stub for the arrowhead', () => {
    const text = draw(sample('Edges Into and Out of Subgraphs', 'LR')).join(
      '\n',
    )
    expect(text).toMatch(/┌─►│ Audit/)
  })

  it('RL: mirrors', () => {
    const text = draw(sample('Edges Into and Out of Subgraphs', 'RL')).join(
      '\n',
    )
    expect(text).toMatch(/Audit │◄─┐/)
  })

  it('LR: the drop keeps clear of the other strokes', () => {
    const rows = draw(sample('Edges Into and Out of Subgraphs', 'LR'))
    // Cluster -> X and Y still reach their nodes.
    expect(rows.join('\n')).toContain('►│ Cache')
    expect(rows.join('\n')).toContain('►│  Log')
  })
})
