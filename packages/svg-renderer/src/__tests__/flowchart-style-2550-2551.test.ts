/**
 * #2550: `style`/`class` on a subgraph id styles its cluster. #2551: a node
 * `style` keeps `stroke-dasharray` and `rx`/`ry`. Mermaid 12.3.0 applies all
 * of them to the cluster/node rect.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const sub = (extra: string) =>
  renderMermaidSVG(`flowchart TD\nsubgraph one [T]\nA-->B\nend\n${extra}`)

describe('subgraph style (#2550)', () => {
  it('applies `style` to the cluster, which has no header band (#2636)', () => {
    const svg = sub(
      'style one fill:#fdd,stroke:#f00,stroke-width:3px,stroke-dasharray:4 2,color:#00f',
    )
    expect(
      svg.match(/fill="#fdd" stroke="#f00" stroke-width="3px"/g),
    ).toHaveLength(1)
    expect(svg).toContain('stroke-dasharray="4 2"')
    expect(svg).toContain('fill="#00f"')
  })
  it('applies `class`, but not `classDef default`', () => {
    expect(sub('classDef c fill:#dfd\nclass one c')).toContain('fill="#dfd"')
    // The cluster rects come before the first edge; nodes after it do take #abc
    const svg = sub('classDef default fill:#abc')
    expect(svg.split('<path class="edge"')[0]).not.toContain('#abc')
  })
  it('leaves an unstyled cluster alone', () => {
    expect(sub('')).not.toContain('stroke-dasharray')
  })
})

describe('node style dasharray and radius (#2551)', () => {
  const node = (s: string) => renderMermaidSVG(`flowchart LR\nA\n${s}`)
  it('keeps stroke-dasharray on any shape', () => {
    expect(node('style A stroke-dasharray:5 5')).toContain(
      '<g stroke-dasharray="5 5">',
    )
    expect(
      renderMermaidSVG('flowchart LR\nA{x}\nstyle A stroke-dasharray:5 5'),
    ).toContain('<g stroke-dasharray="5 5">')
  })
  it('drops a non-numeric dasharray', () => {
    expect(node('style A stroke-dasharray:url(x)')).not.toContain('dasharray')
  })
  it('rounds a rectangle from rx/ry', () => {
    expect(node('style A rx:10,ry:6')).toContain('rx="10" ry="6"')
    expect(node('style A rx:10px')).toContain('rx="10" ry="10"')
    expect(node('style A rx:bad')).toContain('rx="0" ry="0"')
  })
})
