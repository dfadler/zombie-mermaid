/**
 * Guards demo/components/primitives.tsx against the design canvas it was
 * extracted from (#595, part of #591, part of the #590 redesign).
 *
 * Same contract as demo-design-tokens.test.ts: the canvas — the `.dc.html`
 * artboards published at the URL in #590's body — is the source of truth and
 * lives outside the repo, so nothing mechanical can re-derive it. What this
 * file can do is pin it. Every string in CANVAS_* below is a transcription
 * of what the artboards actually declare, so a later edit that drifts a
 * value or drops a variant fails here rather than silently shipping
 * off-design markup. Update these expectations only alongside a canvas
 * change.
 *
 * The base rules come from the sixteen showcase artboards' shared
 * `<helmet><style>` preamble, which is byte-identical across all sixteen.
 * The variant declarations come from the usage sites that spell them out
 * inline; each CANVAS_* comment names the treatment it was taken from.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ACCENTS, COLORS } from '../demo/components/tokens.tsx'
import {
  ACCENT_NAMES,
  CTA,
  Card,
  Pill,
  PrimitivesStyle,
  SectionEyebrow,
  accentRgba,
  accentToken,
  accentVar,
  primitivesCss,
  type Accent,
} from '../demo/components/primitives.tsx'

/** Renders a component to static HTML, the way the site's generators do. */
function render(
  component: Parameters<typeof createElement>[0],
  props: Record<string, unknown> = {},
): string {
  return renderToStaticMarkup(createElement(component, props))
}

/**
 * The `.card`, `.pill`, and `.section-eyebrow` rules from the artboards'
 * shared preamble, verbatim — whitespace-normalised so the comparison is
 * against the declarations rather than the indentation.
 */
const CANVAS_BASE_RULES = {
  card: [
    'background: var(--panel);',
    'border: 1px solid var(--border);',
    'border-radius: 20px;',
  ],
  pill: [
    'display: inline-flex;',
    'align-items: center;',
    'gap: 10px;',
    'border-radius: 999px;',
    'padding: 12px 22px;',
    'font-size: 15px;',
    'font-weight: 600;',
  ],
  'section-eyebrow': [
    'text-transform: uppercase;',
    'letter-spacing: 0.14em;',
    'font-size: 13px;',
    'font-weight: 700;',
    'color: var(--cyan);',
  ],
}

/**
 * The accent washes the artboards spell out as `rgba(...)` literals: 0.16
 * behind a glowing icon panel, 0.14 behind a tinted badge.
 */
const CANVAS_RGBA = {
  blue: { 0.16: 'rgba(77,141,255,0.16)', 0.14: 'rgba(77,141,255,0.14)' },
  violet: { 0.16: 'rgba(163,116,232,0.16)', 0.14: 'rgba(163,116,232,0.14)' },
  cyan: { 0.16: 'rgba(56,224,208,0.16)', 0.14: 'rgba(56,224,208,0.14)' },
  pink: { 0.16: 'rgba(255,95,168,0.16)', 0.14: 'rgba(255,95,168,0.14)' },
  amber: { 0.16: 'rgba(255,184,77,0.16)', 0.14: 'rgba(255,184,77,0.14)' },
  green: { 0.16: 'rgba(62,224,138,0.16)', 0.14: 'rgba(62,224,138,0.14)' },
} satisfies Record<Accent, Record<string, string>>

describe('accents', () => {
  it('names the same six accents tokens.tsx lists, in the same order', () => {
    expect(ACCENT_NAMES.map(accentToken)).toEqual([...ACCENTS])
  })

  it('maps a name to its custom property', () => {
    expect(accentToken('violet')).toBe('--violet')
    expect(accentVar('violet')).toBe('var(--violet)')
  })

  it('derives the canvas rgba literals from the palette', () => {
    for (const accent of ACCENT_NAMES) {
      expect(accentRgba(accent, 0.16)).toBe(CANVAS_RGBA[accent][0.16])
      expect(accentRgba(accent, 0.14)).toBe(CANVAS_RGBA[accent][0.14])
    }
  })

  it('covers every accent in the palette and nothing else', () => {
    const paletteAccents = ACCENT_NAMES.map((a) => COLORS[accentToken(a)])
    expect(new Set(paletteAccents).size).toBe(6)
  })
})

describe('primitivesCss', () => {
  const css = primitivesCss()

  it('reproduces every declaration of the three canvas base rules', () => {
    for (const declarations of Object.values(CANVAS_BASE_RULES)) {
      for (const declaration of declarations) {
        expect(css).toContain(declaration)
      }
    }
  })

  it('defines each base class exactly once', () => {
    for (const selector of Object.keys(CANVAS_BASE_RULES)) {
      expect(css.match(new RegExp(`\\.${selector} \\{`, 'g'))).toHaveLength(1)
    }
  })

  it('points .mono at the tokens module font stack', () => {
    expect(css).toContain('font-family: var(--font-mono);')
  })

  it('wraps in a style element', () => {
    const html = render(PrimitivesStyle)
    expect(html.startsWith('<style>')).toBe(true)
    expect(html).toContain('border-radius: 20px;')
  })
})

