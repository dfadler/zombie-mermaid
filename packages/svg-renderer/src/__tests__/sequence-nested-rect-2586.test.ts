/** #2586: a nested `rect` must paint above its outer `rect` (Mermaid 12.3.0). */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

describe('nested rect z-order (#2586)', () => {
  it('draws the outer rect before the inner one', () => {
    const svg = renderMermaidSVG(
      [
        'sequenceDiagram',
        'A->>B: outer',
        'rect rgb(200, 220, 255)',
        'A->>B: x',
        'rect rgb(255, 220, 200)',
        'B->>A: inner',
        'end',
        'end',
      ].join('\n'),
    )
    const outer = svg.indexOf('rgb(200, 220, 255)')
    const inner = svg.indexOf('rgb(255, 220, 200)')
    expect(outer).toBeGreaterThan(-1)
    expect(inner).toBeGreaterThan(outer)
  })
})
