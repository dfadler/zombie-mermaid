/**
 * Cluster-exit siblings (several edges from one subgraph to one node straight
 * ahead of it) enter the target's flow-side face left to right in source
 * order, as mermaid@12.3.0 draws them (#2737), not its side faces.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../index.ts'
import { checkAll } from '../../../../__tests__/helpers/ascii-invariants.ts'

const src = (n: number, label = true, dir = 'TD'): string =>
  `flowchart ${dir}
  subgraph S [Cluster]
    a
  end
  Start --> S
${Array.from({ length: n }, (_, i) => `  S -->${label ? `|${i + 1}|` : ''} T`).join('\n')}`

/** The output below the cluster's member `a`: the exits and the target. */
const below = (out: string): string[] => {
  const lines = out.split('\n')
  return lines.slice(lines.findIndex((l) => /\ba\b/.test(l)))
}

const render = (s: string, useAscii = false): string =>
  renderMermaidASCII(s, { colorMode: 'none', useAscii })

describe('cluster-exit siblings use the target flow face (#2737)', () => {
  it.each([3, 4, 5, 9])('%i labelled siblings: top face, in order', (n) => {
    for (const useAscii of [false, true]) {
      const out = render(src(n), useAscii)
      const lines = below(out)
      const labels = lines.findIndex((l) => l.includes(`${n}`))
      // One row of labels, left to right 1..n.
      expect(lines[labels]!.replace(/\s+/g, '')).toBe(
        Array.from({ length: n }, (_, i) => i + 1).join(''),
      )
      // Every head sits on the row above T's top border, none beside T.
      const heads = useAscii ? /v/g : /▼/g
      const headRows = lines.filter((l) => (l.match(heads) ?? []).length > 0)
      expect(headRows).toHaveLength(1)
      expect(headRows[0]!.match(heads)).toHaveLength(n)
      expect(lines.some((l) => /[◄►]/.test(l) || /[<>]/.test(l))).toBe(false)
      expect(checkAll(out, { unicode: !useAscii })).toEqual([])
    }
  })

  it('draws the same strokes without labels', () => {
    const out = below(render(src(3, false))).join('\n')
    expect(out.match(/▼/g)).toHaveLength(3)
    expect(out).not.toMatch(/[◄►]/)
  })

  it('keeps the side faces for a wide label', () => {
    const out = render(src(3).replace('|2|', '|second|'))
    expect(out).toMatch(/[◄►]/)
  })
})
