/**
 * Four edges between two rounded boxes, every one running from the box declared
 * second to the one declared first (`flowchart RL`, `n2 ---|UN| n0`, ...): the
 * row growth for a dense facing pair counted only edges from the earlier node
 * to the later one, so neither face grew past its three cells and two edges
 * were not drawn at all (`UN` and the thick arrow). mermaid@12.3.0 draws four
 * strokes. The pair now grows once, by its first edge, whichever way it runs.
 * One SVG and ASCII golden per case.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { renderMermaidSVG } from '../packages/svg-renderer/src/index.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'

const draw = (source: string, useAscii = false): string => {
  registerAsciiLayout(asciiLayoutProvider)
  try {
    return renderMermaidASCII(source, { colorMode: 'none', useAscii })
  } finally {
    registerAsciiLayout(undefined)
  }
}

const source = (dir: 'LR' | 'RL'): string => `flowchart ${dir}
  n0("uuJTo")
  n2("oBn9")
  n2 ---|UN| n0
  n2 ---|14| n0
  n2 --> n0
  n2 ==> n0`

describe('four edges that all run from the later node to the earlier', () => {
  for (const dir of ['LR', 'RL'] as const) {
    it(`${dir}: every edge has a stroke of its own and both labels show`, () => {
      const out = draw(source(dir))
      expect(out).toContain('UN')
      expect(out).toContain('14')
      // Two of the four end in an arrowhead
      expect([...out].filter((c) => '◄►'.includes(c)).length).toBe(2)
      // Four strokes leave the source's face, one row each (a tee on its border)
      const rows = out.split('\n').filter((l) => /[├┤]/.test(l))
      expect(rows.length).toBe(4)
    })
  }

  it('snapshots SVG and ASCII (unicode and ASCII-only), LR and RL', () => {
    for (const dir of ['LR', 'RL'] as const) {
      expect(renderMermaidSVG(source(dir))).toMatchSnapshot(`svg-${dir}`)
      expect(draw(source(dir))).toMatchSnapshot(`ascii-${dir}`)
      expect(draw(source(dir), true)).toMatchSnapshot(`ascii-only-${dir}`)
    }
  })
})
