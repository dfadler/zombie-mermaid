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
