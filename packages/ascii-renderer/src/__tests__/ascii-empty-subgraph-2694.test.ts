/**
 * #2694: an empty flowchart subgraph was dropped from the ASCII output.
 * Mermaid 12.3.0 (scratch install, headless Chromium) draws it as a cluster
 * rect of height 0 (no visible frame) with its title text laid out like a node
 * in the first rank: above the first node in LR, left of it in TD. So ASCII
 * prints the title only. #2784 measured where the title goes (user units, the
 * title box is 24 high): its top sits on the slot's centre line (TD: level with
 * the first node's centre; as an edge endpoint: on the edge's line, between two
 * arrows with no box). Pixel positions differ because the layout is ELK's, not
 * dagre's; the relative placement is asserted below. Not matched: a nested title
 * in TD sits outside its parent's frame in mermaid (#2784).
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
  ['edge-endpoint-td', 'graph TD\nsubgraph one\nend\nA --> one --> B'],
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

  it('a horizontal edge endpoint is bare text between two arrows, no box (#2784)', () => {
    const out = renderMermaidASCII(SOURCES[4]![1])
    expect(out).toMatch(/►\s+one─+►/)
    expect(out).not.toMatch(/│ one/)
  })

  it('a vertical edge endpoint keeps a box so the edge cannot run through the title', () => {
    expect(renderMermaidASCII(SOURCES[6]![1])).toContain('│ one │')
  })

  it('SVG hangs the title from the slot centre, below the frame-title line (#2784)', () => {
    const y = (src: string) =>
      Number(
        /data-id="one"[^>]*>\s*<text x="[\d.]+" y="([\d.]+)"/.exec(
          renderMermaidSVG(src),
        )![1],
      )
    // Edge endpoint: the title's top is on the line the edges run along (the
    // neighbours' centre), so its centre is half a title box (12) below it.
    const edge = renderMermaidSVG(SOURCES[4]![1])
    const aMid = Number(/<text x="[\d.]+" y="([\d.]+)"[^>]*>A</.exec(edge)![1])
    expect(Math.abs(y(SOURCES[4]![1]) - 12 - aMid)).toBeLessThan(1)
  })

  it('SVG draws an empty subgraph as its title only, no frame (#2726)', () => {
    const svg = renderMermaidSVG(SOURCES[0]![1])
    const g = /<g class="subgraph"[^>]*>([\s\S]*?)<\/g>/.exec(svg)![1]!
    expect(g).toContain('>one</text>')
    expect(g).not.toContain('<rect')
    // A filled subgraph keeps its frame, and so does a filled parent of an empty one.
    const nested = renderMermaidSVG(SOURCES[3]![1])
    expect(nested).toMatch(/data-id="outer"[^>]*>\s*<rect/)
    expect(nested).not.toMatch(/data-id="inner"[^>]*>\s*<rect/)
  })

  it.each(SOURCES)('%s: ASCII and SVG snapshots', (_n, src) => {
    expect(renderMermaidASCII(src)).toMatchSnapshot('unicode')
    expect(renderMermaidASCII(src, { useAscii: true })).toMatchSnapshot('ascii')
    expect(renderMermaidSVG(src)).toMatchSnapshot('svg')
  })
})
