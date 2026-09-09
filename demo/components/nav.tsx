/** @jsxRuntime automatic */
/**
 * The redesign's shared site navigation (#593, part of the #591 component
 * library, part of the #590 redesign).
 *
 * Like tokens.tsx (#592), primitives.tsx (#595), and icons.tsx (#596),
 * everything here was lifted from the design canvas linked in #590's body
 * (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`),
 * not invented. The canvas's eight "Diagram-Native Showcase" sources — Home,
 * Diagrams, Blog, Fork fixes, Editor, Dashboard, and the Flowchart and
 * Sequence detail pages — each appear as a 1440px desktop artboard and a
 * 390px mobile one, sixteen in all; the mobile file is byte-identical to its
 * desktop twin, so the responsive behaviour lives entirely in the two
 * `@media` blocks reproduced in {@link navCss}, not in a second markup path.
 *
 * The `<div class="nav-bar">` block is byte-identical across all eight
 * sources with exactly one exception: which link carries
 * `color:var(--text)` instead of `color:var(--text-dim)`. That single
 * substitution *is* the canvas's active state, and it is the only per-page
 * variation the nav has — which is what makes one shared component the
 * correct shape. Home and Dashboard highlight nothing (Dashboard has no nav
 * link of its own); the two diagram detail pages highlight Diagrams, the
 * section they belong to.
 *
 * Two deliberate deviations from the canvas's literal markup, both
 * structural rather than visual, and both pinned by the test file:
 *
 * - The canvas wraps everything in bare `<div>`s. This renders the bar as
 *   `<header>` and the link list as `<nav aria-label>`, and marks the
 *   current page with `aria-current="page"`. Class names, inline styles,
 *   and rendered pixels are unchanged; only the tag names are.
 * - The brand is a plain `<div>` in the canvas. Pass {@link NavProps.homeHref}
 *   to render it as a link instead — the artboards are static mockups with
 *   nowhere to point, which is also why {@link NAV_ITEMS}'s hrefs are
 *   `#anchor` placeholders that a page overrides through
 *   {@link NavProps.hrefs}.
 *
 * One gap worth naming rather than papering over: the canvas has no mobile
 * menu. Below 900px the links are simply `display:none`, with no hamburger,
 * drawer, or overflow affordance anywhere in the sixteen artboards. This
 * component reproduces that faithfully; giving phone users a route to
 * Diagrams/Editor/Fork fixes/Blog is a design decision for #590, not
 * something to invent here.
 *
 * Nothing on the site consumes this yet — wiring it into the pages is
 * #598-610's job, and that work also retires site-chrome.tsx's `SiteHeader`,
 * which this replaces.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { CSSProperties } from 'react'
import { CopyIcon, LogoMark } from './icons.tsx'
import { Pill } from './primitives.tsx'
import {
  BREAKPOINTS,
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  LETTER_SPACING,
  MEDIA,
  SPACE,
  colorVar,
} from './tokens.tsx'

/* -----------------------------------------------------------------
 * The link list
 * ----------------------------------------------------------------- */

/** A single nav destination. */
export interface NavItem {
  /** Stable identity, used to select the active link. */
  key: NavKey
  /** Visible label. */
  label: string
  /** Destination. */
  href: string
}

/**
 * The five links the canvas's nav carries, in its own order.
 *
 * The hrefs are the artboards' own `#anchor` placeholders — a static mockup
 * has no routes — so a page renders real destinations by passing
 * {@link NavProps.hrefs}. The labels and the order are the design and are
 * not a page's to change; note `Fork fixes` is sentence case, and that
 * Dashboard is deliberately absent (the canvas's Dashboard artboard carries
 * the same five links and highlights none of them).
 */
export const NAV_ITEMS = [
  { key: 'diagrams', label: 'Diagrams', href: '#diagrams' },
  { key: 'editor', label: 'Editor', href: '#editor' },
  { key: 'forkFixes', label: 'Fork fixes', href: '#fixes' },
  { key: 'blog', label: 'Blog', href: '#blog' },
  { key: 'github', label: 'GitHub', href: '#github' },
] as const satisfies readonly { key: string; label: string; href: string }[]

/** One of the five links' identities, e.g. `'forkFixes'`. */
export type NavKey = (typeof NAV_ITEMS)[number]['key']

/** The brand wordmark, spelled the way the canvas spells it. */
export const NAV_WORDMARK = 'zombie-mermaid'

/** The install command in the nav's pill. */
export const NAV_INSTALL_COMMAND = 'npm install zombie-mermaid'

