/**
 * #2884: palette custom properties (`--mm-color-N`, `--pie-color-N`, …) were
 * declared under a bare `svg { … }` rule. A `<style>` block in inline SVG is
 * document-global, so with two differently themed diagrams on one page the
 * later stylesheet repainted the earlier diagram. Each diagram now declares
 * them on its own `zm-pal-*` root class.
 */
import { describe, it, expect } from 'vitest'
import { paletteClass, withRootClass } from '@zombie-mermaid/core'
import { renderMermaidSVG } from '../../../../src/index.ts'

const SOURCES: Record<string, string> = {
  mindmap: 'mindmap\n  root((r))\n    a\n    b',
  pie: 'pie\n  "a" : 1\n  "b" : 2',
  xychart: 'xychart-beta\n  x-axis [a, b]\n  bar [1, 2]\n  line [2, 1]',
  timeline: 'timeline\n  2020 : a\n  2021 : b',
  radar: 'radar-beta\n  axis a, b, c\n  curve x{1, 2, 3}\n  curve y{3, 2, 1}',
}

/** Pie only follows the accent on a dark background (#2855). */
const BASE: Record<string, { bg?: string }> = { pie: { bg: '#101010' } }

/** Root class and the declarations the page's cascade gives that diagram. */
function paletteFor(svg: string, page: string): string[] {
  const cls = /^<svg [^>]*class="(zm-pal-[a-z0-9]+)"/.exec(svg)?.[1]
  expect(cls).toBeDefined()
  const vars: string[] = []
  for (const m of page.matchAll(/\.(zm-pal-[a-z0-9]+) \{([^}]*)\}/g)) {
    if (m[1] === cls) vars.push(m[2]!.replace(/\s+/g, ' ').trim())
  }
  return vars
}

describe('palette isolation across inline SVGs (#2884)', () => {
  for (const [type, src] of Object.entries(SOURCES)) {
    it(`${type}: two accents on one page keep their own palette`, () => {
      const a = renderMermaidSVG(src, { ...BASE[type], accent: '#ff0000' })
      const b = renderMermaidSVG(src, { ...BASE[type], accent: '#0000ff' })
      const page = a + b
      // Nothing may declare a palette on every <svg> in the document.
      expect(page).not.toMatch(/(^|\n)\s*svg \{\s*--(mm|pie|xychart|timeline)-/)
      const pa = paletteFor(a, page)
      const pb = paletteFor(b, page)
      expect(pa).toHaveLength(1)
      expect(pb).toHaveLength(1)
      expect(pa[0]).not.toBe(pb[0])
      // Order on the page does not matter: each class keeps its own values.
      expect(paletteFor(a, b + a)).toEqual(pa)
    })

    it(`${type}: identical palettes share one class, output is deterministic`, () => {
      expect(renderMermaidSVG(src, { accent: '#123456' })).toBe(
        renderMermaidSVG(src, { accent: '#123456' }),
      )
    })
  }

  it('helpers', () => {
    expect(paletteClass(['a'])).not.toBe(paletteClass(['b']))
    expect(withRootClass('<svg x="1">', 'c')).toBe('<svg class="c" x="1">')
  })
})