describe('Card', () => {
  it('renders the bare canvas class with no variant styling', () => {
    expect(render(Card, { children: 'Body' })).toBe(
      '<div class="card">Body</div>',
    )
  })

  it('tints only the border for an accent', () => {
    const html = render(Card, { accent: 'violet', children: 'x' })
    expect(html).toContain('border-color:var(--violet)')
    expect(html).not.toContain('background')
  })

  it('reproduces the canvas glow panel for every accent', () => {
    for (const accent of ACCENT_NAMES) {
      const html = render(Card, { accent, tone: 'glow', children: 'x' })
      expect(html).toContain(
        `radial-gradient(circle at 50% 45%, ${CANVAS_RGBA[accent][0.16]} 0%, var(--panel) 68%)`,
      )
      expect(html).toContain(`border-color:var(--${accent})`)
    }
  })

  it('falls back to the panel fill when glow has no accent', () => {
    const html = render(Card, { tone: 'glow', children: 'x' })
    expect(html).not.toContain('radial-gradient')
  })

  it('recesses a sunken card onto the page background', () => {
    expect(render(Card, { tone: 'sunken', children: 'x' })).toContain(
      'background:var(--bg)',
    )
  })

  it('renders an anchor when given an href', () => {
    const html = render(Card, {
      href: '#flowchart',
      accent: 'blue',
      className: 'crosslink-card',
      padding: 22,
      children: 'Flowchart',
    })
    expect(html).toContain('<a class="card crosslink-card"')
    expect(html).toContain('href="#flowchart"')
    expect(html).toContain('padding:22px')
  })

  it('lets a style prop win over the variant', () => {
    const html = render(Card, {
      accent: 'green',
      style: { borderColor: 'var(--pink)' },
      children: 'x',
    })
    expect(html).toContain('border-color:var(--pink)')
    expect(html).not.toContain('var(--green)')
  })
})

describe('Pill', () => {
  it('defaults to the muted treatment with no accent', () => {
    const html = render(Pill, { children: 'v1.2.0' })
    expect(html).toContain('class="pill"')
    expect(html).toContain('background:var(--panel)')
    expect(html).toContain('border:1px solid var(--border)')
    expect(html).toContain('color:var(--text-dim)')
  })

  it('defaults to solid once an accent is given', () => {
    const html = render(Pill, { accent: 'violet', children: 'Demo' })
    expect(html).toContain('background:var(--violet)')
    expect(html).toContain('color:var(--bg)')
    expect(html).toContain('font-weight:700')
  })

  it('renders each variant for each accent', () => {
    for (const accent of ACCENT_NAMES) {
      const outline = render(Pill, {
        accent,
        variant: 'outline',
        children: 'x',
      })
      expect(outline).toContain('background:var(--panel)')
      expect(outline).toContain(`border:1px solid var(--${accent})`)
      expect(outline).toContain(`color:var(--${accent})`)

      const tint = render(Pill, { accent, variant: 'tint', children: 'x' })
      expect(tint).toContain(`background:${CANVAS_RGBA[accent][0.14]}`)
      expect(tint).toContain(`border:1px solid var(--${accent})`)

      const solid = render(Pill, { accent, variant: 'solid', children: 'x' })
      expect(solid).toContain(`background:var(--${accent})`)
      expect(solid).toContain('color:var(--bg)')
    }
  })

  it('adds the mono class and an overridden size', () => {
    const html = render(Pill, {
      mono: true,
      fontSize: 11,
      children: 'npm install zombie-mermaid',
    })
    expect(html).toContain('class="pill mono"')
    expect(html).toContain('font-size:11px')
  })

  it('ignores an accent variant asked for without an accent', () => {
    const html = render(Pill, { variant: 'tint', children: 'x' })
    expect(html).toContain('color:var(--text-dim)')
    expect(html).not.toContain('rgba')
  })
})

describe('SectionEyebrow', () => {
  it('renders the bare canvas class, which is already cyan', () => {
    expect(render(SectionEyebrow, { children: 'Diagrams' })).toBe(
      '<div class="section-eyebrow">Diagrams</div>',
    )
  })

  it('recolours to any accent', () => {
    for (const accent of ACCENT_NAMES) {
      expect(render(SectionEyebrow, { accent, children: 'x' })).toContain(
        `color:var(--${accent})`,
      )
    }
  })
})

describe('CTA', () => {
  it('reproduces the home hero CTA', () => {
    const html = render(CTA, {
      href: '#demo',
      children: 'View the live demo',
    })
    expect(html).toContain('<a class="pill"')
    expect(html).toContain('href="#demo"')
    expect(html).toContain('background:var(--violet)')
    expect(html).toContain('color:var(--bg)')
    expect(html).toContain('font-weight:700')
    expect(html).toContain('View the live demo')
  })

  it('draws the canvas arrow, stroked with the button ink', () => {
    const html = render(CTA, { href: '#x', children: 'Go' })
    expect(html).toContain('d="M5 12h14M13 6l6 6-6 6"')
    expect(html).toContain('stroke="currentColor"')
    expect(html).toContain('stroke-width="2.4"')
    expect(html).toContain('aria-hidden="true"')
  })

  it('omits the arrow on request', () => {
    expect(
      render(CTA, { href: '#x', arrow: false, children: 'Go' }),
    ).not.toContain('<svg')
  })

  it('renders the ghost variant as an accent outline', () => {
    const html = render(CTA, {
      href: '#docs',
      accent: 'cyan',
      variant: 'ghost',
      children: 'Read the docs',
    })
    expect(html).toContain('background:var(--panel)')
    expect(html).toContain('border:1px solid var(--cyan)')
    expect(html).toContain('color:var(--cyan)')
  })

  it('works for every accent', () => {
    for (const accent of ACCENT_NAMES) {
      expect(render(CTA, { href: '#x', accent, children: 'x' })).toContain(
        `background:var(--${accent})`,
      )
    }
  })
})
