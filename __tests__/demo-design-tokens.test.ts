/**
 * Guards demo/components/tokens.tsx against the design canvas it was
 * extracted from (#592, part of the #590 redesign).
 *
 * The canvas — the `.dc.html` artboards published at the URL in #590's body
 * — is the source of truth for these values, and it lives outside the repo,
 * so nothing mechanical can re-derive them. What this file can do is pin
 * them: the palette below is a transcription of the artboards' shared
 * `<helmet><style>` `:root` block, so a later edit that drifts a hex or
 * drops a token fails here rather than silently shipping an off-palette
 * page. Update these expectations only alongside a canvas change.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  ACCENTS,
  BREAKPOINTS,
  COLORS,
  DESIGN_FONTS_HREF,
  DesignFontLinks,
  DesignTokensStyle,
  FONTS,
  LAYOUT,
  MEDIA,
  RADIUS,
  colorVar,
  designBaseCss,
  designTokensCss,
} from '../demo/components/tokens.tsx'

/** The canvas's `:root` block, verbatim. */
const CANVAS_PALETTE = {
  '--bg': '#0a0d16',
  '--bg-soft': '#10152a',
  '--panel': '#141a2e',
  '--panel-2': '#181f38',
  '--border': '#2a3252',
  '--text': '#eef1fb',
  '--text-dim': '#9aa3c4',
  '--text-faint': '#6b7398',
  '--blue': '#4d8dff',
  '--violet': '#a374e8',
  '--cyan': '#38e0d0',
  '--pink': '#ff5fa8',
  '--amber': '#ffb84d',
  '--green': '#3ee08a',
}

describe('COLORS', () => {
  it('matches the design canvas palette exactly', () => {
    expect(COLORS).toEqual(CANVAS_PALETTE)
  })

  it('lists the six accents the canvas cycles', () => {
    expect(ACCENTS).toEqual([
      '--blue',
      '--violet',
      '--cyan',
      '--pink',
      '--amber',
      '--green',
    ])
  })

  it('wraps a token name in var()', () => {
    expect(colorVar('--panel-2')).toBe('var(--panel-2)')
  })
})

describe('designTokensCss', () => {
  const css = designTokensCss()

  it('publishes every colour token with its canvas value', () => {
    for (const [name, value] of Object.entries(CANVAS_PALETTE)) {
      expect(css).toContain(`${name}: ${value};`)
    }
  })

  it('publishes the three font stacks as custom properties', () => {
    expect(css).toContain(`--font-display: ${FONTS.display};`)
    expect(css).toContain(`--font-body: ${FONTS.body};`)
    expect(css).toContain(`--font-mono: ${FONTS.mono};`)
  })

  it('emits a single :root block', () => {
    expect(css.match(/:root/g)).toHaveLength(1)
    expect(css.startsWith(':root {')).toBe(true)
    expect(css.trimEnd().endsWith('}')).toBe(true)
  })
})

describe('designBaseCss', () => {
  const css = designBaseCss()

  it('includes the tokens', () => {
    expect(css).toContain(designTokensCss())
  })

  it('references the fonts and ink through the custom properties', () => {
    expect(css).toContain('font-family: var(--font-body);')
    expect(css).toContain('font-family: var(--font-display);')
    expect(css).toContain('background: var(--bg);')
  })

  it('uses the canvas cyan/pink link pair', () => {
    expect(css).toContain('color: var(--cyan);')
    expect(css).toContain('color: var(--pink);')
  })
})

describe('typography', () => {
  it('loads Space Grotesk and Plus Jakarta Sans at 400-700, once', () => {
    expect(DESIGN_FONTS_HREF).toBe(
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
    )
  })

  it('puts Space Grotesk on display type and Plus Jakarta Sans on body', () => {
    expect(FONTS.display.startsWith("'Space Grotesk'")).toBe(true)
    expect(FONTS.body.startsWith("'Plus Jakarta Sans'")).toBe(true)
  })
})

describe('breakpoints', () => {
  it('breaks at the canvas widths', () => {
    expect(BREAKPOINTS).toEqual({ tablet: 900, mobile: 600 })
  })

  it('builds desktop-first media preludes from them', () => {
    expect(MEDIA.tablet).toBe('@media (max-width: 900px)')
    expect(MEDIA.mobile).toBe('@media (max-width: 600px)')
    expect(MEDIA.reducedMotion).toBe('@media (prefers-reduced-motion: reduce)')
  })

  it('gives each breakpoint band its own gutter', () => {
    expect(LAYOUT.gutter).toEqual({ desktop: 80, tablet: 32, mobile: 20 })
  })
})

describe('scales', () => {
  it('uses the canvas card and pill radii', () => {
    expect(RADIUS.card).toBe(20)
    expect(RADIUS.pill).toBe(999)
  })

  it('centres content in a 1280px column', () => {
    expect(LAYOUT.maxWidth).toBe(1280)
  })
})

describe('components', () => {
  it('emits preconnects and one stylesheet link', () => {
    const html = renderToStaticMarkup(createElement(DesignFontLinks))
    expect(html).toContain(
      '<link rel="preconnect" href="https://fonts.googleapis.com"/>',
    )
    expect(html).toContain(
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""/>',
    )
    expect(html.match(/rel="stylesheet"/g)).toHaveLength(1)
    expect(html).toContain(DESIGN_FONTS_HREF.replace(/&/g, '&amp;'))
  })

  it('wraps the base CSS in a style element', () => {
    const html = renderToStaticMarkup(createElement(DesignTokensStyle))
    expect(html.startsWith('<style>')).toBe(true)
    expect(html).toContain('--bg: #0a0d16;')
  })
})
