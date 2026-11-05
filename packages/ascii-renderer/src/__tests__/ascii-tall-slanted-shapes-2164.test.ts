/**
 * #2164: a parallelogram or trapezoid stretched taller than 5 rows by a
 * neighbour (a double circle is 7 rows) lost its slanted walls: they fell back
 * to `│` and the trapezoid's base to `└──┘`. The slant is now spread over all
 * rows, as mermaid skews the whole height.
 */
// Provenance (#2679): the .snap is this renderer's own output, accepted once when the test was written. It does not claim to match mermaid.js.
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const SOURCES: [string, string][] = [
  ['para-trap', 'graph LR\nA[/Para/] --> B(((Dbl)))\nB --> C[/Trap\\]'],
  ['alt', 'graph LR\nA[\\Para\\] --> B(((Dbl)))\nB --> C[\\Trap/]'],
]

describe('taller slanted shapes keep their slant (#2164)', () => {
  it.each(SOURCES)('%s: no vertical walls or square corners', (_n, src) => {
    for (const useAscii of [false, true]) {
      const out = renderMermaidASCII(src, { useAscii })
      expect(out).not.toMatch(/[│└┘┌┐]/)
      expect(out).not.toContain('|')
    }
  })

  it.each(SOURCES)('%s: ASCII and SVG snapshots', (_n, src) => {
    expect(renderMermaidASCII(src)).toMatchSnapshot('unicode')
    expect(renderMermaidASCII(src, { useAscii: true })).toMatchSnapshot('ascii')
    expect(renderMermaidSVG(src)).toMatchSnapshot('svg')
  })
})
