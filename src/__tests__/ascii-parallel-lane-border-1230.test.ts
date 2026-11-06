/**
 * Regression tests for #1230: the second parallel edge between two plain
 * nodes (`a -->|first| T` then `a -->|second| T`) used to run its last leg
 * along the target's own border, drawing a stray arrowhead and junction on
 * the border cell (`┌────◄──┬────┘` in TD, `▲`/`├` on the left border in LR).
 * Later lanes now run down/under the nodes and enter the target's side face
 * (right in TD, bottom in LR) with their own arrowhead, so the target's
 * border stays a plain box edge and every edge visibly ends at the target.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const lanes = (dir: 'TD' | 'LR', count: number): string =>
  [
    `flowchart ${dir}`,
    '  Start --> a',
    ...['first', 'second', 'third', 'fourth']
      .slice(0, count)
      .map((label) => `  a -->|${label}| T`),
  ].join('\n')

function render(source: string, useAscii: boolean): string[] {
  return renderMermaidASCII(source, { colorMode: 'none', useAscii }).split('\n')
}

/** The rendered rows of the box that contains `label` (top border .. bottom). */
function boxRows(lines: string[]): string[] {
  const mid = lines.findIndex((l) => /[│|]   T   [│|]/.test(l))
  expect(mid).toBeGreaterThan(0)
  return lines.slice(mid - 2, mid + 3)
}

describe('parallel lanes keep the target border clean (#1230)', () => {
  // Two labeled edges now draw side by side instead (#1455); three whose
  // labels are too wide for that take the flow faces (#2736), so the target's
  // border stays plain and each edge ends on its own arrowhead above it.
  for (const useAscii of [false, true]) {
    it(`TD, 3 lanes${useAscii ? ', ASCII mode' : ''}: the target border stays a plain box edge`, () => {
      const lines = render(lanes('TD', 3), useAscii)
      const rows = boxRows(lines)
      expect(rows[0]).toMatch(useAscii ? /^ *\+-+\+ *$/ : /^ *┌─+┐ *$/)
      const text = lines.join('\n')
      expect(text).not.toMatch(/[◄<]/)
      expect(text.match(useAscii ? /v/g : /▼/g)?.length).toBe(4)
    })
  }

  // Four or more take the facing faces instead (#2645): a port each, the
  // target's side faces stay plain box edges.
  it('TD, 4 lanes: every edge lands on the target top face', () => {
    for (const useAscii of [false, true]) {
      const text = render(lanes('TD', 4), useAscii).join('\n')
      expect(text.match(useAscii ? /v/g : /▼/g)).toHaveLength(5)
      expect(text).not.toMatch(useAscii ? /</ : /◄/)
    }
  })

  for (const count of [3, 4]) {
    it(`LR, ${count} lanes: later lanes run under the nodes and enter the target's bottom face with their own arrowhead`, () => {
      const lines = render(lanes('LR', count), false)
      const text = lines.join('\n')
      expect(text.match(/▲/g)).toHaveLength(count - 1)
      // The target's left border stays a plain box edge.
      const row = lines.find((l) => l.includes('│ T │'))!
      const col = row.indexOf('│ T │')
      const top = lines.findIndex((l) => l.includes('┌───┐', col))
      const bottom = lines.findIndex((l) => l.includes('└───┘', col))
      for (const line of lines.slice(top, bottom + 1)) {
        expect('┌│└').toContain(line[col]!)
      }
      // Each arrowhead sits directly under T's bottom border, in a column of
      // its own (#2025).
      const under = [...lines[bottom + 1]!.slice(col + 1, col + 4)]
      expect(under.filter((c) => c === '▲')).toHaveLength(count - 1)
    })
  }
})
