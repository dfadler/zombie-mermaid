/**
 * Opt-in `describe: 'auto'` (#1879): deterministic <desc> from the parsed
 * graph. ASCII has no analogue (no <desc>/ARIA in plain text), so there is
 * no ASCII snapshot; the default SVG staying byte-identical is asserted here.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const SRC = 'graph LR\n  A[Build] -->|ok| B[Ship <b>it</b>]'
const desc = (svg: string) => svg.match(/<desc [^>]*>([^<]*)<\/desc>/)?.[1]

describe('describe: auto', () => {
  it('is off by default (no <desc>, output unchanged)', () => {
    const svg = renderMermaidSVG(SRC)
    expect(svg).not.toContain('<desc')
    expect(renderMermaidSVG(SRC, { describe: undefined })).toBe(svg)
  })

  it('builds a description from the graph, <desc>-only (no title)', () => {
    const svg = renderMermaidSVG(SRC, { describe: 'auto' })
    expect(desc(svg)).toBe(
      'Diagram with 2 nodes and 1 connection: Build to Ship &lt;b&gt;it&lt;/b&gt; (ok)',
    )
    expect(svg).toMatch(/aria-describedby="zm-desc-\d+"/)
    expect(svg).not.toContain('<title')
    expect(svg).not.toContain('aria-labelledby')
  })

  it('is deterministic', () => {
    const d = () => desc(renderMermaidSVG(SRC, { describe: 'auto' }))
    expect(d()).toBe(d())
  })

  it('accDescr wins over the generated text', () => {
    const svg = renderMermaidSVG(`${SRC}\n  accDescr: mine`, {
      describe: 'auto',
    })
    expect(desc(svg)).toBe('mine')
  })

  it('caps the length at 500 characters', () => {
    const big = `graph LR\n${Array.from({ length: 80 }, (_, i) => `  N${i}[Node number ${i}] --> M${i}`).join('\n')}`
    const d = desc(renderMermaidSVG(big, { describe: 'auto' }))!
    expect(d.length).toBeLessThanOrEqual(500)
    expect(d.endsWith('…')).toBe(true)
  })

  it('leaves non-graph diagrams (pie) unchanged', () => {
    const pie = 'pie\n  "Yes" : 70\n  "No" : 30'
    expect(renderMermaidSVG(pie, { describe: 'auto' })).toBe(
      renderMermaidSVG(pie),
    )
  })
})
