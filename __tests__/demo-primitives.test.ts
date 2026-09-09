// @vitest-environment jsdom
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
 *
 * Per docs/testing-conventions.md's "design-canvas fidelity checks"
 * section (zombie-mermaid#826, migrating the #798 RTL pattern into this
 * deliberate exception): the *literal-value pinning* here is intentional
 * and does not change — a semantic query can't express "this exact hex,
 * byte-for-byte" any better than a string comparison can. What changes is
 * the *query mechanism*: every component that renders a real DOM node
 * (anything but the plain `primitivesCss()` string helper) is rendered
 * with React Testing Library and inspected through a real rendered node —
 * `screen`/`within(...).getByRole(...)`/`getByText(...)` plus the node's
 * own `className`/`style`/attributes — instead of grepping
 * `renderToStaticMarkup` output with `.toContain()`. `primitivesCss()`
 * itself returns a plain CSS string with no corresponding DOM node, so its
 * own describe block keeps asserting directly on that string.
 */
import { createElement } from 'react'
import { render, within } from '@testing-library/react'
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

/** Renders a component into a real (jsdom) DOM via React Testing Library. */
function renderComponent(
  component: Parameters<typeof createElement>[0],
  props: Record<string, unknown> = {},
) {
  return render(createElement(component, props))
}

/**
 * Collapses whitespace jsdom's live CSSOM inserts after a comma when it
 * re-serialises a value it recognises as a `<color>` (e.g. re-emitting
 * `rgba(77,141,255,0.14)` as `rgba(77, 141, 255, 0.14)`) — an artifact of
 * reading a real rendered node's `style` property, not a drift in the
 * value itself. Comparisons against the canvas's un-spaced literal go
 * through this so the assertion still fails on an actual value change
 * (a different number) without failing on this formatting quirk.
 */
function normalizeCss(value: string): string {
  return value.replace(/,\s+/g, ',')
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
  // primitivesCss() returns a plain CSS string, not a rendered component —
  // there is no DOM node for an RTL query to target, so this block keeps
  // asserting directly on the string it returns (see file header).
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
    // PrimitivesStyle does render a node, so this one case in the block
    // does query the real DOM — via a direct element lookup rather than
    // getByRole/getByText, since a <style> element carries no accessible
    // role or text (Testing Library's queries deliberately ignore <style>
    // content, the same way a browser's accessibility tree does).
    const { container } = renderComponent(PrimitivesStyle)
    expect(container.childElementCount).toBe(1)
    const style = container.firstElementChild
    expect(style?.tagName).toBe('STYLE')
    expect(style?.textContent).toContain('border-radius: 20px;')
  })
})

describe('Card', () => {
  it('renders the bare canvas class with no variant styling', () => {
    const { container } = renderComponent(Card, { children: 'Body' })
    const el = within(container).getByText('Body')
    expect(el.tagName).toBe('DIV')
    expect(el.className).toBe('card')
    expect(el.getAttribute('style')).toBeNull()
  })

  it('tints only the border for an accent', () => {
    const { container } = renderComponent(Card, {
      accent: 'violet',
      children: 'x',
    })
    const el = within(container).getByText('x')
    expect(el.style.borderColor).toBe('var(--violet)')
    expect(el.style.background).toBe('')
  })

  it('reproduces the canvas glow panel for every accent', () => {
    for (const accent of ACCENT_NAMES) {
      const { container } = renderComponent(Card, {
        accent,
        tone: 'glow',
        children: 'x',
      })
      const el = within(container).getByText('x')
      expect(normalizeCss(el.style.background)).toBe(
        normalizeCss(
          `radial-gradient(circle at 50% 45%, ${CANVAS_RGBA[accent][0.16]} 0%, var(--panel) 68%)`,
        ),
      )
      expect(el.style.borderColor).toBe(`var(--${accent})`)
    }
  })

  it('falls back to the panel fill when glow has no accent', () => {
    const { container } = renderComponent(Card, {
      tone: 'glow',
      children: 'x',
    })
    const el = within(container).getByText('x')
    expect(el.style.background).toBe('')
  })

  it('recesses a sunken card onto the page background', () => {
    const { container } = renderComponent(Card, {
      tone: 'sunken',
      children: 'x',
    })
    const el = within(container).getByText('x')
    expect(el.style.background).toBe('var(--bg)')
  })

  it('renders an anchor when given an href', () => {
    const { container } = renderComponent(Card, {
      href: '#flowchart',
      accent: 'blue',
      className: 'crosslink-card',
      padding: 22,
      children: 'Flowchart',
    })
    const el = within(container).getByRole('link', { name: 'Flowchart' })
    expect(el.tagName).toBe('A')
    expect(el.className).toBe('card crosslink-card')
    expect(el.getAttribute('href')).toBe('#flowchart')
    expect(el.style.padding).toBe('22px')
  })

  it('lets a style prop win over the variant', () => {
    const { container } = renderComponent(Card, {
      accent: 'green',
      style: { borderColor: 'var(--pink)' },
      children: 'x',
    })
    const el = within(container).getByText('x')
    expect(el.style.borderColor).toBe('var(--pink)')
  })
})

