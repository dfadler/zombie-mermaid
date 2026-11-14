/**
 * Four edges between two decisions (two each way) ran along one row, because
 * `allocateFaces` counted the rows beside the vertex off the centre and a
 * decision as tall as mermaid draws it (ELK's pixel size) has a vertex of two
 * rows, one of which takes no stroke: the check failed and every end stayed at
 * the centre. The rows are now found, the nearest slant rows above and below.
 * mermaid@12.3.0 draws four strokes. One SVG and ASCII golden per case.
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
  n0{"qVv"}
  n1{"60P"}
  n0 --> n1
  n0 --> n1
  n1 -->|0A| n0
  n1 -->|AA| n0`

describe('four edges between two decisions, two each way', () => {
  for (const dir of ['LR', 'RL'] as const) {
    it(`${dir}: four strokes on four rows, both labels whole`, () => {
      const out = draw(source(dir))
      expect(out).toContain('0A')
      expect(out).toContain('AA')
      expect([...out].filter((c) => '◄►'.includes(c)).length).toBe(4)
      const rows = out.split('\n').filter((l) => /[─]/.test(l) && /[◄►]/.test(l))
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
