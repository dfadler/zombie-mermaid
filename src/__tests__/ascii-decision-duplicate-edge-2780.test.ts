/**
 * #2780: a decision with a duplicated edge beside shorter nodes threw
 * "Grid block ... already occupied" in BT/LR. The layer-grouping fix is in
 * `ascii-layout-provider.ts` (see ascii-layout-hints.test.ts); this pins an SVG
 * and an ASCII golden per direction.
 */
// Provenance (#2679): the .snap is this renderer's own output, accepted once when the test was written. It does not claim to match mermaid.js.
// Mermaid 12.3.0 verdict: DIVERGES (closer than before). mermaid draws three short direct edges from the decision. LR now has that shape: upper slant, vertex and lower slant, no crossing and no shared glyphs. BT still runs a stem from the vertex into a bus with ┴/┬ tees (no + junction), with an arrowhead per edge.
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'

const src = (dir: string) => `flowchart ${dir}
  n0(["n54J9wn"])
  n1(["m"])
  n2{"1z"}
  n3(["5Ux716"])
  n4("E8Hl7O")
  n2 --> n0
  n2 --> n0
  n2 --> n3`

describe.each(['BT', 'LR'])(
  'decision with a duplicated edge (#2780) %s',
  (dir) => {
    it('SVG snapshot', () => {
      expect(renderMermaidSVG(src(dir))).toMatchSnapshot()
    })

    it('ASCII snapshot', () => {
      expect(
        renderMermaidASCII(src(dir), { colorMode: 'none' }),
      ).toMatchSnapshot()
    })
  },
)

it.each([
  'flowchart LR\n A{Aaa} --> B[Bbb]\n A --> B\n A --> C[Ccc]',
  'flowchart LR\n A{Aaa} --> C[Ccc]\n A --> B[Bbb]\n A --> B',
])(
  'LR decision duplicates bending to one target nest without crossing (#2780): %s',
  (text) => {
    const out = renderMermaidASCII(text, { colorMode: 'none' })
    expect(out.match(/►/g)).toHaveLength(3)
    expect(out).not.toMatch(/[┼+┤┬┴├]/)
  },
)
