/**
 * Regression tests for #1283 — an edge addressed to a subgraph id
 * (`Y --> Sub`) ends at the cluster's flow-side wall, as real mermaid draws
 * it, and the cluster is ranked past the sources of such edges.
 *
 * Before, the converter's stand-in member took the arrow into the frame
 * (past the wall, with a junction glyph where it crossed), and a source with
 * a parent landed level with the cluster's entry member, inside the frame's
 * span, so its edge ran sideways across the wall.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const frame = `
subgraph Sub
A-->B
A-->C
end`

function lines(source: string): string[] {
  return renderMermaidASCII(source).split('\n')
}

/** Index of the line holding the frame's top wall. */
function topWall(rows: string[]): number {
  const i = rows.findIndex((r) => /^┌─+┐\s*$/.test(r))
  if (i < 0) throw new Error(`no intact top wall in:\n${rows.join('\n')}`)
  return i
}

describe('ASCII: edges addressed to a subgraph end at its wall (#1283)', () => {
  it('TD: both arrows stop on the line above an unbroken top wall', () => {
    const rows = lines(`graph TD\nX-->Sub\nW-->Y\nY-->Sub${frame}`)
    const wall = topWall(rows)
    const above = rows[wall - 1]!
    // One arrowhead per source, each directly above the wall.
    expect([...above].filter((c) => c === '▼')).toHaveLength(2)
    // Nothing crosses into the frame: no junction glyph on the wall row.
    expect(rows[wall]).not.toMatch(/[┼┬┴]/)
  })

  it('TD: W sits directly above Y, and Y above the frame', () => {
    const rows = lines(`graph TD\nX-->Sub\nW-->Y\nY-->Sub${frame}`)
    const col = (label: string): number => {
      const row = rows.find((r) => r.includes(`│ ${label} │`))!
      return row.indexOf(`│ ${label} │`)
    }
    const rowOf = (label: string): number =>
      rows.findIndex((r) => r.includes(`│ ${label} │`))
    expect(col('W')).toBe(col('Y'))
    expect(rowOf('W')).toBeLessThan(rowOf('Y'))
    expect(rowOf('Y')).toBeLessThan(topWall(rows))
  })

  it('LR: the arrow stops one cell before the left wall, label clear of the node', () => {
    const rows = lines(`graph LR\nX-->Sub\nW-->Y\nY-->|go|Sub${frame}`)
    const xRow = rows.find((r) => r.includes('│ X ├'))!
    expect(xRow).toMatch(/►│ │ A/)
    const yRow = rows.find((r) => r.includes('│ Y ├'))!
    expect(yRow).toMatch(/│ Y ├go─+►│/)
  })

  it('keeps a direct edge to a member on ordinary routing', () => {
    const rows = lines(`graph TD${frame}\nX-->A`)
    // The arrow enters the frame and lands on A, as before.
    // The wall row is crossed here, so find it from the title row below it.
    const wall = rows.findIndex((r) => r.includes('Sub')) - 1
    const a = rows.findIndex((r) => /[│├┤] A [│├┤]/.test(r))
    expect(rows.slice(wall + 1, a).some((r) => r.includes('▼'))).toBe(true)
  })

  it('places every node when the cluster is also reached from below', () => {
    // C is downstream of the cluster and edges back into it: the cluster
    // cannot wait for C, so it is placed on what is known.
    const out = renderMermaidASCII(
      `graph TD\nsubgraph Sub\nA-->B\nend\nB-->C\nC-->Sub\nX-->Sub`,
    )
    for (const id of ['A', 'B', 'C', 'X']) {
      expect(out).toMatch(new RegExp(`[│├┤] ${id} [│├┤]`))
    }
  })
})
