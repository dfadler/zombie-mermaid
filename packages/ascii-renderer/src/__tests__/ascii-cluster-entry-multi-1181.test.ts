/**
 * Regression tests for #1181: several edges addressed to one subgraph id
 * (`X --> Sub`, `Y --> Sub`) share a landing cell on the cluster's wall.
 *
 * A source off the landing column jogs along the gutter and then has to turn
 * onto the wall. Before, the jog itself ended on the landing cell, so its
 * arrowhead pointed along the gutter (`◄` / `▲`) and overwrote the arrowhead
 * of the edge that did run straight in. Every entry now ends in an arrowhead
 * that points into the cluster, one cell outside the wall.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const frame = `
subgraph Sub
A-->B
end`

function lines(source: string, useAscii = false): string[] {
  return renderMermaidASCII(source, { useAscii, colorMode: 'none' }).split('\n')
}

/** Index of the line holding the frame's top wall. */
function topWall(rows: string[], useAscii = false): number {
  const wall = useAscii ? /^\+-+\+\s*$/ : /^┌─+┐\s*$/
  const i = rows.findIndex((r) => wall.test(r))
  if (i < 0) throw new Error(`no intact top wall in:\n${rows.join('\n')}`)
  return i
}

describe('ASCII: several entries into one cluster, TD (#1181)', () => {
  const src = `graph TD\nX-->Sub\nY-->Sub${frame}`

  it('every arrowhead points down, on the row above the wall', () => {
    const rows = lines(src)
    const wall = topWall(rows)
    const text = rows.join('\n')
    expect(text).not.toMatch(/[◄▲►]/)
    expect(rows[wall - 1]).toMatch(/▼/)
    // The two entries merge into one arrowhead on the shared landing cell.
    expect([...text].filter((c) => c === '▼')).toHaveLength(2)
  })

  it('the far source turns onto the landing column with a tee, not an arrowhead', () => {
    const rows = lines(src)
    const wall = topWall(rows)
    const jog = rows[wall - 2]!
    expect(jog).toMatch(/├─+┘/)
    // The arrowhead sits in the jog's column, directly below the tee.
    expect(rows[wall - 1]!.indexOf('▼')).toBe(jog.indexOf('├'))
  })

  it('leaves the wall unbroken', () => {
    const rows = lines(src)
    expect(rows[topWall(rows) + 1]).toMatch(/^│\s+Sub\s+│/)
  })

  it('three entries: a source on each side of the landing column', () => {
    const rows = lines(`graph TD\nX-->Sub\nY-->Sub\nZ-->Sub${frame}`)
    const text = rows.join('\n')
    expect(text).not.toMatch(/[◄▲►]/)
    const wall = topWall(rows)
    // One landing cell: a single arrowhead on the row above the wall.
    expect([...rows[wall - 1]!].filter((c) => c === '▼')).toHaveLength(1)
  })

  it('labels sit on the jog, not on the arrowhead row', () => {
    const rows = lines(`graph TD\nX-->|one|Sub\nY-->|two|Sub${frame}`)
    const wall = topWall(rows)
    expect(rows[wall - 1]).not.toMatch(/one|two/)
    expect(rows.slice(0, wall).join('\n')).toMatch(/one/)
    expect(rows[wall - 2]).toMatch(/──two──|two─|─two/)
  })

  it('a lone source off the landing column also turns onto the wall', () => {
    const rows = lines(`graph TD\nS-->X\nS-->Y\nY-->Sub${frame}`)
    const text = rows.join('\n')
    expect(text).not.toMatch(/[◄▲►]/)
    expect(rows[topWall(rows) - 1]).toMatch(/▼/)
  })

  it('ASCII mode: the drop corner and arrowhead use ASCII glyphs', () => {
    const rows = lines(src, true)
    const wall = topWall(rows, true)
    expect(rows[wall - 1]).toMatch(/v/)
    expect(rows[wall - 2]).toMatch(/\+-+\+/)
    expect(rows.join('\n')).not.toMatch(/[<>^]/)
  })
})

describe('ASCII: several entries into one cluster, LR (#1181)', () => {
  const src = `graph LR\nX-->|req|Sub\nY-->|retry|Sub${frame}`

  it('every arrowhead points right, one cell before the wall', () => {
    const rows = lines(src)
    const text = rows.join('\n')
    expect(text).not.toMatch(/[◄▲▼]/)
    const arrow = rows.find((r) => r.includes('►│'))
    expect(arrow).toBeDefined()
    // Only one arrowhead reaches the wall: the entries share the landing cell.
    expect(rows.filter((r) => r.includes('►│'))).toHaveLength(1)
  })

  it('the second source turns onto the first one’s run with a tee', () => {
    const rows = lines(src)
    const arrow = rows.find((r) => r.includes('►│'))!
    expect(arrow).toMatch(/┬─►│/)
  })

  it('both labels are kept whole', () => {
    const text = lines(src).join('\n')
    expect(text).toMatch(/req/)
    expect(text).toMatch(/retry/)
  })

  it('three entries stack their jogs on one run', () => {
    const rows = lines(`graph LR\nX-->Sub\nY-->Sub\nZ-->Sub${frame}`)
    expect(rows.join('\n')).not.toMatch(/[◄▲▼]/)
    expect(rows.filter((r) => r.includes('►│'))).toHaveLength(1)
  })
})

describe('ASCII: entries and exits on the same cluster (#1181)', () => {
  it('entries land on the entry wall while exits keep their trunk', () => {
    const rows = lines(`graph TD\nX-->Sub\nY-->Sub${frame}\nSub-->P\nSub-->Q`)
    const wall = topWall(rows)
    expect(rows[wall - 1]).toMatch(/▼/)
    const text = rows.join('\n')
    expect(text).not.toMatch(/[◄▲►]/)
    for (const id of ['P', 'Q']) expect(text).toMatch(new RegExp(`│ ${id} │`))
  })
})
