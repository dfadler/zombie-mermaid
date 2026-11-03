/**
 * Regression tests (#1701): under RL the canvas is mirrored, but node shapes
 * are not (mermaid.js re-lays out nodes yet draws every shape identically for
 * every direction). A single-node RL render must equal its LR render, and a
 * parallelogram / trapezoid / flag keeps its LR corner glyphs.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { mkCanvas, flipCanvasHorizontally } from '../canvas.ts'

const SHAPES = [
  '[/p/]',
  '[\\a\\]',
  '[/t\\]',
  '[\\t/]',
  '>f]',
  '{{h}}',
  '[(db)]',
  '((c))',
  '(((dc)))',
  '{d}',
  '[b]',
]

const trimEnds = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .join('\n')

describe('RL keeps node shapes unmirrored', () => {
  for (const useAscii of [false, true]) {
    for (const shape of SHAPES) {
      it(`${shape} renders like LR (useAscii=${useAscii})`, () => {
        const lr = renderMermaidASCII(`graph LR\n A${shape}`, { useAscii })
        const rl = renderMermaidASCII(`graph RL\n A${shape}`, { useAscii })
        expect(rl).toBe(lr)
      })
    }
  }

  it('keeps parallelogram slants and the flag notch on the same side', () => {
    const src = (d: string) =>
      `graph ${d}\n A[/p/] --> B[\\a\\] --> C>f] --> D[/t\\]`
    const rl = renderMermaidASCII(src('RL'), { useAscii: false })
    const lr = renderMermaidASCII(src('LR'), { useAscii: false })
    const label = rl.split('\n')[2]
    // Left to right in RL: trapezoid, flag, "\a\", "/p/" (#2164: the
    // parallelograms keep their lean, `╲` and `╱`).
    expect(label).toMatch(/╱ +t +╲◄─+┤> f +│◄─+╲ +a +╲◄─+╱ +p +╱ *$/)
    // The notch (`>` one cell in from the left wall) stays on the left (#2164).
    expect(rl).toMatch(/┤> f  │/)
    expect(rl).not.toContain('<')
    expect(lr.split('\n')[2]).toMatch(/╱ +p +╱─+►╲ +a +╲─+► > f +├─+►╱ +t +╲/)
    expect(lr).toMatch(/► > f  ├/)
  })

  it('keeps shapes unmirrored inside an RL subgraph', () => {
    const body = 'A[/p/] --> B>f]'
    const lrInRl = renderMermaidASCII(
      `graph LR\n subgraph S\n direction RL\n ${body}\n end`,
    )
    const rlInRl = renderMermaidASCII(
      `graph RL\n subgraph S\n direction RL\n ${body}\n end`,
    )
    expect(lrInRl).toContain('╱')
    expect(lrInRl).toMatch(/> f {2}│/)
    expect(trimEnds(rlInRl)).toMatch(/> f {2}│/)
    expect(rlInRl).not.toContain('<')
    expect(lrInRl).not.toContain('<')
  })

  it('flipCanvasHorizontally leaves node-rect corners unmirrored', () => {
    const canvas = mkCanvas(2, 0)
    canvas[0]![0] = '▷'
    canvas[2]![0] = '┐'
    canvas[1]![0] = '─'
    flipCanvasHorizontally(canvas, undefined, [{ x0: 0, x1: 2, y0: 0, y1: 0 }])
    expect(canvas.map((c) => c[0]).join('')).toBe('▷─┐')
  })

  it('flipCanvasHorizontally still mirrors cells outside node rects', () => {
    const canvas = mkCanvas(2, 0)
    canvas[0]![0] = '┌'
    canvas[2]![0] = '►'
    flipCanvasHorizontally(canvas)
    expect(canvas.map((c) => c[0]).join('')).toBe('◄ ┐')
  })

  it('flipCanvasHorizontally skips single-column and off-canvas node rects', () => {
    const canvas = mkCanvas(2, 0)
    canvas[0]![0] = '┌'
    canvas[2]![0] = '►'
    flipCanvasHorizontally(canvas, undefined, [
      { x0: 1, x1: 1, y0: 0, y1: 0 },
      { x0: 0, x1: 9, y0: 0, y1: 0 },
    ])
    expect(canvas.map((c) => c[0]).join('')).toBe('◄ ┐')
  })
})
