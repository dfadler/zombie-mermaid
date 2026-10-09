/**
 * #1331: cluster exits used to share one gutter bus, so with 3+ siblings it
 * was hard to tell which drop belonged to which label. Each exit now turns off
 * the stub on a track of its own (a staircase), farthest target first.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const source = (dir: 'TD' | 'LR', labels: string[]): string =>
  `flowchart ${dir}
  subgraph S [Cluster]
    a
  end
` + labels.map((l, i) => `  S -->|${l}| ${'XYZW'[i]}\n`).join('')

const render = (src: string, useAscii: boolean): string[] =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })
    .split('\n')
    .map((l) => l.trimEnd())

describe('cluster-exit staircase bus (#1331)', () => {
  for (const useAscii of [false, true]) {
    const kind = useAscii ? 'ascii' : 'unicode'

    it(`TD: ${kind}, every sibling's label sits on its own row`, () => {
      for (const labels of [
        ['one', 'two'],
        ['one', 'two', 'three'],
        ['one', 'two', 'three', 'four'],
      ]) {
        const lines = render(source('TD', labels), useAscii)
        const rows = labels.map((l) => lines.findIndex((r) => r.includes(l)))
        for (const row of rows) expect(row).toBeGreaterThan(-1)
        expect(new Set(rows).size).toBe(labels.length)
      }
    })

    it(`LR: ${kind}, every sibling's label sits in its own column`, () => {
      const labels = ['one', 'two', 'three']
      const lines = render(source('LR', labels), useAscii)
      const cols = labels.map((l) => {
        const line = lines.find((r) => r.includes(l))!
        return line.indexOf(l)
      })
      expect(new Set(cols).size).toBe(labels.length)
      // The bus verticals are one column apiece, not a shared one.
      if (useAscii) return
      const bend = '┐'
      const bendCols = new Set(
        lines.flatMap((r) =>
          [...r].flatMap((ch, i) => (ch === bend && i > 12 ? [i] : [])),
        ),
      )
      expect(bendCols.size).toBeGreaterThanOrEqual(2)
    })

    it(`TD: ${kind}, every sibling still reaches its target`, () => {
      const out = render(source('TD', ['one', 'two', 'three']), useAscii)
      const head = useAscii ? 'v' : '▼'
      const arrows = out.join('\n').split(head).length - 1
      expect(arrows).toBe(3)
    })
  }
})
