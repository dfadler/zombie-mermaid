/**
 * Regression tests for #1310 — an edge between a node and a subgraph that
 * contains it (`B --> Sub`, B inside Sub; real mermaid.js 11.17.2 draws no line for it either) used to be redirected to the
 * cluster's entry member and routed as a back-edge along the frame's bottom
 * wall, overwriting the border. It is now dropped.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const base = `graph TD
X-->Sub
Q-->B
subgraph Sub
A-->B
end`

function bottomWall(source: string): string {
  const rows = renderMermaidASCII(source).split('\n')
  for (let i = rows.length - 1; i >= 0; i--) {
    if (/^└/.test(rows[i]!)) return rows[i]!.trimEnd()
  }
  throw new Error(`no bottom wall in:\n${rows.join('\n')}`)
}

describe('ASCII: an edge from inside a subgraph to its own id (#1310)', () => {
  it('leaves the bottom wall as an unbroken border', () => {
    expect(bottomWall(`${base}\nB-->Sub`)).toMatch(/^└─+┘$/)
  })

  it('renders identically to the same diagram without that edge', () => {
    expect(renderMermaidASCII(`${base}\nB-->Sub`)).toBe(
      renderMermaidASCII(base),
    )
  })

  it('also drops the entry member and the Sub --> member direction', () => {
    expect(renderMermaidASCII(`${base}\nA-->Sub`)).toBe(
      renderMermaidASCII(base),
    )
    expect(renderMermaidASCII(`${base}\nSub-->B`)).toBe(
      renderMermaidASCII(base),
    )
  })

  it('drops an edge to an enclosing subgraph through a nested one', () => {
    const nested = `graph TD
subgraph Outer
subgraph Inner
A-->B
end
end`
    expect(renderMermaidASCII(`${nested}\nB-->Outer`)).toBe(
      renderMermaidASCII(nested),
    )
  })

  it('drops an edge between a subgraph and a subgraph nested in it', () => {
    const nested = `graph TD
A-->B
subgraph Outer
subgraph Inner
B
end
end`
    expect(renderMermaidASCII(`${nested}\nOuter-->Inner`)).toBe(
      renderMermaidASCII(nested),
    )
  })

  it('keeps an edge from outside the subgraph', () => {
    expect(renderMermaidASCII(`${base}\nZ-->Sub`)).not.toBe(
      renderMermaidASCII(base),
    )
  })

  it('keeps an edge between two subgraph ids', () => {
    const two = `graph TD
subgraph One
A
end
subgraph Two
B
end`
    expect(renderMermaidASCII(`${two}\nOne-->Two`)).not.toBe(
      renderMermaidASCII(two),
    )
  })
})
