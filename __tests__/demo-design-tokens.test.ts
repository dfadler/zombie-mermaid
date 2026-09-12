// @vitest-environment jsdom
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
 *
 * This is a deliberate exception to this repo's default RTL pattern
 * (`docs/testing-conventions.md`'s "design-canvas fidelity checks"): the
 * literal-value pinning stays exactly as strict as ever, but per that doc
 * the *query mechanism* should still go through React Testing Library for
 * consistency with the rest of `demo/**`'s tests, rather than
 * `renderToStaticMarkup` + string/regex matching on serialized markup.
 * `tokens.tsx` has no interactive behavior to drive, so `DesignFontLinks`
 * and `DesignTokensStyle` are rendered with `render()` and asserted on via
 * real DOM nodes — `container.querySelector`, and the `<style>` element's
 * own parsed `CSSStyleSheet` (`sheet.cssRules`) for its custom properties —
 * instead of parsing an HTML string.
 */
import { createElement } from 'react'
import { render } from '@testing-library/react'
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
  LEGACY_BREAKPOINTS,
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

describe('LEGACY_BREAKPOINTS', () => {
  // Pins the #1030 consolidation: the pre-redesign pages' breakpoints, one
  // named constant per distinct pixel value. See
  // __tests__/demo-legacy-breakpoints-sync.test.ts for the check that every
  // tagged @media rule in the CSS files actually using these still matches.
  it('names every distinct legacy breakpoint value', () => {
    expect(LEGACY_BREAKPOINTS).toEqual({
      mobile: 600,
      tapTarget: 640,
      diagramStack: 720,
      compact: 768,
      tablet: 900,
      desktopMin: 1000,
      desktopBelow: 1023,
    })
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
    // React 19 treats a bare `<link rel="preconnect">` as a hoistable
    // resource and moves it into `document.head` on mount regardless of
    // where it's rendered (this is real React behavior, not a jsdom quirk —
    // see https://react.dev/reference/react-dom/components/link). A plain
    // `<link rel="stylesheet">` with no `precedence` prop isn't treated as a
    // resource, so it renders in place instead — hence querying two
    // different roots below.
    const { container } = render(createElement(DesignFontLinks))

    const preconnects = Array.from(
      document.head.querySelectorAll('link[rel="preconnect"]'),
    )
    expect(preconnects).toHaveLength(2)
    expect(preconnects.map((link) => link.getAttribute('href')).sort()).toEqual(
      ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
    )
    const gstaticPreconnect = preconnects.find(
      (link) => link.getAttribute('href') === 'https://fonts.gstatic.com',
    )
    expect(gstaticPreconnect?.hasAttribute('crossorigin')).toBe(true)
    expect(gstaticPreconnect?.getAttribute('crossorigin')).toBe('')

    const stylesheets = container.querySelectorAll('link[rel="stylesheet"]')
    expect(stylesheets).toHaveLength(1)
    expect(stylesheets[0]?.getAttribute('href')).toBe(DESIGN_FONTS_HREF)
  })

  it('wraps the base CSS in a style element', () => {
    const { container } = render(createElement(DesignTokensStyle))

    expect(container.children).toHaveLength(1)
    const styleEl = container.firstElementChild
    if (!(styleEl instanceof HTMLStyleElement)) {
      throw new Error(`expected a <style> element, got ${styleEl?.tagName}`)
    }
    expect(styleEl.textContent).toBe(designBaseCss())

    // Read the token back through the real, parsed CSSOM — not a string
    // match on the element's serialized markup — the way a stylesheet
    // consumer actually resolves a custom property.
    const rootRule = Array.from(styleEl.sheet?.cssRules ?? []).find(
      (rule): rule is CSSStyleRule =>
        'selectorText' in rule && rule.selectorText === ':root',
    )
    expect(rootRule?.style.getPropertyValue('--bg').trim()).toBe(
      CANVAS_PALETTE['--bg'],
    )
  })
})
