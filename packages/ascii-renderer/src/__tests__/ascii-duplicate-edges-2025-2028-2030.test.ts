/**
 * #2025, #2028, #2030: duplicate and reciprocal edges, and duplicate
 * self-loops, left a stroke that connects to nothing (or, for #2025, a canvas
 * of unequal line widths). Causes, both in `rerouteAroundStyleConflicts`:
 *  - a self-loop's reroute was allowed to cut through its own node's block, so
 *    a second loop on the same node drew a stub off the node's corner;
 *  - a parallel-lane search that ran out of offsets returned a placeholder path
 *    hundreds of rows out, and the earlier half-blocked detours were spikes
 *    that draw a stem ending in blank space.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

// Arms each box-drawing glyph extends (U/D/L/R). Dotted and heavy variants are
// not drawn by these sources.
const ARMS: Record<string, string> = {
  '─': 'LR',
  '│': 'UD',
  '┌': 'RD',
  '┐': 'LD',
  '└': 'UR',
  '┘': 'UL',
  '├': 'UDR',
  '┤': 'UDL',
  '┬': 'LRD',
  '┴': 'LRU',
  '┼': 'UDLR',
}
const STEP: Record<string, [number, number]> = {
  U: [0, -1],
  D: [0, 1],
  L: [-1, 0],
  R: [1, 0],
}

/** Glyph arms that lead into a blank cell or off the canvas. */
function orphanArms(out: string): string[] {
  const grid = out.split('\n').map((l) => [...l])
  const found: string[] = []
  grid.forEach((row, y) =>
    row.forEach((ch, x) => {
      for (const arm of ARMS[ch] ?? '') {
        const [dx, dy] = STEP[arm]!
        const next = grid[y + dy]?.[x + dx]
        if (next === undefined || next === ' ') {
          found.push(`${ch} at ${x},${y} arm ${arm}`)
        }
      }
    }),
  )
  return found
}

const widths = (out: string) => new Set(out.split('\n').map((l) => [...l].length))

const CASES: Record<string, string> = {
  '#2025 decision self-loop + duplicates + labeled back edge': `flowchart LR
  n0{"gSQ21Q"}
  n1["C"]
  n2(["OkfK"])
  n3("Q552S")
  n0 --> n0
  n0 --> n2
  n0 --> n2
  n0 --> n1
  n1 -->|000A| n0
  n0 --> n1`,
  '#2028 duplicate self-loops': `flowchart TD
  n0["a"]
  n0 --> n0
  n0 --> n0`,
  '#2030 RL reciprocal + duplicate edges': `flowchart RL
  n0["L6rc9iw"]
  n1(["9B531Zk"])
  n1 --> n0
  n0 --> n1
  n1 --> n0`,
}

describe('ASCII duplicate edges and self-loops (#2025, #2028, #2030)', () => {
  for (const [name, source] of Object.entries(CASES)) {
    for (const useAscii of [false, true]) {
      it(`${name} (${useAscii ? 'ascii' : 'unicode'}): equal-width rows`, () => {
        const out = renderMermaidASCII(source, { colorMode: 'none', useAscii })
        expect(widths(out).size).toBe(1)
      })
    }
    it(`${name}: no glyph arm leads into blank`, () => {
      const out = renderMermaidASCII(source, { colorMode: 'none' })
      expect(orphanArms(out)).toEqual([])
    })
    it(`${name}: stays compact (no placeholder lane hundreds of rows out)`, () => {
      const out = renderMermaidASCII(source, { colorMode: 'none' })
      expect(out.split('\n').length).toBeLessThan(40)
    })
  }

  it('two self-loops on one node draw the one clean loop', () => {
    const one = renderMermaidASCII('flowchart TD\n  n0["a"]\n  n0 --> n0', {
      colorMode: 'none',
    })
    const two = renderMermaidASCII(CASES['#2028 duplicate self-loops']!, {
      colorMode: 'none',
    })
    expect(two).toBe(one)
  })
})
