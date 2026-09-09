/**
 * Guards demo/components/nav.tsx against the design canvas it was extracted
 * from (#593, part of the #591 component library and the #590 redesign).
 *
 * Same contract as demo-design-tokens.test.ts, demo-primitives.test.ts, and
 * demo-icons.test.ts: the canvas — the `.dc.html` artboards published at the
 * URL in #590's body — is the source of truth and lives outside the repo, so
 * nothing mechanical can re-derive it. The CANVAS_* literals below are
 * transcriptions of what the artboards actually declare, so a later edit
 * that drifts a value, drops a link, or breaks a breakpoint fails here
 * rather than silently shipping off-design chrome.
 *
 * The nav is a stronger case for pinning than the primitives were: its
 * `<div class="nav-bar">` block is byte-identical across all eight canonical
 * sources apart from which link carries `color:var(--text)`, so every
 * literal here is backed by eight independent copies rather than one.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  NAV_INSTALL_COMMAND,
  NAV_ITEMS,
  NAV_MOBILE_MENU_SCRIPT,
  NAV_WORDMARK,
  Nav,
  NavStyle,
  bgRgba,
  navCss,
  type NavKey,
  type NavProps,
} from '../demo/components/nav.tsx'
import { COLORS } from '../demo/components/tokens.tsx'

/** Renders the nav to static markup, the way the site's generators do. */
function render(props: NavProps = {}): string {
  return renderToStaticMarkup(createElement(Nav, props))
}

/**
 * Isolates the `<nav class="nav-links">…</nav>` block from a render — the
 * desktop link list the canvas pins byte-for-byte. Needed because the
 * mobile menu (below) renders its own copy of the same five labels, which
 * would otherwise double-count in any test that greps the whole document
 * for `<a>` tags or link text.
 */
function desktopLinksHtml(html: string): string {
  const start = html.indexOf('<nav class="nav-links"')
  const end = html.indexOf('</nav>', start) + '</nav>'.length
  return html.slice(start, end)
}

/** Isolates the `<nav class="mobile-nav-panel">…</nav>` block — the
 * invented mobile menu, not part of the canvas. See {@link desktopLinksHtml}. */
function mobileLinksHtml(html: string): string {
  const start = html.indexOf('<nav class="mobile-nav-panel"')
  const end = html.indexOf('</nav>', start) + '</nav>'.length
  return html.slice(start, end)
}

/** Isolates the `<header class="nav-bar">…</header>` desktop bar from a
 * render, excluding the sibling `<nav class="mobile-nav-panel">` the mobile
 * menu (#784) appends after it. Needed for install-pill assertions: the
 * mobile panel carries its own, always-present install pill (see 'the
 * mobile menu' below) independent of the desktop bar's `installSlot`, so an
 * assertion scoped to the whole document would see the mobile panel's copy
 * even when the desktop slot correctly replaced its own. */
function desktopHeaderHtml(html: string): string {
  const end = html.indexOf('</header>') + '</header>'.length
  return html.slice(0, end)
}

/**
 * The nav's five links, in the canvas's own order, with the `#anchor`
 * placeholders the static artboards point at.
 */
const CANVAS_LINKS = [
  { label: 'Diagrams', href: '#diagrams' },
  { label: 'Editor', href: '#editor' },
  { label: 'Fork fixes', href: '#fixes' },
  { label: 'Blog', href: '#blog' },
  { label: 'GitHub', href: '#github' },
]

/**
 * The `.nav-bar` element's inline declarations, verbatim from every
 * canonical artboard.
 */
const CANVAS_BAR_STYLE = [
  'display:flex',
  'align-items:center',
  'justify-content:space-between',
  'padding:22px 80px',
  'border-bottom:1px solid var(--border)',
  'background:rgba(10,13,22,0.85)',
  'position:relative',
  'z-index:10',
]

/** The `.nav-links` container's inline declarations, verbatim. */
const CANVAS_LINKS_STYLE = ['display:flex', 'align-items:center', 'gap:36px']

/** The brand row's inline declarations, verbatim. */
const CANVAS_BRAND_STYLE = ['display:flex', 'align-items:center', 'gap:12px']

/** A nav link's inline declarations at rest, verbatim. */
const CANVAS_LINK_STYLE = [
  'font-size:15px',
  'font-weight:600',
  'color:var(--text-dim)',
]

/** The install pill's inline declarations, verbatim. */
const CANVAS_PILL_STYLE = [
  'background:var(--panel-2)',
  'border:1px solid var(--border)',
  'color:var(--text-dim)',
  'flex-shrink:0',
]

/**
 * The two responsive rules from the artboards' shared style preamble,
 * whitespace-normalised so the comparison is against the declarations.
 */
