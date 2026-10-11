// @vitest-environment jsdom
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
 *
 * Per docs/testing-conventions.md's "design-canvas fidelity checks" section,
 * the pinning itself (job 1) is a deliberate, justified exception to the
 * "query by role" pattern — a semantic query can't express "this path's `d`
 * is exactly this canvas transcription." What changed in the #825 RTL
 * migration is only the *mechanism*: this file now renders every icon into a
 * real (jsdom) DOM with `@testing-library/react`'s `render()` and reads
 * attributes off the resulting `<svg>`/`<path>` nodes via the DOM API
 * (`getAttribute`/`toHaveAttribute`), instead of pattern-matching
 * `react-dom/server`'s `renderToStaticMarkup` string output. Every pinned
 * value below is unchanged from before the migration — only how the test
 * reaches it is different. The one exception is the icon-accessibility
 * checks under "props", which genuinely are structural (not canvas-pinned)
 * and now go through `screen.getByRole`/`queryByRole` per the standard
 * pattern.
 */
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
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

/** Renders a React element into jsdom and returns its root `<svg>` node. */
function renderSvg(node: ReactElement): SVGSVGElement {
  const { container } = render(node)
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('component did not render an <svg>')
  return svg
}

/** Renders an icon component with the given props and returns its `<svg>`. */
function renderIcon(
  Icon: (typeof ICONS)[keyof typeof ICONS],
  props: Parameters<typeof Icon>[0] = {},
): SVGSVGElement {
  return renderSvg(createElement(Icon, props))
}

describe('the set is one family', () => {
  it('covers the six enumerated features plus editor and page chrome', () => {
    // A floor, not an exact count: #593/#597 and the per-page redesigns may
    // add icons, but must not drop the ones already extracted.
    expect(ALL_ICONS.length).toBeGreaterThanOrEqual(25)
  })

  it.each(ALL_ICONS)('%s draws in the shared 24x24 box', (_name, Icon) => {
    const svg = renderIcon(Icon)
    expect(svg).toHaveAttribute('viewBox', ICON_VIEW_BOX)
  })

  it.each(ALL_ICONS)('%s uses the set stroke width', (_name, Icon) => {
    const svg = renderIcon(Icon)
    expect(svg).toHaveAttribute('stroke-width', String(ICON_STROKE_WIDTH))
  })

  it.each(ALL_ICONS)('%s rounds its caps and joins', (_name, Icon) => {
    const svg = renderIcon(Icon)
    expect(svg).toHaveAttribute('stroke-linecap', ICON_LINE_CAP)
    expect(svg).toHaveAttribute('stroke-linejoin', ICON_LINE_CAP)
  })

  it.each(ALL_ICONS)('%s is stroked, not filled', (_name, Icon) => {
    const svg = renderIcon(Icon)
    expect(svg).toHaveAttribute('fill', 'none')
  })

  it.each(ALL_ICONS)('%s sets exactly one stroke colour', (_name, Icon) => {
    const svg = renderIcon(Icon)
    // The <svg> carries the only `stroke=` that assigns a colour; a path may
    // opt out with stroke="none" (a filled detail) but must never introduce
    // a second hue, which is what would break the set's one-colour rule.
    const strokeEls = [svg, ...svg.querySelectorAll('[stroke]')]
    const colours = strokeEls
      .map((el) => el.getAttribute('stroke'))
      .filter((value): value is string => value !== null && value !== 'none')
    expect(new Set(colours).size).toBe(1)
  })

  it.each(ALL_ICONS)(
    '%s defaults to a token or currentColor',
    (_name, Icon) => {
      const svg = renderIcon(Icon)
      const stroke = svg.getAttribute('stroke')
      expect(stroke).not.toBeNull()
      if (stroke === 'currentColor') return
      const token = stroke?.match(/^var\((--[a-z0-9-]+)\)$/)?.[1]
      expect(token).toBeDefined()
      expect(Object.keys(COLORS)).toContain(token)
    },
  )

  it.each(ALL_ICONS)(
    '%s emits no stroke width but the set one',
    (_name, Icon) => {
      const svg = renderIcon(Icon)
      const widths = [svg, ...svg.querySelectorAll('[stroke-width]')]
        .map((el) => el.getAttribute('stroke-width'))
        .filter((value): value is string => value !== null)
      expect(new Set(widths)).toEqual(new Set([String(ICON_STROKE_WIDTH)]))
    },
  )
})

