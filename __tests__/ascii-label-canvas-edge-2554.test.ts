/**
 * #2554: an edge label centred on a stroke in the outermost column reached past
 * the canvas edge and was cut (`e1` drawn as `1`). The canvas now grows to hold
 * it, in LR (left edge) and RL (right edge). ASCII-only: the SVG renderer sizes
 * its viewBox from the layout, so it has no clipped-label analogue.
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const source = (dir: string) => `stateDiagram-v2
 direction ${dir}
 S0-->S1
 S0-->S2
 S1-->S3
 S1-->S4 : e0
 S1-->S0
 S4-->S0 : e1
 S4-->S0`

describe('edge label at the canvas edge (#2554)', () => {
  for (const dir of ['LR', 'RL']) {
    for (const useAscii of [false, true]) {
      it(`${dir} ${useAscii ? 'ascii' : 'unicode'} keeps both labels whole`, () => {
        const out = renderMermaidASCII(source(dir), {
          colorMode: 'none',
          useAscii,
        })
        expect(out).toContain('e0')
        expect(out).toContain('e1')
      })
    }
  }

  it('RL draws the e1 label inside the canvas', () => {
    const lines = renderMermaidASCII(source('RL'), { colorMode: 'none' }).split(
      '\n',
    )
    expect(lines.find((l) => l.includes('e1'))).toBe(
      '        ┌────┘ └───────┼┘│└e1',
    )
  })
})