const CANVAS_MEDIA = {
  tablet: {
    prelude: '@media (max-width: 900px)',
    rules: [
      '.nav-bar { padding: 16px 24px !important; }',
      '.nav-links { display: none !important; }',
    ],
  },
  mobile: {
    prelude: '@media (max-width: 600px)',
    rules: [
      '.nav-bar { padding: 14px 20px !important; }',
      '.nav-npm-text { display: none !important; }',
    ],
  },
}

/**
 * Which link each canonical artboard highlights with `color:var(--text)`,
 * read off all eight sources. Home and Dashboard highlight nothing; the two
 * diagram detail pages highlight the section they sit under.
 */
const CANVAS_ACTIVE: { artboard: string; active: NavKey | undefined }[] = [
  { artboard: 'Main', active: undefined },
  { artboard: 'DiagramGallery', active: 'diagrams' },
  { artboard: 'Blog', active: 'blog' },
  { artboard: 'ForkFixes', active: 'forkFixes' },
  { artboard: 'Editor', active: 'editor' },
  { artboard: 'Dashboard', active: undefined },
  { artboard: 'FlowchartDetail', active: 'diagrams' },
  { artboard: 'SequenceDetail', active: 'diagrams' },
]

describe('the link list', () => {
  it('carries the canvas’s five links, in its order', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(
      CANVAS_LINKS.map((link) => link.label),
    )
  })

  it('keeps the canvas’s placeholder hrefs as the defaults', () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual(
      CANVAS_LINKS.map((link) => link.href),
    )
  })

  it('has no Dashboard link — the canvas’s nav does not list one', () => {
    expect(NAV_ITEMS.map((item) => item.key)).not.toContain('dashboard')
  })

  it('renders every link, in order', () => {
    const html = desktopLinksHtml(render())
    const labels = [...html.matchAll(/>([^<>]+)<\/a>/g)].map((m) => m[1])
    expect(labels).toEqual(CANVAS_LINKS.map((link) => link.label))
  })

  it.each(CANVAS_LINKS)('links $label to $href by default', ({ href }) => {
    expect(render()).toContain(`href="${href}"`)
  })

  it('lets a page swap in real destinations, one key at a time', () => {
    const html = render({ hrefs: { forkFixes: '/fork-fixes' } })
    expect(html).toContain('href="/fork-fixes"')
    // The keys a page did not override keep the canvas default.
    expect(html).toContain('href="#blog"')
  })
})

describe('the active state', () => {
  it.each(CANVAS_ACTIVE)(
    'the $artboard artboard highlights $active',
    ({ active }) => {
      const html = desktopLinksHtml(render({ active }))
      const highlighted = [
        ...html.matchAll(/color:var\(--text\)[^>]*>([^<>]+)<\/a>/g),
      ].map((m) => m[1])
      const expected =
        active === undefined
          ? []
          : [NAV_ITEMS.find((item) => item.key === active)!.label]
      expect(highlighted).toEqual(expected)
    },
  )

  it('dims every other link', () => {
    // Scoped to .nav-links, so the install pill's own --text-dim ink (a
    // sibling, outside this block) isn't counted alongside the four
    // inactive links.
    const html = desktopLinksHtml(render({ active: 'editor' }))
    expect(html.match(/color:var\(--text-dim\)/g)).toHaveLength(
      CANVAS_LINKS.length - 1,
    )
  })

  it('marks the active link for assistive tech, not just visually', () => {
    expect(render({ active: 'blog' })).toContain('aria-current="page"')
  })

  it('marks nothing current when no link is active', () => {
    expect(render()).not.toContain('aria-current')
  })
})

describe('the bar', () => {
  it.each(CANVAS_BAR_STYLE)('declares %s', (declaration) => {
    expect(render()).toContain(declaration)
  })

  it.each(CANVAS_BRAND_STYLE)('lays the brand out with %s', (declaration) => {
    expect(render()).toContain(declaration)
  })

  it.each(CANVAS_LINKS_STYLE)('lays the links out with %s', (declaration) => {
    expect(render()).toContain(declaration)
  })

  it.each(CANVAS_LINK_STYLE)('styles a resting link with %s', (declaration) => {
    expect(render()).toContain(declaration)
  })

  it('derives the translucent fill from the palette', () => {
    expect(bgRgba(0.85)).toBe('rgba(10,13,22,0.85)')
    // Not a hand-copied literal: it is --bg in decimal.
    expect(COLORS['--bg']).toBe('#0a0d16')
  })

  it('carries the class names the responsive rules target', () => {
    const html = render()
    expect(html).toContain('class="nav-bar"')
    expect(html).toContain('class="nav-links"')
    expect(html).toContain('class="nav-npm-text"')
  })

  it('appends a page’s own modifier class rather than replacing', () => {
    expect(render({ className: 'nav-bar-sticky' })).toContain(
      'class="nav-bar nav-bar-sticky"',
    )
  })

  it('lets a page override a bar declaration through style', () => {
    expect(render({ style: { position: 'sticky', top: 0 } })).toContain(
      'position:sticky',
    )
  })

  it('stays position:relative by default, matching every canvas artboard', () => {
    expect(render()).toContain('position:relative')
    expect(render()).not.toContain('position:sticky')
  })

  it('opts into position:sticky at top:0 via the sticky prop (#759)', () => {
    const html = render({ sticky: true })
    expect(html).toContain('position:sticky')
    expect(html).toContain('top:0')
  })
})

