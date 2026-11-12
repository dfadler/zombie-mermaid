/**
 * #2678: a dashed class relation (`..>`, `..|>`, `..`) that crosses a
 * namespace border kept a solid stroke in the cell between the frame and the
 * box: the box-start connector wrote `─` whatever the edge style. Mermaid
 * 12.3.0 draws the whole relation dashed.
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII, renderMermaidSVG } from '../src/index.ts'

const source = (dir: string, rel: string) =>
  `classDiagram
  direction ${dir}
  namespace D {
    class A
  }
  namespace I {
    class B
  }
  B ${rel} A : stores`

describe('dashed class relation across namespace frames (#2678)', () => {
  for (const dir of ['LR', 'RL', 'TB', 'BT']) {
    for (const rel of ['..>', '..|>', '..']) {
      it(`${dir} ${rel}: no solid stroke beside the frame`, () => {
        const src = source(dir, rel)
        const out = renderMermaidASCII(src, { colorMode: 'none' })
        const row = out.split('\n').find((l) => l.includes('stores')) ?? ''
        if (dir === 'LR' || dir === 'RL') {
          // Only dashes and junctions between the two boxes' stems.
          expect(row).not.toMatch(/[├┤]─|─[├┤┼]|[┼]─/)
          expect(row).toContain('┄')
        } else {
          expect(out).toMatch(/[┆┊]/)
        }
        expect(renderMermaidSVG(src)).toMatchSnapshot('svg')
        expect(out).toMatchSnapshot('ascii')
      })
    }
  }
})
