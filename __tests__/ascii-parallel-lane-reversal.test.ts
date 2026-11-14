/**
 * Two pairs of parallel edges leave one decision for two boxes (`flowchart BT`,
 * `n3 -.->|VW| n2`, `n3 ---|38| n2`, `n3 -->|Fp| n1`, `n3 ==>|Zq| n1`). With
 * ELK's hints the second edge to the box on the left took a lane that ran out
 * to the right of both ends and back along its own row, where it met the other
 * pair's lane: the reversal drew as a stray `+`, and a lane that doubled back
 * over a node's text overwrote it. mermaid@12.3.0 draws four separate strokes.
 * `buildParallelLanePath` now runs the jog toward the target when another edge
 * of the node already heads the other way. One SVG and ASCII golden per case.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { renderMermaidSVG } from '../packages/svg-renderer/src/index.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'

const draw = (source: string, useAscii = false): string => {
  registerAsciiLayout(asciiLayoutProvider)
  try {
    return renderMermaidASCII(source, { colorMode: 'none', useAscii })
  } finally {
    registerAsciiLayout(undefined)
  }
}

const decision = (dir: 'TD' | 'BT'): string => `flowchart ${dir}
  n1["F1"]
  n2["l2"]
  n3{"3D"}
  n3 -.->|VW| n2
  n3 ---|38| n2
  n3 -->|Fp| n1
  n3 ==>|Zq| n1`

// A rounded node under a box, the third edge between the two: the lane must not
// run over the text of either.
const nodeText = `flowchart BT
  n0("z7b")
  n1["9h0"]
  n0 --> n1
  n0 --> n0
  n1 -.-> n0
  n1 --> n0`

describe('a parallel lane that would double back along its own row', () => {
  for (const dir of ['TD', 'BT'] as const) {
    it(`${dir}: four labelled edges, no stray + and every label whole`, () => {
      const out = draw(decision(dir))
      expect(out).not.toContain('+')
      for (const label of ['VW', '38', 'Fp', 'Zq']) expect(out).toContain(label)
      // `-->`, `-.->` and `==>` end in an arrowhead; `---` has none
      const arrows = [...out].filter((c) => '▲▼◄►'.includes(c)).length
      expect(arrows).toBe(3)
    })
  }

  it('leaves the text of both nodes whole', () => {
    const out = draw(nodeText)
    expect(out).toContain('9h0')
    expect(out).toContain('z7b')
  })

  it('snapshots SVG and ASCII (unicode and ASCII-only), TD and BT', () => {
    for (const dir of ['TD', 'BT'] as const) {
      expect(renderMermaidSVG(decision(dir))).toMatchSnapshot(`svg-${dir}`)
      expect(draw(decision(dir))).toMatchSnapshot(`ascii-${dir}`)
      expect(draw(decision(dir), true)).toMatchSnapshot(`ascii-only-${dir}`)
    }
    expect(renderMermaidSVG(nodeText)).toMatchSnapshot('svg-node-text')
    expect(draw(nodeText)).toMatchSnapshot('ascii-node-text')
  })
})
