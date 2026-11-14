/**
 * Three edges between two decisions in a horizontal flow (one reciprocal) all
 * ran along one row: their labels overwrote each other and two arrowheads
 * shared a cell. mermaid@12.3.0 draws them on three rows of the facing
 * vertices, the reciprocal's last, as GitHub renders them. A face of three straight
 * strokes is now spread over the vertex and the two outer slants, however many
 * rows the vertex spans. One SVG and ASCII golden per case.
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
  n0{"ES09B"}
  n1{"0u158Y"}
  n1 -.->|5dJ| n0
  n0 ---|8wr| n1
  n0 -->|PZ| n1`

describe('three edges between two decisions in a horizontal flow', () => {
  for (const dir of ['LR', 'RL'] as const) {
    it(`${dir}: each label on a row of its own, both arrowheads drawn`, () => {
      const lines = draw(source(dir)).split('\n')
      const rows = ['8wr', 'PZ', '5dJ'].map((l) =>
        lines.findIndex((x) => x.includes(l)),
      )
      expect(rows.every((r) => r >= 0)).toBe(true)
      expect(new Set(rows).size).toBe(3)
      // The edges leaving the node first, the reciprocal last, as GitHub's mermaid draws
      expect(rows).toEqual([...rows].sort((a, b) => a - b))
      const arrows = lines
        .join('')
        .split('')
        .filter((c) => '◄►'.includes(c))
      expect(arrows.length).toBe(2)
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
