/**
 * #3103: an LR flowchart with a labelled edge into a decision threw
 * `TypeError: Cannot read properties of undefined (reading 'x')` from
 * `centredLabelPlacement` (a face-lane edge reached label placement with no
 * label line; fixed in #3108). Pins the issue's exact source: every label is
 * drawn on a rectangular canvas, and the SVG and ASCII goldens (the repo rule
 * is one of each per case; #3108's test is a plain assertion).
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { renderMermaidSVG } from '../packages/svg-renderer/src/index.ts'

const SRC = `flowchart LR
  n0("SmYV")
  n1{"3L886B"}
  n2(["5"])
  n3("n")
  n0 -->|a| n1
  n3 --> n2
  n0 --> n3
  n2 --> n1
  n3 -->|0| n1
  n1 --> n0`

const draw = (useAscii: boolean): string =>
  renderMermaidASCII(SRC, { colorMode: 'none', useAscii })

describe('labelled lane sibling into a decision renders (#3103)', () => {
  for (const useAscii of [false, true]) {
    const mode = useAscii ? 'ascii' : 'unicode'
    it(`draws every label and a rectangular canvas (${mode})`, () => {
      const out = draw(useAscii)
      const lines = out.split('\n')
      expect(new Set(lines.map((l) => [...l].length)).size).toBe(1)
      // Every node text and both edge labels are drawn (a label is a lone
      // character between strokes, so match it as its own cell).
      for (const text of ['SmYV', '3L886B', '5', 'n']) {
        expect(out).toContain(text)
      }
      for (const label of ['a', '0']) {
        expect(
          lines.some((l) =>
            new RegExp(`(^|[^A-Za-z0-9])${label}([^A-Za-z0-9]|$)`).test(
              l.replace(/3L886B/, ''),
            ),
          ),
        ).toBe(true)
      }
    })
  }

  it('snapshots SVG and ASCII (unicode and ASCII-only)', () => {
    expect(renderMermaidSVG(SRC)).toMatchSnapshot('svg')
    expect(draw(false)).toMatchSnapshot('ascii')
    expect(draw(true)).toMatchSnapshot('ascii-only')
  })
})
