/**
 * #2725: mermaid 12.3.0 draws no shape for an architecture `junction`, only the
 * point where its edges meet. ASCII draws that point as the line join its arms
 * need (`┬`, `├`, `┼`...) and bridges any gap between it and the edges.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const head = `architecture-beta
  service a(server)[A]
  service b(server)[B]
  service c(server)[C]
  junction j
`

const render = (edges: string, ascii = false): string =>
  renderMermaidASCII(head + edges, { useAscii: ascii })

describe('architecture junction (#2725)', () => {
  it('draws a tee, not a box, where an edge branches', () => {
    const out = render('  a:R -- L:j\n  j:R --> L:b\n  j:B --> T:c')
    expect(out).not.toMatch(/[●*]/)
    // The join is one tee cell on the line from A, with arms reaching B and C
    const lines = out.split('\n')
    const row = lines.findIndex((l) => l.includes('A') && /[┬┴├┤┼]/.test(l))
    const arm = lines[row]!.search(/─[┬┴├┤┼]/) + 1
    expect(arm).toBeGreaterThan(0)
    const col = (r: number) => lines[r]?.[arm]
    // `j:B --> T:c` puts C below the join (#2724): one arm down, none up
    expect(col(row - 1)).toBe(' ')
    expect(col(row + 1)).toBe('│')
  })

  it('is a plain line where two edges run straight through', () => {
    const out = render('  a:R -- L:j\n  j:R --> L:b')
    expect(out).not.toMatch(/[●┼┬┴+]/)
    expect(out).toMatch(/A.*─+►.*B|A.*─.*B/)
  })

  it('uses + in ASCII mode', () => {
    const out = render('  a:R -- L:j\n  j:R --> L:b\n  j:B --> T:c', true)
    expect(out).not.toMatch(/[●*]/)
    expect(out).toContain('+')
  })

  it('draws nothing for a junction with no edges', () => {
    const out = render('  a:R -- L:b')
    expect(out).not.toMatch(/[●┼*]/)
  })
})
