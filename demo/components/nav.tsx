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
 * `<Nav>` is live on every redesigned page (index-page.tsx, diagram-page.tsx,
 * blog-page.tsx, fork-fixes-page.tsx, dashboard-page.tsx, editor-page.tsx) —
 * #598-610 wired it in and retired site-chrome.tsx's `SiteHeader`, which it
 * replaces.
 *
 * The #590 canvas itself has no mobile menu: below 900px the links are
 * simply `display:none`, with no hamburger, drawer, or overflow affordance
 * anywhere in its sixteen artboards. Giving phone users a route to
 * Diagrams/Editor/Fork fixes/Blog was left as a design decision for later —
 * this is that later. It was settled through a follow-up Claude Design
 * exploration (not the #590 canvas, which the rest of this file still pins
 * byte-for-byte): four directions — an in-flow dropdown, a side drawer, a
 * fullscreen overlay, and a bottom sheet — narrowed to the fullscreen
 * overlay, then two more rounds on that direction landed on "split layout
 * (links pinned top-left, a faint oversized brand mark grounding the
 * bottom-right corner) plus an animated node/edge graph behind it," which is
 * what {@link MobileNavPanel} renders below. Unlike the rest of this file,
 * the mobile menu's markup, CSS, and behavior script are therefore
 * *invented*, not transcribed from a canvas artboard — flagged inline where
 * it matters (the toggle icon, the diagram motif) rather than claimed as
 * canvas fidelity.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { CSSProperties, ReactNode } from 'react'
import {
  CopyIcon,
  ICON_LINE_CAP,
  ICON_STROKE_WIDTH,
  ICON_VIEW_BOX,
  LogoMark,
} from './icons.tsx'
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

/**
 * The bar's translucency over the page background.
 *
 * `demo/chrome-theme-client.ts`'s `initChromeTheme()` (#772) re-themes the
 * `.nav-bar` background at runtime too, but recomputes this same 0.85
 * alpha as its own private constant rather than importing it from here —
 * see that module's header comment for why {@link bgRgba} itself (a
 * build-time-only literal derived from tokens.tsx's fixed `COLORS`) can't
 * just be made reactive in place.
 */
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
 * The toggle button's hit target, in px — the accessibility floor
 * `artifact-design`'s "Appropriate scales" guidance sets for mobile mockup
 * controls, applied here since this is real mobile chrome, not a mockup.
 */
const MOBILE_TOGGLE_SIZE = 44

/**
 * The overlay panel's top padding, in px. There's no way to measure the
 * nav-bar's actual rendered height from pure CSS, so this is a generous
 * literal that clears it with room to spare at both breakpoint bands (the
 * bar's own content is ~44px tall, plus {@link NAV_PAD_Y}'s 14–16px of
 * padding on each side — 72–76px total).
 */
const MOBILE_PANEL_PAD_TOP = 96

/** The overlay panel's side padding, in px — {@link SPACE}'s `3xl` step,
 * one literal for both breakpoint bands rather than tracking {@link
 * NAV_PAD_X}'s own two (this menu isn't canvas-pinned, so it doesn't need
 * to match the bar's gutter exactly). */
const MOBILE_PANEL_PAD_X = SPACE['3xl']

/** The oversized watermark brand mark's rendered size, in px. */
const MOBILE_WATERMARK_SIZE = 220

/** The watermark's opacity — faint enough to read as texture, not a logo. */
const MOBILE_WATERMARK_OPACITY = 0.05

/**
 * `z-index` on the overlay panel — one below {@link NAV_Z_INDEX}, so the
 * bar (and the toggle button inside it, mid-morph into a close "X") stays
 * visible and clickable above the overlay rather than being covered by it.
 */