/* -----------------------------------------------------------------
 * Measurements
 * ----------------------------------------------------------------- */

/**
 * The gap between two nav links, in px.
 *
 * The canvas declares `gap:36px`. 36 is not on tokens.tsx's spacing scale
 * and nothing else in the artboards uses it, so it stays a literal here
 * rather than becoming a step no other component would reference — the same
 * call primitives.tsx makes for its 22px pill padding.
 */
const NAV_LINK_GAP = 36

/**
 * The bar's vertical padding at each breakpoint band, in px.
 *
 * 22 is off-scale for the same reason as {@link NAV_LINK_GAP}; the two
 * narrower values are `SPACE.xl` and `SPACE.lg`.
 */
const NAV_PAD_Y = {
  desktop: 22,
  tablet: SPACE.xl,
  mobile: SPACE.lg,
} as const

/**
 * The bar's horizontal padding at each breakpoint band, in px.
 *
 * Desktop and mobile match the page gutter; the tablet band does not — the
 * canvas tightens the bar to 24px where the page body still sits at 32.
 */
const NAV_PAD_X = {
  desktop: LAYOUT.gutter.desktop,
  tablet: SPACE['3xl'],
  mobile: LAYOUT.gutter.mobile,
} as const

/** The brand mark's rendered size in px — 30 in every artboard's nav. */
const LOGO_SIZE = 30

/** The copy glyph's rendered size in px, and the stroke width it draws at.
 *
 * The canvas bumps this instance to 2 rather than the icon set's 1.8, the
 * optical compensation icons.tsx documents on `IconProps.strokeWidth`. */
const COPY_ICON_SIZE = 15
const COPY_ICON_STROKE = 2

/** The bar's translucency over the page background. */
const NAV_BG_ALPHA = 0.85

/** `z-index` on the bar, so the hero's artwork passes beneath it. */
const NAV_Z_INDEX = 10

/**
 * Upper bound, in px, of a dead zone the canvas doesn't cover: just above
 * {@link BREAKPOINTS}.tablet, the five links (still shown) plus the
 * install pill (rigid — the canvas's own `flex-shrink:0`, not ours to
 * loosen) need more width than the row has, and the browser's only escape
 * hatch is wrapping "Fork fixes" (and, tighter still, the wordmark) onto a
 * second line with zero breathing room before the pill — the same
 * fixed-size-flex-child dead-zone shape the hero row had (#669), just
 * without a shrinkable child available to fix it the same way.
 *
 * {@link navCss} closes the gap by dropping the pill to its icon-only
 * mobile form a bit early, freeing enough width that nothing wraps.
 * Confirmed wrapping onset between 1070px (wraps) and 1080px (doesn't) on
 * the unpatched bar; this adds a margin above that measured value rather
 * than shipping the exact edge. Verified zero wrapping and zero
 * nav-links/pill overlap at 375, 600, 700, 900, 901 (the tightest point),
 * 950, 1000, 1024, 1050, 1074, and 1100, with the pill back to full text
 * at 1101 and above (through 1150, 1280, and 1440).
 */
const NAV_CRAMPED_MAX = 1100

/**
 * `--bg` as an `rgba()` at the given alpha.
 *
 * The canvas spells the bar's fill out as the literal
 * `rgba(10,13,22,0.85)`, which is `--bg` (`#0a0d16`) in decimal. Deriving it
 * from {@link COLORS} keeps one definition of the palette, exactly as
 * primitives.tsx's `accentRgba` does for the accent washes; the test file
 * checks the derivation reproduces the canvas's string.
 */
