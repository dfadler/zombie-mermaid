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
  for (const count of [2, 3, 4]) {
    it(`TD, ${count} lanes: later lanes enter the target's right face with their own arrowhead`, () => {
      const lines = render(lanes('TD', count), false)
      const rows = boxRows(lines)
      // The top border is a plain box edge; the lanes arrive at the right face.
      expect(rows[0]!.trim().slice(0, 9)).toBe('┌───────┐')
      expect(rows[2]!.trim()).toMatch(/^│ {3}T {3}│◄[─┬┴┤┘┐┼]+$/)
      expect(lines.join('\n').match(/◄/g)).toHaveLength(1)
      expect(lines.join('\n').match(/▼/g)).toHaveLength(2)
    })

    it(`TD, ${count} lanes, ASCII mode: later lanes enter the target's right face with their own arrowhead`, () => {
      const lines = render(lanes('TD', count), true)
      const rows = boxRows(lines)
      expect(rows[0]!.trim().slice(0, 9)).toBe('+-------+')
      expect(rows[2]!.trim()).toMatch(/^\| {3}T {3}\|<[-+]+$/)
      expect(lines.join('\n').match(/</g)).toHaveLength(1)
    })
  }

  for (const count of [2, 3]) {
    it(`LR, ${count} lanes: later lanes run under the nodes and enter the target's bottom face with their own arrowhead`, () => {
      const lines = render(lanes('LR', count), false)
      const text = lines.join('\n')
      expect(text.match(/▲/g)).toHaveLength(1)
      // The target's left border stays a plain box edge.
      const row = lines.find((l) => l.includes('│ T │'))!
      const col = row.indexOf('│ T │')
      const top = lines.findIndex((l) => l.includes('┌───┐', col))
      const bottom = lines.findIndex((l) => l.includes('└───┘', col))
      for (const line of lines.slice(top, bottom + 1)) {
        expect('┌│└').toContain(line[col]!)
      }
      // The arrowhead sits directly under T's bottom border, in T's centre column.
      expect(lines[bottom + 1]![col + 2]).toBe('▲')
    })
  }
})