describe('the brand', () => {
  it('renders the wordmark through the display face', () => {
    const html = render()
    expect(html).toContain('class="display"')
    expect(html).toContain(NAV_WORDMARK)
    expect(html).toContain('font-size:20px')
    expect(html).toContain('letter-spacing:-0.01em')
  })

  it('draws the three-accent logo mark at the canvas’s 30px', () => {
    const html = render()
    expect(html).toContain('width="30"')
    // The mark's three strokes, in the canvas's own accents.
    for (const accent of ['--cyan', '--violet', '--pink']) {
      expect(html).toContain(`stroke="var(${accent})"`)
    }
  })

  it('hides the mark from assistive tech — the wordmark names the brand', () => {
    const html = render()
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain('<title>')
  })

  it('is a plain div by default, matching the static artboards', () => {
    // The only <a>s are the five desktop nav links plus their five mobile
    // menu counterparts (see "the mobile menu" below) — none from the brand.
    expect(render().match(/<a /g)).toHaveLength(CANVAS_LINKS.length * 2)
  })

  it('becomes a link when a page supplies a home destination', () => {
    const html = render({ homeHref: '/' })
    expect(html).toContain('href="/"')
    expect(html.match(/<a /g)).toHaveLength(CANVAS_LINKS.length * 2 + 1)
  })
})

describe('the install pill', () => {
  it('shows the canvas’s command', () => {
    expect(NAV_INSTALL_COMMAND).toBe('npm install zombie-mermaid')
    expect(render()).toContain(NAV_INSTALL_COMMAND)
  })

  it.each(CANVAS_PILL_STYLE)('declares %s', (declaration) => {
    expect(render()).toContain(declaration)
  })

  it('is a pill in the mono face', () => {
    expect(render()).toContain('class="pill mono"')
  })

  it('keeps the command in its own span, which the 600px rule hides', () => {
    // Bare text content would leave the mobile rule nothing to target.
    expect(render()).toContain(
      `<span class="nav-npm-text">${NAV_INSTALL_COMMAND}</span>`,
    )
  })

  it('draws the copy glyph at the canvas’s optical stroke bump', () => {
    const html = render()
    expect(html).toContain('width="15"')
    expect(html).toContain('stroke-width="2"')
  })

  it('lets a page override the command', () => {
    expect(render({ installCommand: 'pnpm add zombie-mermaid' })).toContain(
      'pnpm add zombie-mermaid',
    )
  })

  it('is replaced entirely by installSlot when a page passes one (#759)', () => {
    const html = render({
      installSlot: createElement('div', { id: 'nav-theme-slot' }),
    })
    const header = desktopHeaderHtml(html)
    expect(header).toContain('<div id="nav-theme-slot">')
    // The default NavInstall pill is gone from the desktop bar, not just
    // supplemented -- scoped to the header since the mobile panel (#784,
    // merged after #759) always carries its own install pill regardless of
    // the desktop slot; see 'the mobile menu' below for that assertion.
    expect(header).not.toContain(NAV_INSTALL_COMMAND)
    expect(header).not.toContain('class="pill mono"')
  })

  it('desktop bar has no extra <button> beyond the menu toggle with installSlot set (#759)', () => {
    // The homepage's real installSlot is an empty placeholder div -- a real
    // <button>-based ThemePicker only ever arrives via runtime reparenting
    // (demo/index-page-client.ts), never server-rendered here. The desktop
    // bar's one legitimate <button> is MenuToggle (#784's invented mobile
    // menu control, documented as a deliberate deviation from the canvas in
    // this file's own header comment) -- confirms installSlot doesn't add a
    // second one, not that the bar has none at all.
    const html = render({
      installSlot: createElement('div', { id: 'nav-theme-slot' }),
    })
    const header = desktopHeaderHtml(html)
    expect(header.match(/<button/gi)).toHaveLength(1)
    expect(header).toContain('class="menu-toggle"')
  })
})

