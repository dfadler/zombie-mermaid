/**
 * `A --o B` and `A --x B` end in a circle / cross, `o--` and `x--` start with
 * one (mermaid 12.2.0 `circleEnd-margin` / `crossEnd-margin`). The SVG used to
 * draw a plain arrowhead for all of them; the ASCII renderer already drew the
 * distinct glyphs.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const markers = (svg: string) =>
  [
    ...svg.matchAll(
      /marker-(start|end)="url\(#[\w-]*?(arrowhead|circle|cross)(-start|-end)?\)"/g,
    ),
  ].map((m) => `${m[1]}:${m[2]}`)

describe('flowchart circle and cross terminators (SVG)', () => {
  it('uses a circle / cross marker at the end the syntax names', () => {
    const svg = renderMermaidSVG(
      'flowchart LR\n  A --o B\n  A --x C\n  A o--o D\n  A x--x E\n  A --> F\n  A <--> G',
    )
    expect(markers(svg)).toEqual([
      'end:circle',
      'end:cross',
      'end:circle',
      'start:circle',
      'end:cross',
      'start:cross',
      'end:arrowhead',
      'end:arrowhead',
      'start:arrowhead',
    ])
  })

  it('defines the circle disc and the cross strokes with the arrow colour', () => {
    const svg = renderMermaidSVG('flowchart LR\n  A --o B\n  A --x C')
    expect(svg).toMatch(/<marker id="[\w-]*circle"[^>]*markerWidth="14"/)
    expect(svg).toMatch(/<circle cx="5" cy="5" r="5" fill="var\(--_arrow\)"/)
    expect(svg).toMatch(/<marker id="[\w-]*cross"[^>]*markerWidth="12"/)
    expect(svg).toMatch(/<path d="M1 1L9 9M1 9L9 1" stroke="var\(--_arrow\)"/)
  })

  it('adds no terminator markup to a diagram without them', () => {
    const svg = renderMermaidSVG('flowchart LR\n  A --> B')
    expect(svg).not.toMatch(/circle|cross/)
  })

  it('keeps the ASCII twin on distinct glyphs', () => {
    const ascii = renderMermaidASCII('flowchart LR\n  A --o B\n  A --x C')
    expect(ascii).toContain('○')
    expect(ascii).toContain('✕')
  })
})
