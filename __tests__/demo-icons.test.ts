/**
 * Guards demo/components/icons.tsx against the design canvas it was
 * extracted from (#596, part of the #591 component library and the #590
 * redesign).
 *
 * Two jobs, mirroring __tests__/demo-design-tokens.test.ts's split:
 *
 * 1. Pin a handful of paths to their canvas originals. The canvas — the
 *    `.dc.html` artboards published at the URL in #590's body — lives
 *    outside the repo, so nothing mechanical can re-derive them; the
 *    literals below are transcriptions, and a drift fails here rather than
 *    shipping a subtly redrawn icon.
 * 2. Hold the whole set to one stroke style, by iterating ICONS rather than
 *    naming icons one at a time — so an icon added later is covered without
 *    anyone remembering to add a case.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  ArrowRightIcon,
  DualOutputIcon,
  FEATURE_ICONS,
  ICONS,
  ICON_DEFAULT_SIZE,
  ICON_LINE_CAP,
  ICON_STROKE_WIDTH,
  ICON_VIEW_BOX,
  LOGO_STROKE_WIDTH,
  LogoMark,
  MonoModeIcon,
  ShikiIcon,
  ThemesIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '../demo/components/icons.tsx'
import { COLORS } from '../demo/components/tokens.tsx'

/** Every icon in the set, as `[name, Component]` pairs, for `it.each`. */
const ALL_ICONS = Object.entries(ICONS)

/** Renders an icon to static markup with the given props. */
function render(
  Icon: (typeof ICONS)[keyof typeof ICONS],
  props: Parameters<typeof Icon>[0] = {},
): string {
  return renderToStaticMarkup(createElement(Icon, props))
}

describe('the set is one family', () => {
  it('covers the six enumerated features plus editor and page chrome', () => {
    // A floor, not an exact count: #593/#597 and the per-page redesigns may
    // add icons, but must not drop the ones already extracted.
    expect(ALL_ICONS.length).toBeGreaterThanOrEqual(25)
  })

  it.each(ALL_ICONS)('%s draws in the shared 24x24 box', (_name, Icon) => {
    expect(render(Icon)).toContain(`viewBox="${ICON_VIEW_BOX}"`)
  })

  it.each(ALL_ICONS)('%s uses the set stroke width', (_name, Icon) => {
    expect(render(Icon)).toContain(`stroke-width="${ICON_STROKE_WIDTH}"`)
  })

  it.each(ALL_ICONS)('%s rounds its caps and joins', (_name, Icon) => {
    const html = render(Icon)
    expect(html).toContain(`stroke-linecap="${ICON_LINE_CAP}"`)
    expect(html).toContain(`stroke-linejoin="${ICON_LINE_CAP}"`)
  })

  it.each(ALL_ICONS)('%s is stroked, not filled', (_name, Icon) => {
    expect(render(Icon)).toContain('fill="none"')
  })

  it.each(ALL_ICONS)('%s sets exactly one stroke colour', (_name, Icon) => {
    const html = render(Icon)
    // The <svg> carries the only `stroke=` that assigns a colour; a path may
    // opt out with stroke="none" (a filled detail) but must never introduce
    // a second hue, which is what would break the set's one-colour rule.
    const colours = [...html.matchAll(/stroke="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((value) => value !== 'none')
    expect(new Set(colours).size).toBe(1)
  })

  it.each(ALL_ICONS)(
    '%s defaults to a token or currentColor',
    (_name, Icon) => {
      const stroke = render(Icon).match(/<svg[^>]*\sstroke="([^"]+)"/)?.[1]
      expect(stroke).toBeDefined()
      if (stroke === 'currentColor') return
      const token = stroke?.match(/^var\((--[a-z0-9-]+)\)$/)?.[1]
      expect(token).toBeDefined()
      expect(Object.keys(COLORS)).toContain(token)
    },
  )

  it.each(ALL_ICONS)(
    '%s emits no stroke width but the set one',
    (_name, Icon) => {
      const widths = [...render(Icon).matchAll(/stroke-width="([^"]+)"/g)].map(
        (m) => m[1],
      )
      expect(new Set(widths)).toEqual(new Set([String(ICON_STROKE_WIDTH)]))
    },
  )
})

