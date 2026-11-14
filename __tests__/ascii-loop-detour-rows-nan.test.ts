/**
 * `renderMermaidASCII` threw `RangeError: Invalid array length` (from
 * `mkCanvas` via `setCanvasSizeToGrid`) on this BT flowchart, found by the
 * #3103 property sweep. The `n4 ==> n4` self-loop runs a long detour; the
 * "loop shares a track with another edge" widening (#2070) added 2 to every
 * row the loop passes through, but only a path's waypoints get a row entry, so
 * the rows in between were `undefined + 2 = NaN` and the canvas height with
 * them. Pins the exact source in all four directions, and the SVG and ASCII
 * goldens (the repo rule is one of each per case).
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { renderMermaidSVG } from '../packages/svg-renderer/src/index.ts'

const body = `
  n2(["IwjRJr"])
  n1 -->|0| n3
  n6 -.->|0| n1
  n6 -.->|0| n3
  n5 -.->|0| n1
  n3 ---|ccc| n1
  n4 ==>|ccc| n6
  n6 -->|a| n5
  n4 --- n3
  n4 ==> n4`
const SRC = `flowchart BT${body}`

const draw = (src: string, useAscii: boolean): string =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })

describe('self-loop detour through unseeded rows renders (BT crash)', () => {
  for (const dir of ['BT', 'TD', 'LR', 'RL']) {
    it(`draws every node and label on a rectangular canvas (${dir})`, () => {
      const out = draw(`flowchart ${dir}${body}`, false)
      const lines = out.split('\n')
      expect(new Set(lines.map((l) => [...l].length)).size).toBe(1)
      for (const id of ['n1', 'n3', 'n4', 'n5', 'n6', 'IwjRJr']) {
        expect(out).toContain(id)
      }
      expect(out.match(/\bccc\b/g)).toHaveLength(2)
      expect(out.match(/\ba\b/g)).toHaveLength(1)
      expect(out.match(/\b0\b/g)).toHaveLength(4)
    })
  }

  it('snapshots SVG and ASCII (unicode and ASCII-only)', () => {
    expect(renderMermaidSVG(SRC)).toMatchSnapshot('svg')
    expect(draw(SRC, false)).toMatchSnapshot('ascii')
    expect(draw(SRC, true)).toMatchSnapshot('ascii-only')
  })
})
