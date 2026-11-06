/**
 * #2694: an empty flowchart subgraph was dropped from the ASCII output.
 * Mermaid 12.3.0 (scratch install, headless Chromium) draws it as a cluster
 * rect of height 0 (no visible frame) with its title text laid out like a node
 * in the first rank: above the first node in LR, left of it in TD. So ASCII
 * prints the title only. Exact placement is dagre's and is not asserted here.
 */
// Provenance (#2679): the .snap is this renderer's own output, accepted once when the test was written. It does not claim to match mermaid.js; the structure (title text, no frame) was measured against mermaid 12.3.0.
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const SOURCES: [string, string][] = [
  ['lr', 'graph LR\nsubgraph one\nend\nA --> B'],
  ['td', 'graph TD\nsubgraph one\nend\nA --> B'],
  [
    'td-direction-override',
    'graph TD\nsubgraph one\ndirection LR\nend\nA --> B',
  ],
  [
    'nested-in-filled',
    'graph LR\nsubgraph outer\nsubgraph inner\nend\nX\nend\nA --> X',
  ],
  ['edge-endpoint', 'graph LR\nsubgraph one\nend\nA --> one --> B'],
  ['only-empty', 'graph TD\nsubgraph s\nend'],
]

describe('an empty subgraph prints its title (#2694)', () => {
  it.each(SOURCES)('%s: title present', (_n, src) => {
    const title = /subgraph (\w+)/.exec(src)![1]!
    for (const useAscii of [false, true])
      expect(renderMermaidASCII(src, { useAscii })).toContain(title)
  })

  it.each(SOURCES.slice(0, 3))('%s: no frame around the title', (_n, src) => {
    const lines = renderMermaidASCII(src).split('\n')
    const row = lines.find((l) => l.includes('one'))!
    expect(row).not.toMatch(/[│┌┐└┘]\s{0,2}one|one\s{0,2}[│┌┐└┘]/)
  })

  it('an edge to a parent anchors on a real member, not an empty child', () => {
    const out = renderMermaidASCII(
      'graph LR\nA --> P\nsubgraph P\nsubgraph inner\nend\nX\nend',
    )
    expect(out).toContain('inner')
    expect(out).toMatch(/►│ │ X/)
  })

  it('a repeated empty subgraph id keeps the first title (mermaid 12.3.0)', () => {
    const out = renderMermaidASCII(
      'graph LR\nsubgraph a[First]\nend\nsubgraph a[Second]\nend\nA --> B',
    )
    expect(out).toContain('First')
    expect(out).not.toContain('Second')
  })

  it('empty subgraphs count toward maxNodes', () => {
    const src = 'graph LR\nsubgraph a\nend\nsubgraph b\nend\nA --> B'
    expect(() => renderMermaidASCII(src, { limits: { maxNodes: 3 } })).toThrow(
      /maxNodes/,
    )
  })

  it('an edge endpoint keeps a box so the arrowhead cannot clip the title', () => {
    expect(renderMermaidASCII(SOURCES[4]![1])).toContain('│ one ├')
  })

  it.each(SOURCES)('%s: ASCII and SVG snapshots', (_n, src) => {
    expect(renderMermaidASCII(src)).toMatchSnapshot('unicode')
    expect(renderMermaidASCII(src, { useAscii: true })).toMatchSnapshot('ascii')
    // Pins the CURRENT SVG, which still draws a framed box for the empty
    // subgraph; mermaid 12.3.0 shows only the title (follow-up).
    expect(renderMermaidSVG(src)).toMatchSnapshot('svg')
  })
})