export function bgRgba(alpha: number): string {
  const hex = COLORS['--bg']
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/* -----------------------------------------------------------------
 * CSS
 * ----------------------------------------------------------------- */

/**
 * The nav's two responsive rules, transcribed from the artboards' shared
 * `<helmet><style>` preamble.
 *
 * At 900px and below the links disappear and the bar tightens; at 600px and
 * below the install pill drops its text, leaving the copy glyph alone, and
 * the bar tightens again. Both are `!important` in the canvas because they
 * override the inline styles on the elements themselves, which is also why
 * they must survive into the emitted CSS rather than being folded into the
 * component's `style` objects.
 *
 * Emit this once per page, after tokens.tsx's `designBaseCss()` and
 * primitives.tsx's `primitivesCss()` — the nav's pill is a `.pill`, and its
 * wordmark a `.display`, both of which those blocks define.
 */
export function navCss(): string {
  return `${MEDIA.tablet} {
  .nav-bar { padding: ${NAV_PAD_Y.tablet}px ${NAV_PAD_X.tablet}px !important; }
  .nav-links { display: none !important; }
}

${MEDIA.mobile} {
  .nav-bar { padding: ${NAV_PAD_Y.mobile}px ${NAV_PAD_X.mobile}px !important; }
  .nav-npm-text { display: none !important; }
}

@media (min-width: ${BREAKPOINTS.tablet + 1}px) and (max-width: ${NAV_CRAMPED_MAX}px) {
  .nav-npm-text { display: none !important; }
}`
}

/** {@link navCss} in a `<style>` element, for a page's `<head>`. */
export function NavStyle() {
  return <style>{navCss()}</style>
}

/* -----------------------------------------------------------------
 * The component
 * ----------------------------------------------------------------- */

export interface NavProps {
  /**
   * Which link is the current page. Omit for a page with no nav link of its
   * own — the canvas's Home and Dashboard artboards both highlight nothing.
   * A section's sub-page passes its section: the Flowchart and Sequence
   * detail artboards both highlight `'diagrams'`.
   */
  active?: NavKey
  /**
   * Real destinations, overriding {@link NAV_ITEMS}'s `#anchor`
   * placeholders. Partial — an unlisted key keeps the canvas's href — and
   * deliberately not a whole-list replacement, so a page cannot silently
   * drop a link or reorder the design.
   */
  hrefs?: Partial<Record<NavKey, string>>
  /**
   * Makes the brand a link to this destination. Omitted, the brand renders
   * as the canvas's plain `<div>`.
   */
  homeHref?: string
  /** Overrides the install command in the pill. */
  installCommand?: string
  /** Accessible name for the link list. Defaults to `'Main'`. */
  label?: string
  /** Appended to `nav-bar`, for a page's own modifier class. */
  className?: string
  /** Merged last, so a page can override any of the bar's own declarations. */
  style?: CSSProperties
}

/** Joins class names, dropping the empty ones. */
function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/** The logo mark plus the wordmark, optionally wrapped in a link. */
function NavBrand({ homeHref }: { homeHref?: string }) {
  const brandStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: `${SPACE.md}px`,
  }
  const inner = (
    <>
      {/* No `title`: the wordmark beside it already names the brand, so a
          titled mark would make a screen reader announce it twice. */}
      <LogoMark size={LOGO_SIZE} />
      <span
        className="display"
        style={{
          fontSize: `${FONT_SIZE.subhead}px`,
          letterSpacing: LETTER_SPACING.heading,
        }}
      >
        {NAV_WORDMARK}
      </span>
    </>
  )
  return homeHref === undefined ? (
    <div style={brandStyle}>{inner}</div>
  ) : (
    // `--text` explicitly: tokens.tsx's `designBaseCss()` paints every bare
    // `<a>` cyan, which would recolour a wordmark the canvas draws in the
    // body ink.
    <a href={homeHref} style={{ ...brandStyle, color: colorVar('--text') }}>
      {inner}
    </a>
  )
}

/**
 * The install pill: the canvas's `muted` {@link Pill} lifted onto
 * `--panel-2`, holding the command and a copy glyph.
 *
 * The text is the element the 600px rule hides, so it must stay its own
 * `.nav-npm-text` span rather than being the pill's bare text content.
 */
function NavInstall({ command }: { command: string }) {
  return (
    <Pill mono style={{ background: colorVar('--panel-2'), flexShrink: 0 }}>
      <span className="nav-npm-text">{command}</span>
      <CopyIcon size={COPY_ICON_SIZE} strokeWidth={COPY_ICON_STROKE} />
    </Pill>
  )
}

/* -----------------------------------------------------------------
 * Copy-to-clipboard behavior
 * ----------------------------------------------------------------- */

/**
 * The copy glyph's resting stroke — `var(--cyan)`, the same value
 * {@link CopyIcon}'s own `defaultColor` resolves to (icons.tsx's
 * `StrokeIcon`). {@link NAV_COPY_SCRIPT} reverts to this after the
 * "copied" flash rather than a hand-typed duplicate of the color.
 */
const NAV_COPY_ICON_COLOR = colorVar('--cyan')

/**
 * The copy glyph's flash color on a successful copy — `var(--green)`, the
 * same accent icons.tsx's `CheckIcon` already draws its "satisfied claim"
 * tick in, reused here rather than inventing a new one.
 */
const NAV_COPY_SUCCESS_COLOR = colorVar('--green')

