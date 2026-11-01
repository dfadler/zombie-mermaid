/**
 * #2492: `B -->|no| D` beside `D --> B` in LR, with B a diamond and D a
 * parallelogram, drew one merged route: a diamond's bottom vertex and a
 * parallelogram's slanted side were not accepted as places to draw a second
 * stroke, so port-offsets.ts left both edges on the same cells.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const SRC = (d: string, shape: string): string => `graph ${d}
  A --> B{Valid?}
  B -->|yes| C
  B -->|no| D${shape}
  D --> B`

describe('opposing edges at a diamond / slanted node (#2492)', () => {
  it('draws two strokes below the diamond vertex (rectangle D)', () => {
    const out = renderMermaidASCII(SRC('LR', '[Ask Again]'))
    expect(out).toContain('▲│')
    expect(out).toContain('└┼')
  })

  it('draws two strokes with a parallelogram D, one row apart at D', () => {
    const out = renderMermaidASCII(SRC('LR', '[/Ask Again/]'))
    expect(out).toContain('▲│')
    expect(out).toContain('└┼')
  })

  it('splits the pair with a backslash parallelogram D', () => {
    const out = renderMermaidASCII(SRC('LR', '[\\Ask Again\\]'))
    expect(out).toContain('▲│')
    expect(out).toContain('└┼')
  })

  it('splits the pair in RL too', () => {
    const out = renderMermaidASCII(SRC('RL', '[/Ask Again/]'))
    expect(out).toContain('│▲')
  })

  // Paired snapshots (repo rule: SVG + ASCII). The fix is ASCII-only, so the
  // SVG snapshot pins that SVG output stays unchanged.
  it('snapshots ASCII and SVG for the issue source', () => {
    const src = SRC('LR', '[/Ask Again/]')
    expect(renderMermaidASCII(src)).toMatchSnapshot('ascii')
    expect(renderMermaidSVG(src)).toMatchSnapshot('svg')
  })
})
