// ============================================================================
// Distinct line-ending glyphs for flowchart --o/--x edges and sequence -x
// "lost message" arrows (issue #330).
//
// Before this fix, --o/--x flowchart edges rendered with the same arrowhead
// glyph (◢/▲/▼/◄/►, or ^v<> in ascii mode) as a plain -->, and sequence -x
// rendered with the same filled arrowhead (▶/◀) as ->>. Parsing already
// correctly distinguished these (see issue #65's parser.test.ts coverage) —
// only the ASCII/Unicode glyph selection was missing the distinction.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII flowchart edges: --o circle-end / --x cross-end glyphs', () => {
  it('draws a circle glyph for --o in unicode mode', () => {
    const result = renderMermaidASCII(`
      graph TD
        A --o B
    `)
    expect(result).toContain('○')
    expect(result).not.toMatch(/[►◄▲▼◢◣◤◥]/)
  })

  it('draws an x glyph for --x in unicode mode', () => {
    const result = renderMermaidASCII(`
      graph TD
        A --x B
    `)
    expect(result).toContain('✕')
    expect(result).not.toMatch(/[►◄▲▼◢◣◤◥]/)
  })

  it('draws a circle glyph for --o in ascii mode', () => {
    const result = renderMermaidASCII(
      `
      graph TD
        A --o B
    `,
      { useAscii: true },
    )
    expect(result).toContain('o')
    expect(result).not.toMatch(/[<>^v]/)
  })

  it('draws an x glyph for --x in ascii mode', () => {
    const result = renderMermaidASCII(
      `
      graph TD
        A --x B
    `,
      { useAscii: true },
    )
    expect(result).toContain('x')
    expect(result).not.toMatch(/[<>^v]/)
  })

  it('draws distinct circle/cross glyphs for both edges in the same diagram', () => {
    const result = renderMermaidASCII(`
      graph TD
        A --o E
        A --x F
    `)
    expect(result).toContain('○')
    expect(result).toContain('✕')
  })

  // The text-embedded label form (`A -- label --o B`) goes through a
  // different parser branch (TEXT_ARROW_REGEX) than the plain `A --o B`
  // form above. That branch originally computed hasArrowEnd as just
  // `closeOp.endsWith('>')`, which is false for a "--o"/"--x" close — since
  // the ASCII renderer only calls its arrowhead-drawing code at all when
  // hasArrowEnd is true, the circle/cross glyph silently never rendered for
  // this syntax form specifically, even though endMarker was set correctly.
  it('draws the circle glyph for the text-embedded label form (-- label --o)', () => {
    const result = renderMermaidASCII(`
      graph LR
        A -- label --o B
    `)
    expect(result).toContain('○')
  })

  it('draws the cross glyph for the text-embedded label form (-- label --x)', () => {
    const result = renderMermaidASCII(`
      graph LR
        A -- label --x B
    `)
    expect(result).toContain('✕')
  })

  it('draws circle/x glyphs at the start end for o-- and x--', () => {
    const resultCircle = renderMermaidASCII(`
      graph LR
        A o--o B
    `)
    expect(resultCircle.match(/○/g)?.length).toBe(2)

    const resultCross = renderMermaidASCII(`
      graph LR
        A x--x B
    `)
    expect(resultCross.match(/✕/g)?.length).toBe(2)
  })

  it('still draws a plain arrowhead for a regular --> edge', () => {
    const result = renderMermaidASCII(`
      graph TD
        A --> B
    `)
    expect(result).toContain('▼')
    expect(result).not.toContain('○')
    expect(result).not.toContain('✕')
  })

  // Fan-out: a single source with multiple outgoing edges gets bundled onto
  // a shared trunk (see src/ascii/draw-bundles.ts), which draws each
  // outgoing arrowhead through a different code path than a lone edge.
  it('draws distinct glyphs for --o/--x when bundled in a fan-out (one source, many targets)', () => {
    const result = renderMermaidASCII(`
      graph TD
        A --o E
        A --x F
        A --> G
    `)
    expect(result).toContain('○')
    expect(result).toContain('✕')
    expect(result).toContain('▼')
  })

  // Fan-in: multiple sources converging on one target share a single drawn
  // arrowhead (src/ascii/draw-bundles.ts's drawBundleArrowhead). When every
  // bundled edge agrees on the same marker, that shared arrowhead should
  // use it.
  it('draws a shared circle glyph for a fan-in bundle when every edge agrees', () => {
    const result = renderMermaidASCII(`
      graph TD
        E --o C
        F --o C
    `)
    expect(result).toContain('○')
    expect(result).not.toMatch(/[►◄▲▼◢◣◤◥]/)
  })

  // A mixed fan-in (one edge --o, another plain -->) has no single correct
  // glyph for the shared arrowhead, so it falls back to the plain
  // directional arrowhead rather than guessing.
  it('falls back to a plain arrowhead for a fan-in bundle with mismatched markers', () => {
    const result = renderMermaidASCII(`
      graph TD
        E --o C
        F --x C
    `)
    expect(result).not.toContain('○')
    expect(result).not.toContain('✕')
    expect(result).toContain('▼')
  })
})

describe('ASCII sequence diagrams: -x lost-message glyph', () => {
  it('draws a distinct cross glyph for -x in unicode mode, unlike -) async', () => {
    const result = renderMermaidASCII(`sequenceDiagram
      A-)B: async
      A-xB: lost`)
    expect(result).toContain('▷') // async keeps its existing open arrowhead
    expect(result).toContain('✕') // lost message gets a distinct cross
  })

  it('draws a distinct cross glyph for -x in ascii mode', () => {
    const result = renderMermaidASCII(
      `sequenceDiagram
      A-)B: async
      A-xB: lost`,
      { useAscii: true },
    )
    expect(result).toContain('x')
  })

  it('does not draw the plain filled arrowhead for -x (unlike ->>)', () => {
    const result = renderMermaidASCII(`sequenceDiagram
      A->>B: normal
      A-xB: lost`)
    expect(result).toContain('▶') // normal ->> keeps its filled arrowhead
    expect(result).toContain('✕')
  })

  it('draws the cross glyph for a right-to-left -x message', () => {
    const result = renderMermaidASCII(`sequenceDiagram
      B-xA: lost`)
    expect(result).toContain('✕')
    expect(result).not.toMatch(/[◀◁]/)
  })

  it('draws the cross glyph for a dashed --x lost message', () => {
    const result = renderMermaidASCII(`sequenceDiagram
      A--xB: lost dashed`)
    expect(result).toContain('✕')
    expect(result).toContain('╌')
  })

  it('still draws the plain filled arrowhead for a normal ->> message', () => {
    const result = renderMermaidASCII(`sequenceDiagram
      A->>B: normal`)
    expect(result).toContain('▶')
    expect(result).not.toContain('✕')
  })
})
