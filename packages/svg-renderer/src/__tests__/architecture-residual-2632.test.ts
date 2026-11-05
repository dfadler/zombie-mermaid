import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import {
  parseArchitecture,
  architectureToGraph,
} from '@zombie-mermaid/mermaid-parser'
import { layoutArchitectureGrid } from '../layout-engine/architecture-grid.ts'
import { renderMermaidSVG } from '../../../../src/index.ts'

const arch = (body: string) => `architecture-beta\n${body}`
const layout = (body: string) =>
  layoutArchitectureGrid(
    architectureToGraph(parseArchitecture(splitStatements(arch(body)))),
  )

describe('architecture residual gaps (#2632)', () => {
  it('wraps a long service label at 1.5 tiles, as Mermaid does', () => {
    const g = layout(
      'service a(server)[Gateway Load Balancer Frontend]\nservice b(database)[DB]\na:R -- L:b',
    )
    const lines = g.nodes.find((n) => n.id === 'a')!.label.split('\n')
    expect(lines.length).toBeGreaterThan(1)
    expect(g.nodes.find((n) => n.id === 'b')!.label).toBe('DB')
    expect(
      renderMermaidSVG(
        arch('service a(server)[Gateway Load Balancer Frontend]'),
      ),
    ).toContain('<tspan')
  })

  it('widens a group around an unbreakable label wider than the tile', () => {
    const word = 'Supercalifragilisticexpialidocious'
    const g = layout(`group g[G]\nservice a(server)[${word}] in g`)
    const a = g.nodes[0]!
    const box = g.groups[0]!
    expect(a.label).toBe(word)
    expect(box.x).toBeLessThan(a.x - 40)
    expect(box.x + box.width).toBeGreaterThan(a.x + a.width + 40)
  })

  it('draws every edge 3px wide and ignores curve, as Mermaid does', () => {
    const src = arch('service a(server)[A]\nservice b(server)[B]\na:R -- L:b')
    const svg = renderMermaidSVG(src)
    expect(svg).toMatch(/<(?:polyline|path) class="edge"[^>]*stroke-width="3"/)
    expect(renderMermaidSVG(src, { curve: 'basis' })).toBe(
      renderMermaidSVG(src, { curve: 'linear' }),
    )
  })

  it('marks groups as architecture groups without an icon sentinel', () => {
    const g = layout(
      'group a(server)[A]\ngroup b[B]\nservice s in a\nservice t in b',
    )
    expect(g.groups.map((x) => x.architecture)).toEqual([true, true])
    expect(g.groups.map((x) => x.icon)).toEqual(['server', undefined])
  })

  it('takes group chrome colour from the theme token and draws no icon tile for an icon-less group', () => {
    const svg = renderMermaidSVG(arch('group b[B]\nservice t in b'))
    expect(svg).toContain(
      'stroke="var(--_node-stroke)" stroke-width="2" stroke-dasharray="8"',
    )
    expect(svg).not.toContain('hsl(240')
    expect(svg).not.toContain('scale(0.38)')
  })
})
