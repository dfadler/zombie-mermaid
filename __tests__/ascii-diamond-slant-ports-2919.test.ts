/**
 * #2919: in a top-down flow a decision with four or more edges on its bottom
 * face gives each its own cell of the lower slants, as mermaid@12.3.0 draws
 * `Decision Self-Loop with Duplicate Edges`: four strokes and the return's
 * arrowhead leave side by side, none merged into another's stem.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'

const draw = (source: string): string => {
  registerAsciiLayout(asciiLayoutProvider)
  try {
    return renderMermaidASCII(source, { layoutHints: true } as never)
  } finally {
    registerAsciiLayout(undefined)
  }
}

const sample = (dir: 'TD' | 'BT'): string => `flowchart ${dir}
    n0{"gSQ21Q"}
    n1["C"]
    n2(["OkfK"])
    n0 --> n0
    n0 --> n2
    n0 --> n2
    n0 --> n1
    n1 -->|000A| n0
    n0 --> n1`

describe('a decision’s lower slants each take a stroke (#2919)', () => {
  it('four strokes and the return arrowhead sit side by side under the vertex', () => {
    const lines = draw(sample('TD')).split('\n')
    const vertex = lines.findIndex((l) => l.includes('╲┬╱'))
    expect(vertex).toBeGreaterThan(0)
    // The strokes start beside the vertex glyphs, one cell each
    expect(lines[vertex]).toMatch(/│╲┬╱/)
    expect(lines[vertex + 1]).toMatch(/││▲│/)
  })

  it('no stroke merges into another on the way down', () => {
    const out = draw(sample('TD'))
    // A shared stem would print a tee or cross right under the vertex
    const lines = out.split('\n')
    const vertex = lines.findIndex((l) => l.includes('╲┬╱'))
    expect(lines[vertex + 1]).not.toMatch(/[├┤┬┴┼]/)
  })

  it('BT is the mirror of TD', () => {
    const td = draw(sample('TD')).split('\n')
    const bt = draw(sample('BT')).split('\n')
    expect(bt.join('\n')).toContain('▼')
    expect(bt.some((l) => /│╱┴╲/.test(l) || /╱┴╲/.test(l))).toBe(true)
    expect(bt.length).toBe(td.length)
  })

  it('a lone pair keeps the shared-stem routing', () => {
    const src = 'flowchart TD\n  d{"d"} --> a\n  d --> a'
    registerAsciiLayout(undefined)
    const plain = renderMermaidASCII(src)
    expect(draw(src)).toBe(plain)
  })
})