const MOBILE_PANEL_Z_INDEX = NAV_Z_INDEX - 1

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
 * The nav's responsive rules: the two breakpoint rules transcribed from the
 * artboards' shared `<helmet><style>` preamble, plus the mobile menu's own
 * rules appended after them (invented — see the module doc comment — so
 * kept visibly separate from the canvas-pinned block above).
 *
 * At 900px and below the links disappear and the bar tightens; at 600px and
 * below the install pill drops its text, leaving the copy glyph alone, and
 * the bar tightens again. Both are `!important` in the canvas because they
 * override the inline styles on the elements themselves, which is also why
 * they must survive into the emitted CSS rather than being folded into the
 * component's `style` objects. The mobile menu block follows the same
 * `!important` convention for the same reason (overriding {@link
 * MenuToggle}'s inline `display: none`).
 *
 * Emit this once per page, after tokens.tsx's `designBaseCss()` and
 * primitives.tsx's `primitivesCss()` — the nav's pill is a `.pill`, and its
 * wordmark a `.display`, both of which those blocks define.
 */
export function navCss(): string {
  return `${MEDIA.tablet} {
  .nav-bar { padding: ${NAV_PAD_Y.tablet}px ${NAV_PAD_X.tablet}px !important; }
  .nav-links { display: none !important; }
  .menu-toggle { display: inline-flex !important; }
}

${MEDIA.mobile} {
  .nav-bar { padding: ${NAV_PAD_Y.mobile}px ${NAV_PAD_X.mobile}px !important; }
  .nav-npm-text { display: none !important; }
}

@media (min-width: ${BREAKPOINTS.tablet + 1}px) and (max-width: ${NAV_CRAMPED_MAX}px) {
  .nav-npm-text { display: none !important; }
}

/* --- Mobile menu (invented; not part of the #590 canvas) --- */

html.mobile-nav-open {
  overflow: hidden;
}

.menu-toggle .mnt-bar {
  transition: transform .22s ease, opacity .22s ease;
  transform-box: fill-box;
  transform-origin: center;
}

.menu-toggle.is-open .mnt-bar-top {
  transform: translateY(5px) rotate(45deg);
}

.menu-toggle.is-open .mnt-bar-mid {
  opacity: 0;
}

.menu-toggle.is-open .mnt-bar-bottom {
  transform: translateY(-5px) rotate(-45deg);
}

.mobile-nav-panel {
  position: fixed;
  inset: 0;
  z-index: ${MOBILE_PANEL_Z_INDEX};
  display: flex;
  flex-direction: column;
  padding: ${MOBILE_PANEL_PAD_TOP}px ${MOBILE_PANEL_PAD_X}px ${SPACE['5xl']}px;
  background: linear-gradient(180deg, var(--bg) 0%, var(--bg-soft) 100%);
  opacity: 0;
  transform: translateX(-12px);
  pointer-events: none;
  transition: opacity .26s ease, transform .26s ease;
  overflow: hidden;
}

.mobile-nav-panel.is-open {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}

.mobile-diagram-bg {
  position: absolute;
  inset: 0;
  z-index: -1;
}

.mobile-diagram-bg .mdb-edge {
  animation: mobile-diagram-dash 3s linear infinite;
}

@keyframes mobile-diagram-dash {
  to {
    stroke-dashoffset: -40;
  }
}

.mobile-watermark {
  position: absolute;
  right: -${Math.round(MOBILE_WATERMARK_SIZE * 0.2)}px;
  bottom: -${Math.round(MOBILE_WATERMARK_SIZE * 0.15)}px;
  opacity: ${MOBILE_WATERMARK_OPACITY};
  transform: rotate(-8deg);
  pointer-events: none;
}

.mobile-links {
  display: flex;
  flex-direction: column;
}

.mobile-link {
  padding: ${SPACE.md}px 0;
  border-bottom: 1px solid var(--border);
  text-shadow: 0 2px 16px rgba(10, 13, 22, 0.8);
}

.mobile-link:last-of-type {
  border-bottom: none;
}

.mobile-install {
  margin-top: auto;
  align-self: flex-start;
}

@media (prefers-reduced-motion: reduce) {
  .menu-toggle .mnt-bar,
  .mobile-nav-panel,
  .mobile-diagram-bg .mdb-edge {
    transition-duration: 0.001ms !important;
    animation: none !important;
  }
}

@media (min-width: ${BREAKPOINTS.tablet + 1}px) {
  /* Safety net for a viewport resize while the menu is open (e.g. a phone
   * rotated past the breakpoint) — the toggle that would close it is gone
   * by then, since it's hidden by the rule above this block. */
  .mobile-nav-panel.is-open {
    opacity: 0 !important;
    pointer-events: none !important;
  }
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
  /**
   * Replaces the install pill entirely. Defaults to the canvas's own
   * `NavInstall` (rendered with {@link installCommand}) — every page but
   * the homepage keeps that default. #759's homepage passes an empty
   * `<div id="nav-theme-slot" />` placeholder instead: a real, interactive
   * theme picker is only ever *reparented* into it at runtime
   * (`demo/index-page-client.ts`), never server-rendered there, so this
   * stays a homepage-only behavior rather than a site-wide `Nav` change,
   * and the "no `<button>` in Nav's SSR output" invariant
   * (`__tests__/demo-nav.test.ts`) holds regardless of which slot content
   * a page passes.
   */
  installSlot?: ReactNode
  /**
   * `position: sticky; top: 0` instead of the canvas's own `position:
   * relative`. Defaults to `false` — every page but the homepage (#759)
   * keeps the canvas's non-sticky bar; a page with its own sticky
   * elements pinned to `top: var(--nav-height)` (the Dashboard) isn't
   * affected by this being a per-page opt-in rather than a global change.
   */
  sticky?: boolean
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
 * Mobile menu markup
 *
 * Everything below, through {@link MobileNavPanel}, is invented — see the
 * module doc comment for where the design came from. None of it claims
 * canvas fidelity the way the rest of this file does.
 * ----------------------------------------------------------------- */

/**
 * The hamburger-to-close toggle. Three bars that morph into an X via CSS
 * (`.menu-toggle.is-open` in {@link navCss}) — not traced to any canvas
 * artboard, since the #590 canvas ships no mobile menu to trace one from.
 * Drawn at the rest of the icon set's own stroke weight and cap style
 * ({@link ICON_STROKE_WIDTH}, {@link ICON_LINE_CAP}) so it still reads as
 * part of the same family.
 *
 * Hidden by default (`display: none`, desktop); {@link navCss} shows it
 * `!important` at {@link BREAKPOINTS}.tablet and below, the same threshold
 * where `.nav-links` disappears.
 */
function MenuToggle() {
  return (
    <button
      type="button"
      className="menu-toggle"
      aria-label="Menu"
      aria-expanded="false"
      style={{
        display: 'none',
        width: `${MOBILE_TOGGLE_SIZE}px`,
        height: `${MOBILE_TOGGLE_SIZE}px`,
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <svg
        width={22}
        height={22}
        viewBox={ICON_VIEW_BOX}
        fill="none"
        stroke={colorVar('--text')}
        strokeWidth={ICON_STROKE_WIDTH}
        strokeLinecap={ICON_LINE_CAP}
        aria-hidden="true"
      >
        <line className="mnt-bar mnt-bar-top" x1="3" y1="7" x2="21" y2="7" />
        <line className="mnt-bar mnt-bar-mid" x1="3" y1="12" x2="21" y2="12" />
        <line
          className="mnt-bar mnt-bar-bottom"
          x1="3"
          y1="17"
          x2="21"
          y2="17"
        />
      </svg>
    </button>
  )
}

/**
 * The overlay panel's animated background: a handful of nodes and dashed
 * edges in the six accent colours, echoing the product's own diagram art
 * (mirroring the "animated edges" feature — see {@link navCss}'s
 * `mobile-diagram-dash` keyframes) rather than a plain fill. Purely
 * decorative — `aria-hidden`, and `preserveAspectRatio="xMidYMid slice"` so
 * it crops to cover whatever the viewport's actual aspect ratio is, unlike
 * the fixed-size artboard it was first drawn against.
 */
function MobileDiagramMotif() {
  return (
    <svg
      className="mobile-diagram-bg"
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <path
        className="mdb-edge"
        d="M44 150 C 120 205, 90 310, 175 355"
        stroke={colorVar('--blue')}
        strokeWidth="1.5"
        strokeDasharray="2 8"
        fill="none"
        opacity=".38"
      />
      <path
        className="mdb-edge"
        d="M348 190 C 300 265, 336 415, 258 478"
        stroke={colorVar('--violet')}
        strokeWidth="1.5"
        strokeDasharray="2 8"
        fill="none"
        opacity=".32"
      />
      <path
        className="mdb-edge"
        d="M175 355 C 220 400, 200 445, 258 478"
        stroke={colorVar('--cyan')}
        strokeWidth="1.5"
        strokeDasharray="2 8"
        fill="none"
        opacity=".32"
      />
      <path
        className="mdb-edge"
        d="M64 630 C 140 610, 160 705, 262 696"
        stroke={colorVar('--pink')}
        strokeWidth="1.5"
        strokeDasharray="2 8"
        fill="none"
        opacity=".32"
      />
      <path
        className="mdb-edge"
        d="M258 478 C 220 560, 160 590, 64 630"
        stroke={colorVar('--amber')}
        strokeWidth="1.5"
        strokeDasharray="2 8"
        fill="none"
        opacity=".28"
      />
      <circle cx="44" cy="150" r="5" fill={colorVar('--blue')} opacity=".45" />
      <circle cx="175" cy="355" r="5" fill={colorVar('--cyan')} opacity=".45" />
      <circle
        cx="348"
        cy="190"
        r="5"
        fill={colorVar('--violet')}
        opacity=".45"
      />
      <circle
        cx="258"
        cy="478"
        r="5"
        fill={colorVar('--amber')}
        opacity=".45"
      />
      <circle cx="64" cy="630" r="5" fill={colorVar('--pink')} opacity=".45" />
      <circle
        cx="262"
        cy="696"
        r="5"
        fill={colorVar('--green')}
        opacity=".45"
      />
    </svg>
  )
}

/** One link inside {@link MobileNavPanel} — same data as a desktop link,
 * styled for the overlay instead. */
function MobileNavLink({
  href,
  isActive,
  children,
}: {
  href: string
  isActive: boolean
  children: string
}) {
  return (
    <a
      className="mobile-link"
      href={href}
      aria-current={isActive ? 'page' : undefined}
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: FONT_WEIGHT.bold,
        fontSize: `${FONT_SIZE.h3}px`,
        letterSpacing: LETTER_SPACING.heading,
        color: colorVar(isActive ? '--text' : '--text-dim'),
      }}
    >
      {children}
    </a>
  )
}

/**
 * The fullscreen mobile menu: {@link MobileDiagramMotif} behind a split
 * layout — links pinned top-left, an oversized faint {@link LogoMark}
 * grounding the bottom-right corner, the install command spelled out in
 * full at the bottom (the one place it's readable on a phone — the bar's
 * own pill drops to icon-only at {@link BREAKPOINTS}.mobile).
 *
 * Closed by default (`.mobile-nav-panel` with no `is-open`); {@link
 * NAV_MOBILE_MENU_SCRIPT} toggles the class and this element's sibling
 * {@link MenuToggle} at runtime, the same "static markup, runtime script"
 * split {@link NAV_COPY_SCRIPT} uses. `position: fixed` on `.mobile-nav-panel`
 * means it covers the viewport regardless of where `Nav` sits in the page,
 * so it renders as `Nav`'s sibling rather than nested inside the bar.
 */
function MobileNavPanel({
  linkItems,
  installCommand,
  label,
}: {
  linkItems: { key: NavKey; label: string; href: string; isActive: boolean }[]
  installCommand: string
  label: string
}) {
  return (
    <nav className="mobile-nav-panel" aria-label={`${label} (mobile)`}>
      <MobileDiagramMotif />
      <div className="mobile-watermark">
        <LogoMark size={MOBILE_WATERMARK_SIZE} />
      </div>
      <div className="mobile-links">
        {linkItems.map((item) => (
          <MobileNavLink
            key={item.key}
            href={item.href}
            isActive={item.isActive}
          >
            {item.label}
          </MobileNavLink>
        ))}
      </div>
      <span className="mobile-install">
        <Pill mono style={{ background: 'rgba(20,26,46,0.85)' }}>
          {installCommand}
          <CopyIcon size={COPY_ICON_SIZE} strokeWidth={COPY_ICON_STROKE} />
        </Pill>
      </span>
    </nav>
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
 * has no dedicated hook of its own — deliberately. The parts of `Nav` this
 * script targets are pinned byte-for-byte to the #590 design canvas (see
 * this file's header comment), so this script finds the pill by the classes
 * it already carries and turns it interactive at *runtime* — role,
 * tabindex, click/keydown — instead of changing the server-rendered markup.
 * The rendered HTML is byte-identical whether or not this script ever runs.
 * ({@link MenuToggle}'s `<button>`, added for the mobile menu, is the one
 * deliberate exception to "no `<button>`" — see the module doc comment.)
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

/* -----------------------------------------------------------------
 * Mobile menu behavior
 * ----------------------------------------------------------------- */

/**
 * Opens, closes, and focus-manages {@link MobileNavPanel} — the same
 * "static markup, runtime script" split {@link NAV_COPY_SCRIPT} uses, for
 * the same reason: the toggle and panel are plain `Nav` output with no
 * client-side React to attach handlers to.
 *
 * Pairs each `.menu-toggle` with the `.mobile-nav-panel` that follows it —
 * {@link MobileNavPanel}'s own doc comment explains why that panel renders
 * as `Nav`'s sibling rather than nested inside the bar, which is what makes
 * `nextElementSibling` the right (and simplest) way to find it, with no
 * `id`/`aria-controls` pair needed and nothing to collide if a future page
 * ever renders more than one `Nav`.
 *
 * Behavior: click toggles; tapping a link or pressing Escape closes and
 * (for Escape) returns focus to the toggle; opening moves focus to the
 * first link and locks background scroll via the `mobile-nav-open` class
 * {@link navCss} keys off. What this does *not* do — deliberately, to keep
 * a first version scoped — is trap Tab/Shift+Tab inside the open panel;
 * revisit if that turns out to matter in practice.
 */
export const NAV_MOBILE_MENU_SCRIPT = `(function () {
  function closeMenu(toggle, panel, returnFocus) {
    panel.classList.remove('is-open')
    toggle.classList.remove('is-open')
    toggle.setAttribute('aria-expanded', 'false')
    document.documentElement.classList.remove('mobile-nav-open')
    if (returnFocus) toggle.focus()
  }

  function openMenu(toggle, panel) {
    panel.classList.add('is-open')
    toggle.classList.add('is-open')
    toggle.setAttribute('aria-expanded', 'true')
    document.documentElement.classList.add('mobile-nav-open')
    var firstLink = panel.querySelector('.mobile-link')
    if (firstLink) firstLink.focus()
  }

  document.querySelectorAll('.nav-bar').forEach(function (bar) {
    var toggle = bar.querySelector('.menu-toggle')
    var panel = bar.nextElementSibling
    if (!toggle || !panel || !panel.classList.contains('mobile-nav-panel')) {
      return
    }

    toggle.addEventListener('click', function () {
      if (panel.classList.contains('is-open')) {
        closeMenu(toggle, panel, true)
      } else {
        openMenu(toggle, panel)
      }
    })

    panel.querySelectorAll('.mobile-link').forEach(function (link) {
      link.addEventListener('click', function () {
        closeMenu(toggle, panel, false)
      })
    })

    panel.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu(toggle, panel, true)
      }
    })
  })
})()`

/**
 * {@link NAV_MOBILE_MENU_SCRIPT} in a `<script>` element.
 *
 * Render this once per page (same rule as {@link NavCopyScript} — see its
 * doc comment), after the last `<Nav>` in the document.
 */
export function NavMobileMenuScript() {
  return (
    <script
      // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- NAV_MOBILE_MENU_SCRIPT is a hardcoded literal with no user input
      dangerouslySetInnerHTML={{ __html: NAV_MOBILE_MENU_SCRIPT }}
    />
  )
}

/**
 * The site's shared navigation bar: brand, links, install pill, and (below
 * {@link BREAKPOINTS}.tablet) a fullscreen mobile menu — see {@link
 * MobileNavPanel}'s doc comment for where that design came from.
 *
 * ```tsx
 * <Nav active="forkFixes" homeHref="/" hrefs={{ forkFixes: '/fork-fixes' }} />
 * ```
 *
 * Every redesigned page renders this one component — there is no per-page
 * nav markup, and the only thing a page varies is which link is `active`.
 * Returns a fragment (the bar, then the mobile panel as its sibling) rather
 * than a single element — `position: fixed` on the panel means it doesn't
 * need to nest inside the bar to cover the viewport, and staying out of the
 * bar's own `z-index: 10` stacking context is what keeps the panel from
 * ever being trapped behind unrelated page content with a higher one (the
 * editor page's own tool chrome, say).
 */
export function Nav({
  active,
  hrefs,
  homeHref,
  installCommand = NAV_INSTALL_COMMAND,
  installSlot,
  sticky = false,
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
    position: sticky ? 'sticky' : 'relative',
    top: sticky ? 0 : undefined,
    zIndex: NAV_Z_INDEX,
  }
  const linkItems = NAV_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    href: hrefs?.[item.key] ?? item.href,
    isActive: item.key === active,
  }))
  return (
    <>
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
          {linkItems.map((item) => (
            <a
              key={item.key}
              href={item.href}
              aria-current={item.isActive ? 'page' : undefined}
              style={{
                fontSize: `${FONT_SIZE.bodyLg}px`,
                fontWeight: FONT_WEIGHT.semibold,
                color: colorVar(item.isActive ? '--text' : '--text-dim'),
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${SPACE.md}px`,
          }}
        >
          {installSlot ?? <NavInstall command={installCommand} />}
          <MenuToggle />
        </div>
      </header>
      <MobileNavPanel
        linkItems={linkItems}
        installCommand={installCommand}
        label={label}
      />
    </>
  )
}
