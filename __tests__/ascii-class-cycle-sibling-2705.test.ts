/**
 * #2705: a class that shares its parent with a class an up edge runs past
 * (`B --> X`, `B --> C`, with `D --> B` back up past C) lost that sibling's
 * edge: the up edge's lane ran through the siblings and hid `B --> C`.
 *
 * Mermaid 12.3.0 (headless, measured) leaves B on top of the cycle whichever
 * class is declared first, with the up edge's lane free of the siblings; the
 * label `one` sits on that lane with a gap in the line, as ours does.
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII, renderMermaidSVG } from '../src/index.ts'

const heads = (ascii: string): number => (ascii.match(/[v^]/g) ?? []).length

const SOURCES: Record<string, string> = {
  'downstream class declared first':
    'classDiagram\n  class X\n  B --> X\n  B --> C\n  C --> D\n  D --> B : one',
  'sibling edge declared before the cycle edge':
    'classDiagram\n  B --> C\n  B --> X\n  C --> D\n  D --> B',
  'sibling first, unlabelled':
    'classDiagram\n  B --> X\n  B --> C\n  C --> D\n  D --> B',
}

describe('class cycle with a sibling beside the up edge (#2705)', () => {
  for (const [name, source] of Object.entries(SOURCES)) {
    for (const useAscii of [false, true]) {
      it(`${name}: ASCII draws all four edges (useAscii=${useAscii})`, () => {
        const out = renderMermaidASCII(source, { useAscii, colorMode: 'none' })
        expect(heads(out)).toBe(4)
        const lines = out.split('\n')
        const row = (n: string) =>
          lines.findIndex(
            (l) => l.includes(`| ${n} |`) || l.includes(`│ ${n} │`),
          )
        // B is the entry of the cycle, X and C below it, D at the bottom.
        expect(row('B')).toBeLessThan(row('X'))
        expect(row('B')).toBeLessThan(row('C'))
        expect(row('C')).toBeLessThan(row('D'))
      })
    }

    it(`${name}: SVG draws the same four relationships`, () => {
      const svg = renderMermaidSVG(source)
      for (const id of ['B', 'C', 'D', 'X']) expect(svg).toContain(`>${id}<`)
      expect(
        (svg.match(/<polyline class="class-relationship"/g) ?? []).length,
      ).toBe(4)
    })
  }

  it('keeps the label on the up edge clear of the sibling boxes', () => {
    const out = renderMermaidASCII(
      SOURCES['downstream class declared first']!,
      {
        colorMode: 'none',
      },
    )
    const oneRow = out.split('\n').find((l) => l.includes('one'))!
    // Both sibling boxes keep their walls in the label's row.
    expect(oneRow.match(/│ {3}│/g)).toHaveLength(2)
  })

  it('leaves siblings below the up edge (not between its ends) in place', () => {
    const out = renderMermaidASCII(
      'classDiagram\n  P --> Q\n  Q --> R\n  R --> S\n  S --> P\n  S --> T\n  S --> U',
      { colorMode: 'none' },
    )
    expect(heads(out)).toBe(6)
  })

  it('keeps a sibling that carries a note where it is, with every edge drawn', () => {
    const out = renderMermaidASCII(
      'classDiagram\n  B --> X\n  B --> C\n  C --> D\n  D --> B\n  note for X "hi"',
      { colorMode: 'none' },
    )
    expect(out).toContain('hi')
    expect(out).toContain('X')
  })
})
