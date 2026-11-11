/**
 * #2913: a decision with several edges on its flow face gives each its own
 * slant, as mermaid@12.3.0 draws it (GitHub's render of `Decision Self-Loop with
 * Duplicate Edges`): no edge merges into another's stem, none crosses another.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'

const draw = (source: string, useAscii = false): string => {
  registerAsciiLayout(asciiLayoutProvider)
  try {
    return renderMermaidASCII(source, {
      layoutHints: true,
      useAscii,
    } as never)
  } finally {
    registerAsciiLayout(undefined)
  }
}

// The gallery sample: a decision with two edges to one node, two to another,
// a return edge into it and a loop on it
const SAMPLE = `flowchart LR
    n0{"gSQ21Q"}
    n1["C"]
    n2(["OkfK"])
    n3("Q552S")
    n0 --> n0
    n0 --> n2
    n0 --> n2
    n0 --> n1
    n1 -->|000A| n0
    n0 --> n1`

describe('a decision’s edges each take their own slant (#2913)', () => {
  it('the three edges between the decision and C run on rows of their own', () => {
    const lines = draw(SAMPLE).split('\n')
    const into = lines.filter((l) => /►│ {3}│|►│ C │/.test(l))
    // Two arrows into C, one arrow back into the decision, no junction glyph
    expect(into).toHaveLength(2)
    expect(lines.filter((l) => /◄─+000A/.test(l))).toHaveLength(1)
    expect(
      lines.filter((l) => /> ?[─◄]/.test(l) || /╱─|╲─|╲◄/.test(l)),
    ).not.toHaveLength(0)
  })

  it('no stroke joins or crosses another: no ┼ ┬ ┴ in the drawing', () => {
    expect(draw(SAMPLE)).not.toMatch(/[┼┬┴]/u)
  })

  it('works with ASCII borders: strokes leave the decision’s slants', () => {
    const out = draw(SAMPLE, true)
    expect(
      out.split('\n').filter((l) => /[/\\]-{3,}/.test(l)).length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('both edges to OkfK enter its left face on rows of their own (ELK’s face)', () => {
    const lines = draw(SAMPLE).split('\n')
    // Two arrows into the stadium's left side, one row apart or more, none into
    // its bottom or right side
    const into = lines.filter((l) => /►\(/.test(l))
    expect(into).toHaveLength(2)
    expect(lines.some((l) => /\)\s*$/.test(l) && l.includes('◄'))).toBe(false)
    expect(lines.some((l) => /▲/.test(l))).toBe(false)
  })

  it('four edges arriving at a decision from its left take a row each', () => {
    const out = draw(
      'flowchart LR\n  a --> d{"decide"}\n  a --> d\n  a --> d\n  a --> d\n  d --> b',
    )
    // Each arrow has a row of its own: none shares a stem with another
    expect(out.split('\n').filter((l) => l.includes('►'))).toHaveLength(5)
    expect(out).not.toMatch(/[┬┴┼]/u)
  })

  it('a pair of edges keeps the shared-stem routing', () => {
    const src = 'flowchart LR\n  d{"d"} --> a\n  a --> d'
    expect(draw(src)).toBe(
      (() => {
        registerAsciiLayout(undefined)
        return renderMermaidASCII(src)
      })(),
    )
  })
})
