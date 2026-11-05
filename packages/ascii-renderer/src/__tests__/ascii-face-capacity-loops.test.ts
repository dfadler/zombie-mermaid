/**
 * Duplicate/reciprocal lanes beside self-loops and back-edges: the face that
 * takes the lane ends must be long enough for one cell per end, so no two
 * ends merge into one stem or arrowhead (a loop end joining a lane stem as
 * a tee, two lanes meeting at one ┴).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

describe('face capacity counts self-loops and back-edges', () => {
  it('reciprocal lanes plus loops keep every end on its own stem', () => {
    const out = renderMermaidASCII(
      'flowchart LR\n a-->b\n b-->a\n a-->b\n b-->a\n b-->b\n a-->a',
    )
    // A lane/loop merge draws a tee in the middle of a vertical run.
    expect(out).not.toMatch(/│[├┤]|[├┤]│/)
  })

  it('a back-edge and sibling lanes into one node get a row each', () => {
    const out = renderMermaidASCII(
      'flowchart TD\n n0\n n1\n n2\n n2-->n0\n n1-->n1\n n1-->n1\n n1-->n0\n n0-->n1\n n1-->n0\n n1-->n0\n n0-->n1\n n1-->n2\n n1-->n2\n n1-->n2\n n1-->n2',
    )
    expect(out).not.toMatch(/┴─+┘/)
  })
})

describe('dense reciprocal group between facing faces (#2645)', () => {
  const src =
    'flowchart RL\n  n0["n0"]\n  n1["n1"]\n  n1 --> n0\n  n0 --> n1\n  n1 --> n0\n  n1 --> n0\n  n1 --> n1\n  n0 --> n0\n  n0 --> n1\n  n1 --> n0\n  n0 --> n1\n  n0 --> n1'

  it('pairs the edges each way on one stroke per row, heads at both ends', () => {
    const out = renderMermaidASCII(src)
    // Four rows, each ◄───► : every edge end keeps a cell and an arrowhead.
    expect(out.match(/►/g)).toHaveLength(4)
    expect(out.match(/◄/g)).toHaveLength(4)
    expect(out.split('\n').filter((l) => /◄─+►/.test(l))).toHaveLength(4)
    // Nothing runs under the nodes.
    expect(out.split('\n').at(-1)).toMatch(/^└─+┘\s+└─+┘$/)
  })

  it('puts the self-loops on top, above the nodes', () => {
    const out = renderMermaidASCII(src)
    const lines = out.split('\n')
    const firstBox = lines.findIndex((l) => l.includes('┴'))
    expect(firstBox).toBeGreaterThan(0)
    expect(lines.slice(0, firstBox).join('')).toMatch(/▼/)
  })
})
