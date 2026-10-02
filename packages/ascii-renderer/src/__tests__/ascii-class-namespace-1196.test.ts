// ============================================================================
// ASCII class diagram namespace frames (issue #1196)
//
// The parser records `namespace Name { ... }` blocks; the renderer used to
// draw only the class boxes. Each namespace now gets a titled frame around
// its member classes.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = `classDiagram
namespace Core {
  class A
  class B
}
namespace Extras {
  class C
}
A --> C`

const lines = (src: string, useAscii = false) =>
  renderMermaidASCII(src, { useAscii }).split('\n')

/** Column of `needle` on the first line containing it. */
function find(rows: string[], needle: string): { row: number; col: number } {
  const row = rows.findIndex((l) => l.includes(needle))
  if (row < 0) throw new Error(`"${needle}" not found`)
  return { row, col: rows[row]!.indexOf(needle) }
}

describe('ASCII class diagram namespaces (#1196)', () => {
  it('draws each namespace title in its frame border', () => {
    const rows = lines(SRC)
    expect(rows.some((l) => /^┌─ Core ─+┐/.test(l))).toBe(true)
    expect(rows.some((l) => /^┌[─│]+ Extras ─+┐/.test(l))).toBe(true)
  })

  it('closes every frame', () => {
    const rows = lines(SRC)
    expect(
      rows.filter((l) => l.startsWith('└') && l.includes('┘')),
    ).toHaveLength(2)
  })

  it('keeps member boxes inside their frame and others outside', () => {
    const rows = lines(SRC)
    const core = find(rows, '┌─ Core')
    const coreEnd = rows[core.row]!.indexOf('┐')
    const coreBottom = rows.findIndex(
      (l, i) => i > core.row && l.startsWith('└'),
    )
    for (const id of ['A', 'B']) {
      const p = find(rows, `│ ${id} │`)
      expect(p.row).toBeGreaterThan(core.row)
      expect(p.row).toBeLessThan(coreBottom)
      expect(p.col).toBeGreaterThan(core.col)
      expect(p.col).toBeLessThan(coreEnd)
    }
    // C belongs to the frame below Core's bottom edge.
    expect(find(rows, '│ C │').row).toBeGreaterThan(coreBottom)
  })

  it('does not overwrite a relationship stroke crossing a frame', () => {
    const rows = lines(SRC)
    // The A -> C line crosses Extras' top border and still ends in an arrow.
    expect(rows.join('\n')).toContain('▼')
    const top = rows.find((l) => l.includes('Extras'))!
    expect(top).toMatch(/^┌[─│]+ Extras ─+┐/)
    expect(top).toContain('│')
    expect(top).not.toMatch(/E│tras|Ex│ras|Ext│as|Extr│s|Extra│s/)
  })

  it('groups a namespace together when other classes are declared between its members', () => {
    const rows = lines(`classDiagram
class A
class X
class B
namespace N {
  class A
  class B
}`)
    const a = find(rows, '│ A │').col
    const b = find(rows, '│ B │').col
    const x = find(rows, '│ X │').col
    // X is not between A and B.
    expect(x < Math.min(a, b) || x > Math.max(a, b)).toBe(true)
  })

  it('uses plain ASCII characters in ASCII mode', () => {
    const out = renderMermaidASCII(SRC, { useAscii: true })
    expect(out).toContain('Core')
    expect(out).not.toMatch(/[┌┐└┘─│]/)
    expect(out).toMatch(/\+- Core -+\+/)
  })

  it('draws nothing extra for an empty or unknown-member namespace', () => {
    const plain = renderMermaidASCII('classDiagram\nclass A')
    const out = renderMermaidASCII(`classDiagram
class A
namespace Empty {
}`)
    expect(out).toBe(plain)
  })

  it('leaves diagrams without namespaces unchanged', () => {
    expect(renderMermaidASCII('classDiagram\nA --> B')).not.toContain('Core')
  })
})
