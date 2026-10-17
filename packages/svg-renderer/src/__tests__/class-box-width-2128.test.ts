/**
 * Class box widths follow mermaid's (#2128). Expected widths are what mermaid
 * 12.1.0 and 12.2.0 (they agree) draw for the same source in headless Chromium
 * with Trebuchet MS, read from the `path` of each `g.node`. Mermaid has no
 * minimum width: a box is the wider half of its centred name/annotation, plus
 * the widest member (members start at the centre line), plus 12px each side.
 * The text widths come from a per-glyph table, so kerning leaves up to ~3px.
 */
import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseClassDiagram } from '@zombie-mermaid/mermaid-parser'
import { layoutClassDiagramSync } from '../class/layout.ts'
import { mermaidTextWidth } from '../class/mermaid-text-width.ts'

const widths = (src: string) =>
  Object.fromEntries(
    layoutClassDiagramSync(parseClassDiagram(splitStatements(src))).classes.map(
      (c) => [c.id, c.width],
    ),
  )
const within = (actual: number | undefined, expected: number) =>
  expect(Math.abs(actual! - expected)).toBeLessThan(3)

describe('class box width matches mermaid 12.1.0 / 12.2.0', () => {
  it('has no minimum width: an empty class is its name plus 24', () => {
    within(widths('classDiagram\n  class Empty').Empty, 71.06)
    within(widths('classDiagram\n  class B').B, 33.53)
  })

  it('a long member sits right of centre: half the name, the member, plus 24', () => {
    const w = widths(
      'classDiagram\n  class Parrot {\n    +bool canTalk\n    +talk() void\n    +fly() void\n  }',
    )
    within(w.Parrot, 144.68)
    const x = widths(
      'classDiagram\n  class C {\n    +String aVeryLongAttributeNameHere\n    -int y\n    +doSomethingLong(String a, int b) boolean\n  }',
    )
    within(x.C, 345.78)
  })

  it('members with no marker, params or type are measured as written', () => {
    const w = widths(
      'classDiagram\n  class M {\n    plain\n    run()\n    +get(int a) : String\n  }',
    )
    expect(w.M).toBeGreaterThan(70)
  })

  it('a long name sets the width', () => {
    within(
      widths('classDiagram\n  class AVeryLongClassNameIndeedForMeasuring')
        .AVeryLongClassNameIndeedForMeasuring,
      331.33,
    )
  })

  it('an annotation counts, measured as «annotation»', () => {
    within(
      widths(
        'classDiagram\n  class I {\n    <<interface>>\n    +run() void\n  }',
      ).I,
      154.44,
    )
  })

  it('a generic name is measured as written (List<T>)', () => {
    within(
      widths('classDiagram\n  class List~T~ {\n    +add(T item) void\n  }')
        .List,
      190.21,
    )
  })
})

describe('mermaidTextWidth', () => {
  it('matches mermaid for bold and regular text', () => {
    within(mermaidTextWidth('Parrot', true), 46.23)
    within(mermaidTextWidth('+bool canTalk', false), 97.58)
    within(mermaidTextWidth('«interface»', false), 82.34)
  })
  it('measures guillemets in both weights and Latin-1 glyphs outside the table', () => {
    expect(mermaidTextWidth('\u00ab\u00bb', true)).toBeCloseTo(18.75, 1)
    expect(mermaidTextWidth('\u00ab\u00bb', false)).toBeCloseTo(16.78, 1)
    expect(mermaidTextWidth('\u00e9', false)).toBeCloseTo(9.6, 5)
  })
  it('measures a glyph outside the table instead of dropping it', () => {
    expect(mermaidTextWidth('中', false)).toBe(16)
  })
})
