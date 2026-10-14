/**
 * Regression test for issue #2024: in an ASCII class diagram, a relationship
 * whose route has a horizontal run (source and target columns differ) had its
 * label centred on that run's row, overwriting it. The stem ended in the label
 * row and the arrowhead below it sat several columns away, connected to
 * nothing. The label now hangs beside the source stem, on a row of its own.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

/** Glyphs that join an arrowhead from the side it points away from. */
const FEEDS_DOWN = new Set(['│', '┊', '┐', '┌', '┬', '├', '┤', '┼'])
const FEEDS_UP = new Set(['│', '┊', '┘', '└', '┴', '├', '┤', '┼'])

/** Every vertical arrowhead has a stroke cell directly behind it, or only
 * label text between it and one in the same column. */
function detachedHeads(out: string): string[] {
  const rows = out.split('\n').map((l) => [...l])
  const bad: string[] = []
  rows.forEach((row, y) =>
    row.forEach((ch, x) => {
      const dy = ch === '▼' ? -1 : ch === '▲' ? 1 : 0
      if (!dy) return
      const feeds = dy < 0 ? FEEDS_DOWN : FEEDS_UP
      let k = 1
      while (/[\p{L}\p{N}]/u.test(rows[y + k * dy]?.[x] ?? ' ')) k++
      if (!feeds.has(rows[y + k * dy]?.[x] ?? ' ')) bad.push(`${ch}@${x},${y}`)
    }),
  )
  return bad
}

describe('ASCII class diagram — label does not detach arrowheads (issue #2024)', () => {
  const down = `classDiagram
  class Teacher { +String name }
  class Student { +String name }
  class Course { +String title }
  Teacher --> Course : teaches
  Student --> Course : enrolled in`
  it('keeps every head attached', () => {
    const out = renderMermaidASCII(down, { colorMode: 'none' })
    expect(out).toContain(' teaches ')
    expect(out).toContain(' enrolled in ')
    expect(detachedHeads(out)).toEqual([])
  })
})
