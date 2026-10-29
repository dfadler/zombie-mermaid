/** Opt-in `RenderOptions.dark` -> `prefers-color-scheme: dark` rule (#1877). */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const SRC = 'graph LR\n  A --> B'
const dark = { bg: '#111', fg: '#eee' }

describe('RenderOptions.dark (#1877)', () => {
  it('leaves default output free of any color-scheme rule', () => {
    expect(renderMermaidSVG(SRC)).not.toContain('prefers-color-scheme')
    expect(renderMermaidSVG(SRC, { dark: undefined })).toBe(
      renderMermaidSVG(SRC),
    )
  })

  it('adds an !important dark rule that beats the root style attribute', () => {
    const svg = renderMermaidSVG(SRC, { dark })
    expect(svg).toMatch(
      /@media \(prefers-color-scheme: dark\) \{ svg \{ --bg: #111 !important; --fg: #eee !important;/,
    )
    // Unset enrichment vars reset so the color-mix fallbacks apply again
    expect(svg).toContain('--muted: initial !important;')
    expect(svg).toMatch(/style="--bg:#[0-9a-f]+;/i)
  })

  it.each([
    'sequenceDiagram\n  A->>B: hi',
    'classDiagram\n  A <|-- B',
    'erDiagram\n  A ||--o{ B : has',
    'pie\n  "a" : 1',
    'xychart-beta\n  line [1, 2]',
  ])('applies to %j', (src) => {
    expect(renderMermaidSVG(src, { dark })).toContain('prefers-color-scheme')
  })

  it('carries the nonce and honours explicit enrichment colors', () => {
    const svg = renderMermaidSVG(SRC, {
      nonce: 'abc',
      dark: { ...dark, line: '#888' },
    })
    expect(svg).toMatch(/<style nonce="abc">\s*@media \(prefers-color-scheme/)
    expect(svg).toContain('--line: #888 !important;')
  })

  it('is ignored under resolveColors, which bakes in one palette', () => {
    expect(renderMermaidSVG(SRC, { dark, resolveColors: true })).not.toContain(
      'prefers-color-scheme',
    )
  })
})
