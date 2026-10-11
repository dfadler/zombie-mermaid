import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseC4Diagram } from '@zombie-mermaid/mermaid-parser'
import { layoutC4DiagramSync } from '../c4/layout.ts'
import { C4, C4_TEXT_WIDTH, c4TextWidth, wrapToWidth } from '../c4/metrics.ts'

// Mermaid 11.17.2 measures C4 text in the browser. The widths below are read
// back from its SVG (see c4-mermaid-reference.test.ts for the full set), and
// text near the wrap limit is where an estimate that is a few percent off
// changes a shape's width (#1210).
const shapes = (src: string) =>
  layoutC4DiagramSync(parseC4Diagram(splitStatements(src))).elements

describe('C4 text widths (#1210)', () => {
  it('measures a bold name as Mermaid does', () => {
    // Mermaid made the shape for this name 227.6px wide: text plus 2 x 20.
    expect(
      c4TextWidth('Personal Banking Customer', C4.nameSize, 700),
    ).toBeCloseTo(227.6 - 2 * C4.shapePadding, 0)
  })

  it('wraps at the shape width less its padding, measured at regular weight', () => {
    expect(C4_TEXT_WIDTH).toBe(176)
    // 187.6px in bold, 175.9px in regular: it stays on one line, as in
    // Mermaid, even though the drawn name is wider than the limit.
    const name = 'Personal Banking Customer'
    expect(wrapToWidth(name, C4_TEXT_WIDTH, C4.nameSize)).toEqual([name])
    expect(c4TextWidth(name, C4.nameSize, 700)).toBeGreaterThan(C4_TEXT_WIDTH)
  })

  it('keeps a person with a three-line description at the standard width', () => {
    const [p] = shapes(
      'C4Context\n  Person(p, "Customer", "A description that is long enough to wrap into three lines at the standard width of a shape")',
    )
    expect(p!.descriptionLines).toHaveLength(3)
    // Mermaid: 216px. A wider estimate widened it to 222px.
    expect(p!.width).toBeCloseTo(216, 1)
  })

  it('falls back to a scaled estimate outside printable ASCII', () => {
    expect(c4TextWidth('中文', C4.descrSize, 400)).toBeGreaterThan(0)
  })
})
