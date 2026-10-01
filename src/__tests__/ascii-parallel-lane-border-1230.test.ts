/**
 * Regression tests for #1230: the second parallel edge between two plain
 * nodes (`a -->|first| T` then `a -->|second| T`) used to run its last leg
 * along the target's own border, drawing a stray arrowhead and junction on
 * the border cell (`┌────◄──┬────┘` in TD, `▲`/`├` on the left border in LR).
 * The lane now ends with the same one-cell approach every other edge makes
 * into its target, so the target's border stays a plain box edge.
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
    it(`TD, ${count} lanes: the target's top border is a plain box edge`, () => {
      const lines = render(lanes('TD', count), false)
      expect(lines.join('\n')).not.toContain('◄')
      const rows = boxRows(lines)
      expect(rows[0]!.trim()).toBe('┌───────┐')
      // Every lane arrives through one arrowhead above the border.
      expect(lines.join('\n').match(/▼/g)).toHaveLength(2)
    })

    it(`TD, ${count} lanes, ASCII mode: the target's top border is a plain box edge`, () => {
      const lines = render(lanes('TD', count), true)
      expect(lines.join('\n')).not.toContain('<')
      expect(boxRows(lines)[0]!.trim()).toBe('+-------+')
    })
  }

  for (const count of [2, 3]) {
    it(`LR, ${count} lanes: the target's left border carries no arrowhead or junction`, () => {
      const lines = render(lanes('LR', count), false)
      const text = lines.join('\n')
      expect(text).not.toContain('▲')
      const row = lines.find((l) => l.includes('│ T │'))!
      const col = row.indexOf('│ T │')
      for (const line of lines) {
        const ch = line[col]
        if (ch !== undefined && ch !== ' ') {
          expect('┌│└').toContain(ch)
        }
      }
    })
  }
})
