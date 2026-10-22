import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../../../../src/index.ts'

// Mermaid 12.1.0 and 12.2.0 emit viewBox "0 -70 200 187" with the title at
// x=-150, off the canvas, so it is invisible there. We draw it inside a canvas
// sized to it on purpose (docs/known-differences.md, #2282).
const src = (title: string) => `C4Context\n  title ${title}`

function box(svg: string) {
  const [x, y, w, h] = svg
    .match(/viewBox="([^"]+)"/)![1]!
    .split(' ')
    .map(Number)
  return { x: x!, y: y!, w: w!, h: h! }
}

function titleAt(svg: string) {
  const m = svg.match(/<text class="c4-title" x="([\d.]+)" y="([\d.]+)"/)!
  return { x: Number(m[1]), y: Number(m[2]) }
}

describe('C4 title-only diagram (#2282)', () => {
  it('has a non-zero viewBox with the title inside it', () => {
    const svg = renderMermaidSVG(src('Only a title'))
    const b = box(svg)
    const t = titleAt(svg)
    expect(b.w).toBeGreaterThan(0)
    expect(b.h).toBeGreaterThan(0)
    expect(t.x).toBeGreaterThanOrEqual(0)
    expect(t.x).toBeLessThan(b.w)
    expect(t.y).toBeGreaterThan(0)
    expect(t.y).toBeLessThan(b.h)
    expect(svg).toContain('>Only a title</text>')
  })

  it('widens with the title', () => {
    const short = box(renderMermaidSVG(src('Hi')))
    const long = box(
      renderMermaidSVG(src('A much much longer title for the diagram')),
    )
    expect(long.w).toBeGreaterThan(short.w + 100)
    expect(long.h).toBe(short.h)
  })

  it('draws the exact SVG', () => {
    const svg = renderMermaidSVG(src('Only a title'))
    const stable = svg
      .replace(/<style>[\s\S]*?<\/style>/, '<style/>')
      .replace(/zm-title-\d+/g, 'zm-title-N')
    expect(stable.split('\n')).toEqual([
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 176 80" width="176" height="80" role="img" aria-labelledby="zm-title-N" style="--bg:#FFFFFF;--fg:#27272A;--muted:#71717A;background:var(--bg)">',
      '  <title id="zm-title-N">Only a title</title>',
      '<style/>',
      '<text class="c4-title" x="50" y="40" dy="0.35em" font-size="16" fill="var(--_text)">Only a title</text>',
      '</svg>',
    ])
  })
})
