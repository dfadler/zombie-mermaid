/**
 * Regression test for issue #2056: an ASCII class diagram's detour (a route
 * around an intermediate box) ended its entry run on the arrowhead's own row,
 * leaving the head with no stem above it (and its run passing through other
 * heads), and its exit corner replaced the straight stem of another
 * relationship leaving the same anchor.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

// Controller --> View skips over Model and shares Controller's anchor with
// Controller --> Model; Model ..> View ends on the same row as the detour.
const SRC = `classDiagram
  class Model { +notify() void }
  class View { +render() void }
  class Controller { +handleInput(event) void }
  Controller --> Model : updates
  Controller --> View : refreshes
  View --> Model : reads
  Model ..> View : notifies`

const rows = () =>
  renderMermaidASCII(SRC, { colorMode: 'none' })
    .split('\n')
    .map((l) => [...l])

describe('ASCII class diagram detours (issue #2056)', () => {
  it('gives every arrowhead entering View a vertical stem above it', () => {
    const r = rows()
    const heads = r.flatMap((row, y) =>
      row.flatMap((ch, x) => (ch === '▼' ? [[x, y] as const] : [])),
    )
    expect(heads.length).toBe(3)
    for (const [x, y] of heads) {
      expect(r[y - 1]?.[x], `stem above head @${x},${y}`).toMatch(/[│┊┌┐]/)
    }
  })

  it('keeps the shared anchor a plain stem and branches off it', () => {
    const r = rows()
    const y = r.findIndex((row) => /├─+┐/.test(row.join('')))
    expect(y).toBeGreaterThan(0)
    const x = r[y]!.indexOf('├')
    expect(r[y - 1]![x]).toBe('│') // The stem is not replaced by a corner
    expect(r[y + 1]![x]).not.toBe('└')
  })
})
