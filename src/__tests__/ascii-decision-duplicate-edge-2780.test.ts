/**
 * #2780: a decision with a duplicated edge beside shorter nodes threw
 * "Grid block ... already occupied" in BT/LR. The layer-grouping fix is in
 * `ascii-layout-provider.ts` (see ascii-layout-hints.test.ts); this pins an SVG
 * and an ASCII golden per direction.
 */
// Provenance (#2679): the .snap is this renderer's own output, accepted once when the test was written. It does not claim to match mermaid.js.
// Mermaid 12.3.0 verdict: DIVERGES. mermaid draws three short direct edges from the decision; these goldens pin our current routing (BT: stem + bus with junction glyphs; LR: the second parallel edge wraps behind the diamond and crosses another). They guard the throw, not the routing.
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