describe('semantics', () => {
  it('renders the bar as a header and the links as a nav', () => {
    const html = render()
    expect(html).toMatch(/^<header /)
    expect(html).toContain('<nav ')
  })

  it('names the link list for assistive tech', () => {
    expect(render()).toContain('aria-label="Main"')
    expect(render({ label: 'Site' })).toContain('aria-label="Site"')
  })
})

describe('responsive rules', () => {
  const css = navCss()

  it.each([CANVAS_MEDIA.tablet, CANVAS_MEDIA.mobile])(
    'opens $prelude',
    ({ prelude }) => {
      expect(css).toContain(prelude)
    },
  )

  it.each([...CANVAS_MEDIA.tablet.rules, ...CANVAS_MEDIA.mobile.rules])(
    'declares %s',
    (rule) => {
      expect(css.replace(/\s+/g, ' ')).toContain(rule)
    },
  )

  it('hides the links at the tablet breakpoint, not the mobile one', () => {
    const tablet = css.slice(
      css.indexOf(CANVAS_MEDIA.tablet.prelude),
      css.indexOf(CANVAS_MEDIA.mobile.prelude),
    )
    expect(tablet).toContain('.nav-links')
    expect(tablet).not.toContain('.nav-npm-text')
  })

  it('collapses the pill to icon-only at the mobile breakpoint', () => {
    const mobile = css.slice(css.indexOf(CANVAS_MEDIA.mobile.prelude))
    expect(mobile).toContain('.nav-npm-text')
    expect(mobile).not.toContain('.nav-links')
  })

  it('wraps the rules in a style element', () => {
    const html = renderToStaticMarkup(createElement(NavStyle))
    expect(html).toBe(`<style>${navCss()}</style>`)
  })
})

/**
 * Replaces the old "has no mobile menu — the canvas ships none" pin: the
 * canvas still has no mobile menu (see the module doc comment), but the
 * site now does. Nothing below is canvas fidelity — it's this component's
 * own contract for the menu it invented, so these check *our* markup and
 * CSS choices rather than transcribing an artboard.
 */
describe('the mobile menu', () => {
  it('renders a closed toggle button, hidden by default', () => {
    const html = render()
    expect(html).toContain('class="menu-toggle"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="Menu"')
    // Shown only via navCss()'s tablet-and-below rule — see "responsive
    // rules" above for `.menu-toggle { display: inline-flex !important; }`.
    expect(html).toMatch(/class="menu-toggle"[^>]*style="display:none/)
  })

  it('renders the same five links as the desktop nav, in the same order', () => {
    const html = mobileLinksHtml(render())
    const labels = [
      ...html.matchAll(/class="mobile-link"[^>]*>([^<>]+)</g),
    ].map((m) => m[1])
    expect(labels).toEqual(CANVAS_LINKS.map((link) => link.label))
  })

  it('lets a page override mobile hrefs the same way as desktop ones', () => {
    const html = mobileLinksHtml(
      render({ hrefs: { forkFixes: '/fork-fixes' } }),
    )
    expect(html).toContain('href="/fork-fixes"')
  })

  it('highlights the active link the same way the desktop nav does', () => {
    const html = mobileLinksHtml(render({ active: 'blog' }))
    expect(html).toContain('aria-current="page"')
    const highlighted = [
      ...html.matchAll(/color:var\(--text\)[^>]*>([^<>]+)<\/a>/g),
    ].map((m) => m[1])
    expect(highlighted).toEqual(['Blog'])
  })

  it('shows the install command in full, not the icon-only pill', () => {
    const html = mobileLinksHtml(render())
    expect(html).toContain(NAV_INSTALL_COMMAND)
    // Unlike .nav-npm-text, this copy isn't wrapped in the span the 600px
    // rule hides — it's meant to stay legible at every mobile width.
    expect(html).not.toContain('class="nav-npm-text"')
  })

  it('is a closed, fixed-position overlay by default', () => {
    const html = render()
    expect(html).toContain('class="mobile-nav-panel"')
    expect(html).not.toMatch(/class="mobile-nav-panel is-open"/)
  })

  it('renders as a sibling of the bar, not nested inside it', () => {
    // NAV_MOBILE_MENU_SCRIPT pairs a toggle with its panel via
    // `bar.nextElementSibling` — this is the markup contract that relies on.
    const html = render()
    const barEnd = html.indexOf('</header>')
    const panelStart = html.indexOf('<nav class="mobile-nav-panel"')
    expect(panelStart).toBeGreaterThan(barEnd)
    // Nothing but the panel itself sits between them.
    expect(html.slice(barEnd + '</header>'.length, panelStart)).toBe('')
  })

  it('behavior script pairs a toggle with the panel that follows it', () => {
    expect(NAV_MOBILE_MENU_SCRIPT).toContain('bar.nextElementSibling')
    expect(NAV_MOBILE_MENU_SCRIPT).toContain("event.key === 'Escape'")
  })
})
