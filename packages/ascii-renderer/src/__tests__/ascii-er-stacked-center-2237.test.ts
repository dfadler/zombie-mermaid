// ============================================================================
// ASCII ER diagram: a stacked row is centered under its parent (issue #2237)
//
// mermaid.js (dagre) centers a narrower entity under a wider one, so a single
// relationship runs as one straight vertical edge. The renderer left-aligned
// every row, so the edge jogged sideways between two off-center stems.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { checkAll } from '../../../../__tests__/helpers/ascii-invariants.ts'

// From `claude-rich-terminal`'s own regression test: INSTALL is wider than PROJECT.
const THEIRS = `erDiagram
    INSTALL }o--|| PROJECT : scopes
    INSTALL {
        string scope
        string installPath
    }`

/** Column of the box's left border and its width, found from the name row. */
const box = (out: string, name: string) => {
  const line = out.split('\n').find((l) => l.includes(`${name} `))!
  const left = line.indexOf(name) - 2
  const right = line.lastIndexOf(line.trimEnd().slice(-1))
  return { left, right }
}

describe('ASCII ER stacked centering (issue #2237)', () => {
  for (const useAscii of [false, true]) {
    it(`centers the narrower entity and draws one straight edge (useAscii=${useAscii})`, () => {
      const out = renderMermaidASCII(THEIRS, { useAscii })
      const lines = out.split('\n')
      const install = box(out, 'INSTALL')
      const project = box(out, 'PROJECT')
      const mid = (b: { left: number; right: number }) =>
        Math.floor((b.left + b.right) / 2)
      // Box centers line up, to within the one column an odd width gives.
      expect(Math.abs(mid(install) - mid(project))).toBeLessThanOrEqual(1)

      // Every row between the two boxes carries the edge in a single column
      // (ignoring the label text to its right).
      const gapFrom = lines.findIndex((l) => l.includes('installPath')) + 2
      const gapTo = lines.findIndex((l) => l.includes('PROJECT')) - 1
      const cols = new Set<number>()
      for (const l of lines.slice(gapFrom, gapTo)) {
        const stem = l.replace(/\s+scopes.*$/, '')
        for (const m of stem.matchAll(/\S/g)) cols.add(m.index!)
      }
      expect(cols.size).toBe(1)
    })
  }

  it('leaves two entities of equal width where they were', () => {
    const out = renderMermaidASCII('erDiagram\n  A ||--o{ B : x')
    const rows = out.split('\n')
    const a = rows.find((l) => l.includes('│ A'))!.indexOf('│')
    const b = rows.find((l) => l.includes('│ B'))!.indexOf('│')
    expect(a).toBe(b)
  })

  it('keeps direction LR left-aligned', () => {
    const out = renderMermaidASCII(
      `erDiagram\n  direction LR\n${THEIRS.slice(10)}`,
    )
    expect(out.split('\n')[0]!.startsWith('┌')).toBe(true)
  })

  it('keeps a branching diagram free of ASCII-form defects', () => {
    const out = renderMermaidASCII(
      'erDiagram\n  A ||--o{ B : x\n  A ||--o{ C : y\n  B ||--o{ D : z',
    )
    expect(checkAll(out, { unicode: true, skip: ['arms'] })).toEqual([])
  })
})