describe('props', () => {
  it.each(ALL_ICONS)('%s defaults to the set size', (_name, Icon) => {
    const html = render(Icon)
    expect(html).toContain(`width="${ICON_DEFAULT_SIZE}"`)
    expect(html).toContain(`height="${ICON_DEFAULT_SIZE}"`)
  })

  it.each(ALL_ICONS)('%s renders square at any size', (_name, Icon) => {
    const html = render(Icon, { size: 34 })
    expect(html).toContain('width="34"')
    expect(html).toContain('height="34"')
  })

  it.each(ALL_ICONS)('%s takes a colour override', (_name, Icon) => {
    expect(render(Icon, { color: 'currentColor' })).toContain(
      'stroke="currentColor"',
    )
  })

  it.each(ALL_ICONS)('%s takes a stroke-width override', (_name, Icon) => {
    // The escape hatch for the canvas's optical bump at small sizes.
    expect(render(Icon, { size: 12, strokeWidth: 2.4 })).toContain(
      'stroke-width="2.4"',
    )
  })

  it.each(ALL_ICONS)('%s takes a className', (_name, Icon) => {
    expect(render(Icon, { className: 'pulse-line' })).toContain(
      'class="pulse-line"',
    )
  })

  it.each(ALL_ICONS)('%s hides itself from AT by default', (_name, Icon) => {
    const html = render(Icon)
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain('<title>')
    expect(html).not.toContain('role="img"')
  })

  it.each(ALL_ICONS)('%s becomes an img when titled', (_name, Icon) => {
    const html = render(Icon, { title: 'Zoom in' })
    expect(html).toContain('role="img"')
    expect(html).toContain('<title>Zoom in</title>')
    expect(html).not.toContain('aria-hidden')
  })
})

describe('canvas paths', () => {
  it('draws dual output as two panes over a shared base', () => {
    const html = render(DualOutputIcon)
    expect(html).toContain('<rect x="2" y="4" width="9" height="7" rx="1.5"')
    expect(html).toContain('<rect x="13" y="4" width="9" height="7" rx="1.5"')
    expect(html).toContain('d="M6.5 11v3a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3"')
  })

  it('draws Shiki as a pair of code chevrons', () => {
    const html = render(ShikiIcon)
    expect(html).toContain('points="9 6 3 12 9 18"')
    expect(html).toContain('points="15 6 21 12 15 18"')
  })

  it('gives the themes palette three wells', () => {
    const html = render(ThemesIcon)
    expect(html.match(/<circle/g)).toHaveLength(3)
    expect(html).toContain('r="1.2"')
  })

  it('fills half the mono-mode circle', () => {
    const html = render(MonoModeIcon)
    expect(html).toContain('<circle cx="12" cy="12" r="9"')
    expect(html).toContain('d="M12 3a9 9 0 0 1 0 18Z"')
    expect(html).toContain('fill="currentColor"')
  })

  it('distinguishes zoom out from zoom in by the vertical stroke', () => {
    const zoomIn = render(ZoomInIcon)
    const zoomOut = render(ZoomOutIcon)
    const bar = 'x1="7" y1="10" x2="13" y2="10"'
    const stem = 'x1="10" y1="7" x2="10" y2="13"'
    expect(zoomIn).toContain(bar)
    expect(zoomIn).toContain(stem)
    expect(zoomOut).toContain(bar)
    expect(zoomOut).not.toContain(stem)
  })

  it('points the CTA arrow right and inherits its ink', () => {
    const html = render(ArrowRightIcon)
    expect(html).toContain('d="M5 12h14M13 6l6 6-6 6"')
    expect(html).toContain('stroke="currentColor"')
  })
})

describe('FEATURE_ICONS', () => {
  it('lists the six features in canvas order', () => {
    expect(FEATURE_ICONS.map((f) => f.name)).toEqual([
      'dualOutput',
      'themes',
      'shiki',
      'monoMode',
      'zeroDom',
      'syncRender',
    ])
  })

  it('gives each feature a distinct canvas accent', () => {
    const accents = FEATURE_ICONS.map((f) => f.accent)
    expect(new Set(accents).size).toBe(FEATURE_ICONS.length)
    for (const accent of accents) expect(Object.keys(COLORS)).toContain(accent)
  })

  it('renders each feature icon in its own accent by default', () => {
    for (const { name, accent } of FEATURE_ICONS) {
      expect(render(ICONS[name])).toContain(`stroke="var(${accent})"`)
    }
  })
})

describe('LogoMark', () => {
  it('is a three-colour logotype, not a set icon', () => {
    const html = renderToStaticMarkup(createElement(LogoMark))
    expect(html).toContain(`stroke="var(--cyan)"`)
    expect(html).toContain(`stroke="var(--violet)"`)
    expect(html).toContain(`stroke="var(--pink)"`)
    expect(html).toContain(`stroke-width="${LOGO_STROKE_WIDTH}"`)
  })

  it('shares the icons 24x24 box and nav size', () => {
    const html = renderToStaticMarkup(createElement(LogoMark))
    expect(html).toContain(`viewBox="${ICON_VIEW_BOX}"`)
    expect(html).toContain('width="30"')
  })

  it('resizes for the footer', () => {
    const html = renderToStaticMarkup(createElement(LogoMark, { size: 22 }))
    expect(html).toContain('width="22"')
    expect(html).toContain('height="22"')
  })

  it('is titleable like the icons', () => {
    const html = renderToStaticMarkup(
      createElement(LogoMark, { title: 'zombie-mermaid' }),
    )
    expect(html).toContain('role="img"')
    expect(html).toContain('<title>zombie-mermaid</title>')
  })

  it('is excluded from the icon registry', () => {
    expect(Object.values(ICONS)).not.toContain(LogoMark)
  })
})
