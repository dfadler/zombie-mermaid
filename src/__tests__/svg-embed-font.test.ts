/**
 * `RenderOptions.embedFont: 'subset'` (#1867): off by default, and when on the
 * SVG carries an inline Inter `@font-face` instead of the Google Fonts
 * `@import`. The data loads lazily, so the sync API needs `loadEmbeddedFont()`.
 */
import { describe, it, expect, vi } from 'vitest'

const SRC = 'graph TD\n  A[Start] --> B[End]'

describe('embedFont', () => {
  it('sync render with embedFont "subset" throws until the font is loaded', async () => {
    vi.resetModules()
    const m = await import('../index.ts')
    expect(() => m.renderMermaidSVG(SRC, { embedFont: 'subset' })).toThrow(
      /loadEmbeddedFont/,
    )
    await m.loadEmbeddedFont()
    expect(() => m.renderMermaidSVG(SRC, { embedFont: 'subset' })).not.toThrow()
  })

  it('is absent by default and for embedFont: false', async () => {
    const { renderMermaidSVG, loadEmbeddedFont } = await import('../index.ts')
    await loadEmbeddedFont() // Data being loaded must not switch it on.
    for (const options of [{}, { embedFont: false as const }]) {
      const svg = renderMermaidSVG(SRC, options)
      expect(svg).toContain('fonts.googleapis.com')
      expect(svg).not.toContain('@font-face')
      expect(svg).not.toContain('data:font/woff2')
    }
  })

  it('embeds a woff2 subset and drops the @import when opted in (async)', async () => {
    const { renderMermaidSVGAsync } = await import('../index.ts')
    const svg = await renderMermaidSVGAsync(SRC, { embedFont: 'subset' })
    expect(svg).not.toContain('fonts.googleapis.com')
    expect(svg).toContain("font-family: 'Inter'")
    expect(svg).toContain('data:font/woff2;base64,d09GMg') // wOF2 magic
    expect(svg).toContain('unicode-range: U+0020-007E')
  })

  it('embeds in every diagram type that uses the shared style block', async () => {
    const { renderMermaidSVGAsync } = await import('../index.ts')
    const sources = [
      'sequenceDiagram\n  A->>B: hi',
      'classDiagram\n  class A {\n    +go() void\n  }',
      'erDiagram\n  A ||--o{ B : has',
      'pie\n  "a" : 1\n  "b" : 2',
    ]
    for (const src of sources) {
      const svg = await renderMermaidSVGAsync(src, { embedFont: 'subset' })
      expect(svg, src).toContain('data:font/woff2')
      expect(svg, src).not.toContain('fonts.googleapis.com')
    }
  })

  it('is ignored for a non-Inter font (its @import stays)', async () => {
    const { renderMermaidSVGAsync } = await import('../index.ts')
    const svg = await renderMermaidSVGAsync(SRC, {
      embedFont: 'subset',
      font: 'Roboto',
    })
    expect(svg).toContain('family=Roboto')
    expect(svg).not.toContain('Inter')
  })

  it('does not change layout (embedFont only touches the <style> block)', async () => {
    const { renderMermaidSVGAsync } = await import('../index.ts')
    const strip = (s: string) =>
      s.slice(s.indexOf('</style>')).replace(/zm[a-z0-9]+-/g, 'zm-')
    const on = await renderMermaidSVGAsync(SRC, { embedFont: 'subset' })
    const off = await renderMermaidSVGAsync(SRC)
    expect(strip(on)).toBe(strip(off))
  })
})