describe('Pill', () => {
  it('defaults to the muted treatment with no accent', () => {
    const { container } = renderComponent(Pill, { children: 'v1.2.0' })
    const el = within(container).getByText('v1.2.0')
    expect(el.className).toBe('pill')
    expect(el.style.background).toBe('var(--panel)')
    expect(el.style.border).toBe('1px solid var(--border)')
    expect(el.style.color).toBe('var(--text-dim)')
  })

  it('defaults to solid once an accent is given', () => {
    const { container } = renderComponent(Pill, {
      accent: 'violet',
      children: 'Demo',
    })
    const el = within(container).getByText('Demo')
    expect(el.style.background).toBe('var(--violet)')
    expect(el.style.color).toBe('var(--bg)')
    expect(el.style.fontWeight).toBe('700')
  })

  it('renders each variant for each accent', () => {
    for (const accent of ACCENT_NAMES) {
      const outlineRender = renderComponent(Pill, {
        accent,
        variant: 'outline',
        children: 'x',
      })
      const outline = within(outlineRender.container).getByText('x')
      expect(outline.style.background).toBe('var(--panel)')
      expect(outline.style.border).toBe(`1px solid var(--${accent})`)
      expect(outline.style.color).toBe(`var(--${accent})`)

      const tintRender = renderComponent(Pill, {
        accent,
        variant: 'tint',
        children: 'x',
      })
      const tint = within(tintRender.container).getByText('x')
      expect(normalizeCss(tint.style.background)).toBe(
        CANVAS_RGBA[accent][0.14],
      )
      expect(tint.style.border).toBe(`1px solid var(--${accent})`)

      const solidRender = renderComponent(Pill, {
        accent,
        variant: 'solid',
        children: 'x',
      })
      const solid = within(solidRender.container).getByText('x')
      expect(solid.style.background).toBe(`var(--${accent})`)
      expect(solid.style.color).toBe('var(--bg)')
    }
  })

  it('adds the mono class and an overridden size', () => {
    const { container } = renderComponent(Pill, {
      mono: true,
      fontSize: 11,
      children: 'npm install zombie-mermaid',
    })
    const el = within(container).getByText('npm install zombie-mermaid')
    expect(el.className).toBe('pill mono')
    expect(el.style.fontSize).toBe('11px')
  })

  it('ignores an accent variant asked for without an accent', () => {
    const { container } = renderComponent(Pill, {
      variant: 'tint',
      children: 'x',
    })
    const el = within(container).getByText('x')
    expect(el.style.color).toBe('var(--text-dim)')
    expect(el.style.background).not.toContain('rgba')
  })
})

describe('SectionEyebrow', () => {
  it('renders the bare canvas class, which is already cyan', () => {
    const { container } = renderComponent(SectionEyebrow, {
      children: 'Diagrams',
    })
    const el = within(container).getByText('Diagrams')
    expect(el.tagName).toBe('DIV')
    expect(el.className).toBe('section-eyebrow')
    expect(el.getAttribute('style')).toBeNull()
  })

  it('recolours to any accent', () => {
    for (const accent of ACCENT_NAMES) {
      const { container } = renderComponent(SectionEyebrow, {
        accent,
        children: 'x',
      })
      const el = within(container).getByText('x')
      expect(el.style.color).toBe(`var(--${accent})`)
    }
  })
})

describe('CTA', () => {
  it('reproduces the home hero CTA', () => {
    const { container } = renderComponent(CTA, {
      href: '#demo',
      children: 'View the live demo',
    })
    const el = within(container).getByRole('link', {
      name: 'View the live demo',
    })
    expect(el.tagName).toBe('A')
    expect(el.className).toBe('pill')
    expect(el.getAttribute('href')).toBe('#demo')
    expect(el.style.background).toBe('var(--violet)')
    expect(el.style.color).toBe('var(--bg)')
    expect(el.style.fontWeight).toBe('700')
  })

  it('draws the canvas arrow, stroked with the button ink', () => {
    const { container } = renderComponent(CTA, { href: '#x', children: 'Go' })
    const link = within(container).getByRole('link', { name: 'Go' })
    // The arrow <svg> is aria-hidden, so it is deliberately excluded from
    // the accessibility tree — there is no role/text query for it, hence a
    // direct element lookup on the (already RTL-queried) link's own DOM
    // node rather than any string/regex matching.
    const svg = link.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('stroke')).toBe('currentColor')
    expect(svg?.getAttribute('stroke-width')).toBe('2.4')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    const path = svg?.querySelector('path')
    expect(path?.getAttribute('d')).toBe('M5 12h14M13 6l6 6-6 6')
  })

  it('omits the arrow on request', () => {
    const { container } = renderComponent(CTA, {
      href: '#x',
      arrow: false,
      children: 'Go',
    })
    const link = within(container).getByRole('link', { name: 'Go' })
    expect(link.querySelector('svg')).toBeNull()
  })

  it('renders the ghost variant as an accent outline', () => {
    const { container } = renderComponent(CTA, {
      href: '#docs',
      accent: 'cyan',
      variant: 'ghost',
      children: 'Read the docs',
    })
    const el = within(container).getByRole('link', { name: 'Read the docs' })
    expect(el.style.background).toBe('var(--panel)')
    expect(el.style.border).toBe('1px solid var(--cyan)')
    expect(el.style.color).toBe('var(--cyan)')
  })

  it('works for every accent', () => {
    for (const accent of ACCENT_NAMES) {
      const { container } = renderComponent(CTA, {
        href: '#x',
        accent,
        children: 'x',
      })
      const el = within(container).getByRole('link', { name: 'x' })
      expect(el.style.background).toBe(`var(--${accent})`)
    }
  })
})
