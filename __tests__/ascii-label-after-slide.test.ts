/**
 * Three labelled edges from one node to another drop a label: the middle
 * edge's label slides to a free row, the third edge's label was checked
 * against that label's unslid cell (free) and landed on the slid one, and
 * `drawGraph`'s last-wins merge overwrote it (`n825` for `n82` and `C5`).
 * `clearOfEarlierLabels` now takes an earlier label where it is drawn.
 * One SVG and ASCII golden per case, per the repo rule.
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { renderMermaidSVG } from '../packages/svg-renderer/src/index.ts'

const SRC = `flowchart TD
  n0("vT3bfMaT")
  n1["p7J"]
  n1 -->|STX| n0
  n1 -.->|n82| n0
  n1 -->|C5| n0`

const draw = (useAscii: boolean): string =>
  renderMermaidASCII(SRC, { colorMode: 'none', useAscii })

describe('a label that lands where an earlier label slid to', () => {
  for (const useAscii of [false, true]) {
    it(`draws STX, n82 and C5 whole (${useAscii ? 'ascii' : 'unicode'})`, () => {
      const out = draw(useAscii)
      for (const label of ['STX', 'n82', 'C5']) expect(out).toContain(label)
    })
  }

  it('snapshots SVG and ASCII (unicode and ASCII-only)', () => {
    expect(renderMermaidSVG(SRC)).toMatchSnapshot('svg')
    expect(draw(false)).toMatchSnapshot('ascii')
    expect(draw(true)).toMatchSnapshot('ascii-only')
  })
})
