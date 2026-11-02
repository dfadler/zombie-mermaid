/**
 * #2518: an architecture service is an icon tile in SVG, as in mermaid 12.2.0
 * (the pin and npm latest when written): an 80px blue tile with a white glyph
 * for a built-in icon, a `?` tile for a name Mermaid does not know, a dashed
 * empty box for no icon, with the label under it. ASCII has no glyph, so its
 * snapshots pin the shapes it already drew.
 */
import { describe, expect, it } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import {
  architectureToGraph,
  parseArchitecture,
} from '@zombie-mermaid/mermaid-parser'
import { layoutFlowchartSync } from '@zombie-mermaid/svg-renderer'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'

const CASES: [string, string][] = [
  ['database', 'service a(database)[Database]'],
  ['disk', 'service a(disk)[Disk]'],
  ['server', 'service a(server)[Server]'],
  ['cloud', 'service a(cloud)[Cloud]'],
  ['internet', 'service a(internet)[Web]'],
  ['blank', 'service a(blank)[Blank]'],
  ['unknown icon', 'service a(not-a-real-icon)[Unknown Icon]'],
  ['no icon', 'service a[No Icon]'],
]
const src = (decl: string): string => `architecture-beta\n  ${decl}`

describe('architecture service icon tiles (#2518)', () => {
  it.each(CASES)('SVG: %s', (_name, decl) => {
    expect(renderMermaidSVG(src(decl))).toMatchSnapshot()
  })

  it.each(CASES)('ASCII: %s', (_name, decl) => {
    expect(renderMermaidASCII(src(decl))).toMatchSnapshot()
  })

  it('draws the tile 80px square with the label below it', () => {
    const svg = renderMermaidSVG(src('service a(server)[Server]'))
    expect(svg).toContain('width="80" height="80" fill="#087ebf"')
    expect(svg).toContain('data-shape="rectangle"')
    const tile = Number(/translate\([\d.]+ ([\d.]+)\)/.exec(svg)![1])
    const label = Number(/<text[^>]* y="([\d.]+)"/.exec(svg)![1])
    expect(label).toBeGreaterThan(tile + 80)
  })

  it('draws one tile per service and none for a junction', () => {
    const svg = renderMermaidSVG(
      'architecture-beta\n  service a(database)[A]\n  service b(internet)[B]\n  junction j\n  a:R -- L:j\n  j:R -- L:b',
    )
    expect(svg.match(/fill="#087ebf"/g)).toHaveLength(2)
  })

  it('sizes an iconed node as a tile in the simple layout too', () => {
    const g = layoutFlowchartSync(
      architectureToGraph(
        parseArchitecture(
          splitStatements(src('service a(database)[A]\n  service b(disk)[B]')),
        ),
      ),
      { layout: 'simple' },
    )
    expect(g.nodes.map((n) => [n.width, n.height, n.shape, n.icon])).toEqual([
      [80, 80, 'rectangle', 'database'],
      [80, 80, 'rectangle', 'disk'],
    ])
  })
})
