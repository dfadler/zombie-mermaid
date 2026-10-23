/**
 * The rest of the lane limits left by #2080 (#1826, #1689, #1743):
 * a stacked (TD/BT) forward and back group sharing the target's side faces, a
 * subgraph whose only exit is the lane group, and eight or more edges from one
 * subgraph to one target (the target's face grows). #1743's three-edge repro
 * and the 'half a row short' arrowheads of #1689 are pinned too.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../index.ts'
import {
  checkAll,
  toGrid,
} from '../../../../__tests__/helpers/ascii-invariants.ts'

type Dir = 'TD' | 'LR' | 'BT' | 'RL'
const render = (src: string, useAscii = false): string =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })

const heads = (out: string, useAscii = false): number =>
  (out.match(useAscii ? /[<>^v]/g : /[▲▼◄►]/g) ?? []).length

const violations = (out: string, useAscii = false): string[] =>
  checkAll(out, { unicode: !useAscii }).map((v) => v.message)

const pair = (dir: Dir, fw: number, bw: number): string =>
  `flowchart ${dir}\n` +
  Array.from({ length: fw }, (_, i) => `  A -->|f${i}| B`).join('\n') +
  '\n' +
  Array.from({ length: bw }, (_, i) => `  B -->|b${i}| A`).join('\n')

const cluster = (dir: Dir, n: number, other: boolean): string =>
  `flowchart ${dir}
  subgraph S [Cluster]
    a
  end
  Start --> S
${Array.from({ length: n }, (_, i) => `  S -->|${i + 1}| T`).join('\n')}${
    other ? '\n  S -->|other| U' : ''
  }`

describe('forward and back groups between one pair (#1826)', () => {
  it.each([
    [4, 2],
    [3, 3],
    [2, 4],
    [5, 3],
    [6, 6],
  ] as const)('%i forward + %i back keep one arrowhead each', (fw, bw) => {
    for (const dir of ['TD', 'BT'] as const) {
      for (const useAscii of [false, true]) {
        const out = render(pair(dir, fw, bw), useAscii)
        expect(violations(out, useAscii)).toEqual([])
        expect(heads(out, useAscii)).toBe(fw + bw)
      }
    }
  })
})

describe('a cluster whose only exit is the lane group (#1826)', () => {
  it.each([3, 4, 7])('TD/LR/BT/RL: %i siblings keep one head each', (n) => {
    for (const dir of ['TD', 'LR', 'BT', 'RL'] as const) {
      const out = render(cluster(dir, n, false))
      expect(violations(out)).toEqual([])
      expect(heads(out)).toBe(n + 1)
    }
  })

  it('two siblings keep ordinary routing', () => {
    const out = render(cluster('TD', 2, false))
    expect(heads(out)).toBe(3)
    // No stub bus: the exit leaves the cluster straight down.
    expect(out).not.toContain('├──────┬')
  })
})

describe('eight or more siblings out of one cluster (#1689, #1826)', () => {
  // 30 s timeout: 16 renders per case, 2-7 s alone and slower under full-suite
  // load; the 5 s default timed out in `pnpm test` (#1825).
  it.each([8, 9, 10, 12])(
    '%i siblings keep one head each',
    { timeout: 30_000 },
    (n) => {
      for (const dir of ['TD', 'LR', 'BT', 'RL'] as const) {
        for (const other of [true, false]) {
          for (const useAscii of [false, true]) {
            const out = render(cluster(dir, n, other), useAscii)
            expect(violations(out, useAscii)).toEqual([])
            expect(heads(out, useAscii)).toBe(n + 1 + (other ? 1 : 0))
          }
        }
      }
    },
  )
})

describe('#1743 and #1689 repros', () => {
  it('three labeled edges A to B: three arrowheads', () => {
    const src = `flowchart TD
    A -->|first| B
    A -->|second| B
    A -->|third| B`
    for (const useAscii of [false, true]) {
      const out = render(src, useAscii)
      expect(violations(out, useAscii)).toEqual([])
      expect(heads(out, useAscii)).toBe(3)
    }
  })

  // 'Half a row short' (#1689) is how agg rasterises the glyph: in the
  // character grid every arrowhead sits in the cell next to the border it
  // points at.
  it.each([cluster('TD', 5, true), cluster('TD', 9, true), pair('TD', 4, 2)])(
    'every arrowhead is directly beside a border cell',
    (src) => {
      const grid = toGrid(render(src))
      const step: Record<string, [number, number]> = {
        '▼': [0, 1],
        '▲': [0, -1],
        '◄': [-1, 0],
        '►': [1, 0],
      }
      let seen = 0
      grid.forEach((row, y) =>
        row.forEach((ch, x) => {
          const d = step[ch]
          if (!d) return
          seen++
          const next = grid[y + d[1]]?.[x + d[0]] ?? ' '
          expect('│┤├┼┬┴─┘└┐┌').toContain(next)
        }),
      )
      expect(seen).toBeGreaterThan(0)
    },
  )
})
