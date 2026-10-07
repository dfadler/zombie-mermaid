/**
 * Regression tests for #1386: a start marker on its own draws nothing.
 *
 * Mermaid only draws a start marker when the end carries the matching one
 * (`<-->`, `o--o`, `x--x`). `Top <-.- Bot`, `A <--- B` and `A o--- B` parse,
 * but render as a plain line with no marker at all — the marker is dropped,
 * not kept as a lone start arrowhead. Verified against Mermaid 11.17.2:
 *
 *   <-.-   none / none        <-.->  point / point
 *   <---   none / none        <-->   point / point
 *   o---   none / none        o--o   circle / circle
 *   o--x   none / cross       <--x   none / cross
 *
 * The two-character bodies (`<--`, `o--`) are not valid Mermaid, so they keep
 * their existing lenient reading and are not covered here.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../index.ts'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const edge = (link: string) => parseMermaid(`graph TD\n  A ${link} B`).edges[0]!

describe('start marker without a matching end marker (#1386)', () => {
  it.each(['<-.-', '<---', '<===', 'o---', 'x---', 'o-.-', 'x-.-'])(
    'drops the start marker on %s',
    (link) => {
      const e = edge(link)
      expect(e.hasArrowStart).toBe(false)
      expect(e.hasArrowEnd).toBe(false)
      expect(e.startMarker).toBeUndefined()
    },
  )

  it.each(['<--x', '<-.-x', 'o--x', 'x--o', 'o-.->'])(
    'drops the start marker but keeps the end marker on %s',
    (link) => {
      const e = edge(link)
      expect(e.hasArrowStart).toBe(false)
      expect(e.startMarker).toBeUndefined()
      expect(e.hasArrowEnd).toBe(true)
    },
  )

  it.each([
    ['<-->', true, undefined],
    ['<-.->', true, undefined],
    ['<==>', true, undefined],
    ['o--o', true, 'circle'],
    ['x--x', true, 'cross'],
  ] as const)('keeps the start marker on %s', (link, start, kind) => {
    const e = edge(link)
    expect(e.hasArrowStart).toBe(start)
    expect(e.startMarker).toBe(kind)
    expect(e.hasArrowEnd).toBe(true)
  })

  it('keeps the lenient two-character bodies', () => {
    expect(edge('<--').hasArrowStart).toBe(true)
    expect(edge('<==').hasArrowStart).toBe(true)
  })
})

describe('Top <--> Bot beside Top <-.- Bot (#1386)', () => {
  const source = 'graph TD\n  Top <--> Bot\n  Top <-.- Bot'

  it('SVG: the solid edge has both markers, the dotted edge has none', () => {
    const svg = renderMermaidSVG(source)
    const edges = [...svg.matchAll(/<polyline class="edge"[^>]*>/g)].map(
      (m) => m[0],
    )
    expect(edges).toHaveLength(2)
    const [solid, dotted] = edges as [string, string]
    expect(solid).toContain('data-style="solid"')
    expect(solid).toContain('marker-start="url(#arrowhead-start)"')
    expect(solid).toContain('marker-end="url(#arrowhead)"')
    expect(dotted).toContain('data-style="dotted"')
    expect(dotted).not.toContain('marker-start')
    expect(dotted).not.toContain('marker-end')
  })

  it('ASCII: arrowheads only on the solid edge', () => {
    const ascii = renderMermaidASCII(source, { colorMode: 'none' })
    expect(ascii).toBe(
      [
        '┌─────┐  ',
        '│     │  ',
        '│ Top ├┄┐',
        '│     │ ┆',
        '└──▲──┘ ┆',
        '   │    ┆',
        '   │    ┆',
        '   │    ┆',
        '   │    ┆',
        '   ▼    ┆',
        '┌─────┐ ┆',
        '│     │ ┆',
        '│ Bot │┄┘',
        '│     │  ',
        '└─────┘  ',
      ].join('\n'),
    )
  })
})