describe('props', () => {
  it.each(ALL_ICONS)('%s defaults to the set size', (_name, Icon) => {
    const svg = renderIcon(Icon)
    expect(svg).toHaveAttribute('width', String(ICON_DEFAULT_SIZE))
    expect(svg).toHaveAttribute('height', String(ICON_DEFAULT_SIZE))
  })

  it.each(ALL_ICONS)('%s renders square at any size', (_name, Icon) => {
    const svg = renderIcon(Icon, { size: 34 })
    expect(svg).toHaveAttribute('width', '34')
    expect(svg).toHaveAttribute('height', '34')
  })

  it.each(ALL_ICONS)('%s takes a colour override', (_name, Icon) => {
    const svg = renderIcon(Icon, { color: 'currentColor' })
    expect(svg).toHaveAttribute('stroke', 'currentColor')
  })

  it.each(ALL_ICONS)('%s takes a stroke-width override', (_name, Icon) => {
    // The escape hatch for the canvas's optical bump at small sizes.
    const svg = renderIcon(Icon, { size: 12, strokeWidth: 2.4 })
    expect(svg).toHaveAttribute('stroke-width', '2.4')
  })

  it.each(ALL_ICONS)('%s takes a className', (_name, Icon) => {
    const svg = renderIcon(Icon, { className: 'pulse-line' })
    expect(svg).toHaveAttribute('class', 'pulse-line')
  })

  // Structural, not canvas-pinned: these hold for every icon regardless of
  // its drawing, so — unlike "canvas paths" below — they go through the
  // standard getByRole/queryByRole pattern, explicitly asserting the
  // role/aria-hidden/accessible-name contract icons.tsx documents on
  // IconProps.title.
  it.each(ALL_ICONS)('%s hides itself from AT by default', (_name, Icon) => {
    const svg = renderIcon(Icon)
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).not.toHaveAttribute('role')
    expect(svg.querySelector('title')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it.each(ALL_ICONS)('%s becomes an img when titled', (_name, Icon) => {
    const svg = renderIcon(Icon, { title: 'Zoom in' })
    const img = screen.getByRole('img', { name: 'Zoom in' })
    expect(img).toBe(svg)
    expect(svg.querySelector('title')).toHaveTextContent('Zoom in')
    expect(svg).not.toHaveAttribute('aria-hidden')
  })
})

describe('canvas paths', () => {
  it('draws dual output as two panes over a shared base, one filled', () => {
    const svg = renderIcon(DualOutputIcon)
    const rects = svg.querySelectorAll('rect')
    expect(rects).toHaveLength(2)
    expect(rects[0]).toHaveAttribute('x', '2')
    expect(rects[0]).toHaveAttribute('y', '3')
    expect(rects[0]).toHaveAttribute('width', '9')
    expect(rects[0]).toHaveAttribute('height', '10')
    expect(rects[0]).toHaveAttribute('rx', '1.5')
    expect(rects[1]).toHaveAttribute('x', '13')
    expect(rects[1]).toHaveAttribute('y', '3')
    expect(rects[1]).toHaveAttribute('width', '9')
    expect(rects[1]).toHaveAttribute('height', '10')
    expect(rects[1]).toHaveAttribute('rx', '1.5')
    expect(rects[1]).toHaveAttribute('fill', 'currentColor')
    const path = svg.querySelector('path')
    expect(path).toHaveAttribute(
      'd',
      'M6.5 13v2a2.5 2.5 0 0 0 2.5 2.5h6a2.5 2.5 0 0 0 2.5-2.5v-2',
    )
  })

  it('draws Shiki as a pair of code chevrons', () => {
    const svg = renderIcon(ShikiIcon)
    const polylines = svg.querySelectorAll('polyline')
    expect(polylines).toHaveLength(2)
    expect(polylines[0]).toHaveAttribute('points', '9 6 3 12 9 18')
    expect(polylines[1]).toHaveAttribute('points', '15 6 21 12 15 18')
  })

  it('gives the themes palette three wells', () => {
    const svg = renderIcon(ThemesIcon)
    const circles = svg.querySelectorAll('circle')
    expect(circles).toHaveLength(3)
    for (const circle of circles) {
      expect(circle).toHaveAttribute('r', '1.2')
    }
  })

  it('fills half the mono-mode circle', () => {
    const svg = renderIcon(MonoModeIcon)
    const circle = svg.querySelector('circle')
    expect(circle).toHaveAttribute('cx', '12')
    expect(circle).toHaveAttribute('cy', '12')
    expect(circle).toHaveAttribute('r', '9')
    const path = svg.querySelector('path')
    expect(path).toHaveAttribute('d', 'M12 3a9 9 0 0 1 0 18Z')
    expect(path).toHaveAttribute('fill', 'currentColor')
  })

  it('distinguishes zoom out from zoom in by the vertical stroke', () => {
    const zoomIn = renderIcon(ZoomInIcon)
    const zoomOut = renderIcon(ZoomOutIcon)
    const bar = { x1: '7', y1: '10', x2: '13', y2: '10' }
    const stem = { x1: '10', y1: '7', x2: '10', y2: '13' }

    function hasLine(svg: SVGSVGElement, attrs: Record<string, string>) {
      return [...svg.querySelectorAll('line')].some((line) =>
        Object.entries(attrs).every(
          ([name, value]) => line.getAttribute(name) === value,
        ),
      )
    }

    expect(hasLine(zoomIn, bar)).toBe(true)
    expect(hasLine(zoomIn, stem)).toBe(true)
    expect(hasLine(zoomOut, bar)).toBe(true)
    expect(hasLine(zoomOut, stem)).toBe(false)
  })

  it('points the CTA arrow right and inherits its ink', () => {
    const svg = renderIcon(ArrowRightIcon)
    const path = svg.querySelector('path')
    expect(path).toHaveAttribute('d', 'M5 12h14M13 6l6 6-6 6')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
  })
})

describe('FEATURE_ICONS', () => {
  it('lists the six pillar facts in pillar order', () => {
    expect(FEATURE_ICONS.map((f) => f.name)).toEqual([
      'dualOutput',
      'monoMode',
      'zeroDom',
      'syncRender',
      'speed',
      'accessibility',
    ])
  })

  it('gives each feature a distinct canvas accent', () => {
    const accents = FEATURE_ICONS.map((f) => f.accent)
    expect(new Set(accents).size).toBe(FEATURE_ICONS.length)
    for (const accent of accents) expect(Object.keys(COLORS)).toContain(accent)
  })

  it('renders each feature icon in its own accent by default', () => {
    for (const { name, accent } of FEATURE_ICONS) {
      const svg = renderIcon(ICONS[name])
      expect(svg).toHaveAttribute('stroke', `var(${accent})`)
    }
  })
})

describe('LogoMark', () => {
  it('is a three-colour logotype, not a set icon', () => {
    const svg = renderSvg(createElement(LogoMark))
    const [cyanRect, violetRect] = svg.querySelectorAll('rect')
    const pinkPath = svg.querySelector('path')
    expect(cyanRect).toHaveAttribute('stroke', 'var(--cyan)')
    expect(violetRect).toHaveAttribute('stroke', 'var(--violet)')
    expect(pinkPath).toHaveAttribute('stroke', 'var(--pink)')
    for (const el of [cyanRect, violetRect, pinkPath]) {
      expect(el).toHaveAttribute('stroke-width', String(LOGO_STROKE_WIDTH))
    }
  })

  it('shares the icons 24x24 box and nav size', () => {
    const svg = renderSvg(createElement(LogoMark))
    expect(svg).toHaveAttribute('viewBox', ICON_VIEW_BOX)
    expect(svg).toHaveAttribute('width', '30')
  })

  it('resizes for the footer', () => {
    const svg = renderSvg(createElement(LogoMark, { size: 22 }))
    expect(svg).toHaveAttribute('width', '22')
    expect(svg).toHaveAttribute('height', '22')
  })

  it('is titleable like the icons', () => {
    const svg = renderSvg(createElement(LogoMark, { title: 'zombie-mermaid' }))
    const img = screen.getByRole('img', { name: 'zombie-mermaid' })
    expect(img).toBe(svg)
    expect(svg.querySelector('title')).toHaveTextContent('zombie-mermaid')
  })

  it('is excluded from the icon registry', () => {
    expect(Object.values(ICONS)).not.toContain(LogoMark)
  })
})
