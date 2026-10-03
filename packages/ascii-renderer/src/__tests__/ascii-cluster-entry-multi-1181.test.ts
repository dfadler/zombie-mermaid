/**
 * Regression tests for #1181: several edges addressed to one subgraph id
 * (`X --> Sub`, `Y --> Sub`).
 *
 * Routing clamps each source's column (row) into the cluster's span, so when
 * the interior is narrow the entries collapse onto one landing cell. A source
 * off that cell jogs along the gutter and has to turn onto the wall; before,
 * the jog itself ended on the landing cell, so its arrowhead pointed along the
 * gutter (`◄` / `▲`) and overwrote the arrowhead of the edge that did run
 * straight in. Every entry now ends in an arrowhead of its own that points into
 * the cluster, one cell outside the wall, as real mermaid gives each edge its
 * own point on the cluster border.
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

/** Columns of `char` in `row`. */
function columns(row: string, char: string): number[] {
  return [...row].flatMap((c, i) => (c === char ? [i] : []))
}

/** Whether every neighbouring pair is at least two cells apart. */
function spaced(cols: number[]): boolean {
  return cols.every((c, i) => i === 0 || c - cols[i - 1]! >= 2)
}

describe('ASCII: several entries into one cluster, TD (#1181)', () => {
  const src = `graph TD\nX-->Sub\nY-->Sub${frame}`

  it('every entry has its own arrowhead, on the row above the wall', () => {
    const rows = lines(src)
    const wall = topWall(rows)
    expect(rows.join('\n')).not.toMatch(/[◄▲►]/)
    const heads = columns(rows[wall - 1]!, '▼')
    expect(heads).toHaveLength(2)
    expect(spaced(heads)).toBe(true)
  })

  it('the far source jogs along the gutter and drops with a corner', () => {
    const rows = lines(src)
    const wall = topWall(rows)
    const jog = rows[wall - 2]!
    expect(jog).toMatch(/┌─+┘/)
    // The jog's corner sits directly above the arrowhead it drops to.
    expect(columns(rows[wall - 1]!, '▼')).toContain(jog.indexOf('┌'))
  })

  it('the near source keeps running straight in', () => {
    const rows = lines(src)
    const wall = topWall(rows)
    const stem = columns(rows[wall - 3]!, '│')
    expect(stem.some((c) => rows[wall - 1]![c] === '▼')).toBe(true)
  })

  it('leaves the wall unbroken', () => {
    const rows = lines(src)
    expect(rows[topWall(rows) + 1]).toMatch(/^│\s+Sub\s+│/)
  })

  it('three entries: one arrowhead each, every pair two cells apart', () => {
    const rows = lines(`graph TD\nX-->Sub\nY-->Sub\nZ-->Sub${frame}`)
    expect(rows.join('\n')).not.toMatch(/[◄▲►]/)
    const heads = columns(rows[topWall(rows) - 1]!, '▼')
    expect(heads).toHaveLength(3)
    expect(spaced(heads)).toBe(true)
  })

  it('more entries than the wall can separate still end sideways-free', () => {
    const rows = lines(
      `graph TD\nV-->Sub\nW-->Sub\nX-->Sub\nY-->Sub\nZ-->Sub\nsubgraph Sub\nA\nend`,
    )
    expect(rows.join('\n')).not.toMatch(/[◄▲►]/)
    expect(rows[topWall(rows) - 1]).toMatch(/▼/)
  })

  it('entries that already land apart are left where they were routed', () => {
    // Two members side by side: each source sits over its own member, so the
    // routed landings are far apart and need no spreading.
    const rows = lines(`graph TD\nX-->Sub\nY-->Sub\nsubgraph Sub\nA\nB\nend`)
    const wall = topWall(rows)
    expect(rows.join('\n')).not.toMatch(/[◄▲►]/)
    // No jog: nothing between the sources' stems and the arrowheads bends.
    expect(rows[wall - 2]).not.toMatch(/[┌┐└┘]/)
    expect(columns(rows[wall - 1]!, '▼')).toHaveLength(2)
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
    expect(columns(rows[wall - 1]!, 'v')).toHaveLength(2)
    expect(rows[wall - 2]).toMatch(/\+-+\+/)
    expect(rows.join('\n')).not.toMatch(/[<>^]/)
  })
})

describe('ASCII: several entries into one cluster, LR (#1181)', () => {
  const src = `graph LR\nX-->|req|Sub\nY-->|retry|Sub${frame}`
  /** Rows holding an arrowhead in the cell just left of the frame's wall. */
  const heads = (rows: string[]): number[] => {
    // The frame is the only box wide enough to have a run of nine dashes.
    const wallX = rows.map((r) => r.search(/┌─{9,}┐/)).find((x) => x >= 0)!
    return rows.flatMap((r, i) => (r[wallX - 1] === '►' ? [i] : []))
  }

  it('every entry has its own arrowhead, one cell before the wall', () => {
    const rows = lines(src)
    expect(rows.join('\n')).not.toMatch(/[◄▲▼]/)
    expect(heads(rows)).toHaveLength(2)
    expect(spaced(heads(rows))).toBe(true)
  })

  it('the far source runs up its own column and turns into the wall', () => {
    const rows = lines(src)
    expect(rows.some((r) => /┌─►│/.test(r))).toBe(true)
  })

  it('both labels are kept whole', () => {
    const text = lines(src).join('\n')
    expect(text).toMatch(/req/)
    expect(text).toMatch(/retry/)
  })

  it('three entries each get a row of their own', () => {
    const rows = lines(`graph LR\nX-->Sub\nY-->Sub\nZ-->Sub${frame}`)
    expect(rows.join('\n')).not.toMatch(/[◄▲▼]/)
    expect(heads(rows)).toHaveLength(3)
    expect(spaced(heads(rows))).toBe(true)
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
