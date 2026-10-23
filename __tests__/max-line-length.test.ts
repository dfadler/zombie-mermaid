/**
 * maxLineLength caps a single source line so the parsers' per-line regexes
 * (CodeQL js/polynomial-redos) cannot be driven quadratic by one huge line.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG, renderMermaidASCII } from '../src/index.ts'
import { LimitExceededError } from '../packages/core/src/limits.ts'

const longLine = 'a<<->>a' + ' '.repeat(20_000)
const sources = {
  sequence: `sequenceDiagram\n${longLine}: hi`,
  er: `erDiagram\n${longLine}`,
  class: `classDiagram\n${longLine}`,
  c4: `C4Context\n${longLine}`,
}

describe('maxLineLength', () => {
  for (const [name, src] of Object.entries(sources)) {
    it(`${name}: SVG and ASCII reject an over-long line fast`, () => {
      const t = performance.now()
      for (const render of [renderMermaidSVG, renderMermaidASCII]) {
        expect(() => render(src)).toThrow(LimitExceededError)
      }
      expect(performance.now() - t).toBeLessThan(1000)
    })
  }

  it('is configurable and does not trip on normal input', () => {
    const ok = 'graph TD\n  A --> B'
    expect(() => renderMermaidSVG(ok)).not.toThrow()
    expect(() =>
      renderMermaidSVG(ok, { limits: { maxLineLength: 5 } }),
    ).toThrow(/maxLineLength/)
  })
})