/** How long the copy glyph stays green after a successful copy, in ms. */
const NAV_COPY_FEEDBACK_MS = 1200

/**
 * Makes the install pill copy its command to the clipboard.
 *
 * Plain runtime JS, not a bundled module: the pill (`.nav-bar .pill.mono`)
 * has no dedicated hook of its own — deliberately. This `Nav` is pinned
 * byte-for-byte to the #590 design canvas (see this file's header comment
 * and `__tests__/demo-nav.test.ts`, which asserts the rendered markup has
 * no `<button>`, specifically to catch elements the sixteen canvas
 * artboards don't have). So this script finds the pill by the classes it
 * already carries and turns it interactive at *runtime* — role, tabindex,
 * click/keydown — instead of changing the server-rendered markup. The
 * rendered HTML is byte-identical whether or not this script ever runs.
 *
 * Exported as a string, not a `demo/*-client.ts` module bundled with
 * esbuild (contrast `demo/diagram-page-client.ts`): every page that
 * renders `<Nav>` already ships its own document from a different
 * generator (index.ts, blog.ts, dashboard.ts, fork-fixes.ts, pages.ts),
 * and this behavior is small and dependency-free enough that duplicating
 * an esbuild step five times over would cost more than it buys.
 */
export const NAV_COPY_SCRIPT = `(function () {
  function copyCommand(pill) {
    var text = pill.querySelector('.nav-npm-text')
    var icon = pill.querySelector('svg')
    if (!text || !navigator.clipboard) return
    navigator.clipboard.writeText(text.textContent || '').then(function () {
      if (!icon) return
      icon.setAttribute('stroke', '${NAV_COPY_SUCCESS_COLOR}')
      setTimeout(function () {
        icon.setAttribute('stroke', '${NAV_COPY_ICON_COLOR}')
      }, ${NAV_COPY_FEEDBACK_MS})
    })
  }
  var pills = document.querySelectorAll('.nav-bar .pill.mono')
  pills.forEach(function (pill) {
    pill.setAttribute('role', 'button')
    pill.setAttribute('tabindex', '0')
    pill.setAttribute('aria-label', 'Copy install command')
    pill.style.cursor = 'pointer'
    pill.addEventListener('click', function () {
      copyCommand(pill)
    })
    pill.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        copyCommand(pill)
      }
    })
  })
})()`

/**
 * {@link NAV_COPY_SCRIPT} in a `<script>` element.
 *
 * Render this once per page (not once per `<Nav>` — a page like
 * blog-page.tsx's post template renders `Nav` twice), after the last
 * `<Nav>` in the document so every install pill already exists when it
 * runs.
 */
export function NavCopyScript() {
  return (
    <script
      // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- NAV_COPY_SCRIPT is a hardcoded literal with no user input
      dangerouslySetInnerHTML={{ __html: NAV_COPY_SCRIPT }}
    />
  )
}

/**
 * The site's shared navigation bar: brand, links, install pill.
 *
 * ```tsx
 * <Nav active="forkFixes" homeHref="/" hrefs={{ forkFixes: '/fork-fixes' }} />
 * ```
 *
 * Every redesigned page renders this one component — there is no per-page
 * nav markup, and the only thing a page varies is which link is `active`.
 */
export function Nav({
  active,
  hrefs,
  homeHref,
  installCommand = NAV_INSTALL_COMMAND,
  label = 'Main',
  className,
  style,
}: NavProps) {
  const barStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${NAV_PAD_Y.desktop}px ${NAV_PAD_X.desktop}px`,
    borderBottom: `1px solid ${colorVar('--border')}`,
    background: bgRgba(NAV_BG_ALPHA),
    position: 'relative',
    zIndex: NAV_Z_INDEX,
  }
  return (
    <header
      className={classNames('nav-bar', className)}
      style={{ ...barStyle, ...style }}
    >
      <NavBrand homeHref={homeHref} />
      <nav
        className="nav-links"
        aria-label={label}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: `${NAV_LINK_GAP}px`,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active
          return (
            <a
              key={item.key}
              href={hrefs?.[item.key] ?? item.href}
              aria-current={isActive ? 'page' : undefined}
              style={{
                fontSize: `${FONT_SIZE.bodyLg}px`,
                fontWeight: FONT_WEIGHT.semibold,
                color: colorVar(isActive ? '--text' : '--text-dim'),
              }}
            >
              {item.label}
            </a>
          )
        })}
      </nav>
      <NavInstall command={installCommand} />
    </header>
  )
}
