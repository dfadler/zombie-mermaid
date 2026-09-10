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
 * The install pill's package-manager selector (zombie-mermaid#719) is a
 * second deviation on the same footing: no artboard in the #590 canvas
 * shows anything but the bare `npm install …` pill, so this wasn't traced
 * from it either. It was approved by the repo owner via a separate,
 * follow-up Claude Design exploration
 * (`https://claude.ai/code/artifact/d6852fbd-08d3-4014-9d29-767defedfbc2`,
 * not an edit to the #590 canvas itself, which stays a read-only artifact
 * this repo can't write to) rather than a round-trip through #590. See
 * {@link NavInstall}'s doc comment for the resulting markup.
 *
 * The wide-viewport padding rule in {@link navCss} (guarded by
 * {@link NAV_WIDE_MIN}) is a third deviation, and purely additive: the
 * canvas's single 1440px artboard says nothing about wider viewports, so
 * there's no canvas answer this could contradict. See NAV_WIDE_MIN's own
 * doc comment for the alignment gap it closes.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  CheckIcon,
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
  LINE_HEIGHT,
  MEDIA,
  RADIUS,
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

/**
 * The brand wordmark, as it renders in a logo lockup (icon + wordmark
 * together) — see `docs/brand.md` for the merged-vs-spaced rule and why
 * this differs from most other rendered mentions of the product name.
 */
export const NAV_WORDMARK = 'ZombieMermaid'

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
 * Width, in px, above which the canvas's fixed 80px `.nav-bar` padding stops
 * matching the page body's own content column.
 *
 * The canvas is a single 1440px-wide artboard, so it never had to answer
 * what the bar does above that width — the same kind of gap the mobile menu
 * fills (see the module doc comment). Every redesigned page body
 * independently centers its content at {@link LAYOUT.maxWidth} (1280px)
 * plus this bar's own {@link NAV_PAD_X}.desktop (80px) gutter on each side —
 * 1440px total — so the two column calculations agree exactly up to 1440px
 * and diverge above it: the body's content re-centers itself as the
 * viewport grows past 1440, but the bar's padding stays a fixed 80px,
 * leaving the logo pinned 80px from the left edge while the body content
 * it's meant to align with drifts inward. {@link navCss} closes the gap
 * above this width by growing the bar's padding to match, rather than
 * leaving it fixed.
 */
const NAV_WIDE_MIN = LAYOUT.maxWidth + NAV_PAD_X.desktop * 2

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
 * Install pill: package-manager selector (zombie-mermaid#719)
 *
 * Invented — approved by the repo owner via a Claude Design exploration
 * (see the module doc comment), not part of the #590 canvas. Grouped here
 * with the rest of this file's measurements/data rather than inline in
 * {@link NavInstall} for the same reason the mobile-menu literals above
 * are: one place to find every magic number this file declares.
 * ----------------------------------------------------------------- */

/**
 * The four package managers the install pill's popover offers, in the
 * order the popover lists them. `'npm'` is first and the default —
 * matching {@link NAV_INSTALL_COMMAND} and this file's pre-#719 behavior.
 */
export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const

/** One of {@link PACKAGE_MANAGERS}, e.g. `'pnpm'`. */
export type PackageManager = (typeof PACKAGE_MANAGERS)[number]

/**
 * The literal prefix {@link NAV_INSTALL_COMMAND} (and, by convention, any
 * page's `installCommand` override) starts with — `'npm install '`. Used
 * only to recover the bare package name so the other three managers' own
 * verbs can be substituted in; see {@link packageNameFromCommand}.
 */
const NPM_INSTALL_PREFIX = 'npm install '

/**
 * Recovers the package name from an npm-style install command, e.g.
 * `'npm install zombie-mermaid'` → `'zombie-mermaid'`.
 *
 * A page's {@link NavProps.installCommand} is the only source for this —
 * there is no separate "package name" prop — so this assumes the npm
 * phrasing {@link NAV_INSTALL_COMMAND} uses. A command that doesn't start
 * with {@link NPM_INSTALL_PREFIX} (a page overriding it with something
 * else entirely) is returned as-is: the pnpm/yarn/bun options then repeat
 * that same string verbatim rather than guessing at its structure, which
 * is the smallest safe fallback for a prop that's free-form text.
 */
export function packageNameFromCommand(installCommand: string): string {
  return installCommand.startsWith(NPM_INSTALL_PREFIX)
    ? installCommand.slice(NPM_INSTALL_PREFIX.length)
    : installCommand
}

/**
 * The install command for a given package manager and package name —
 * `npm install <pkg>` for npm, `<manager> add <pkg>` for the other three
 * (pnpm, yarn, and bun all share the `add` verb).
 */
export function installCommandFor(
  manager: PackageManager,
  packageName: string,
): string {
  return manager === 'npm'
    ? `npm install ${packageName}`
    : `${manager} add ${packageName}`
}

/** The prefix trigger's padding, in px — 6 vertical ({@link SPACE.xxs}), 10
 * horizontal ({@link SPACE.sm}), per the approved design spec. */
const INSTALL_PREFIX_PAD_Y = SPACE.xxs
const INSTALL_PREFIX_PAD_X = SPACE.sm

/**
 * The longest of {@link PACKAGE_MANAGERS}' own names, in characters
 * (`'pnpm'`/`'yarn'`, both 4) — reserved as the prefix label's `min-width`
 * (in `ch`, exact in the pill's monospace face) so switching between a
 * 3-letter manager (`npm`/`bun`) and a 4-letter one doesn't change the
 * trigger's rendered width and, with it, shove the divider/command/copy
 * glyph sideways (zombie-mermaid#902 — caught in the homepage hero, where
 * that shift visibly nudges the CTA button beside it; the header pill has
 * the identical dependency, just harder to notice next to a plain
 * hamburger icon).
 */
const INSTALL_PREFIX_LABEL_MIN_WIDTH_CH = Math.max(
  ...PACKAGE_MANAGERS.map((manager) => manager.length),
)

/** The chevron-down glyph's rendered size, in px — small enough to sit
 * beside the prefix label without competing with the copy glyph. */
const INSTALL_CHEVRON_SIZE = 10

/** The vertical divider's height, in px, between the prefix and the
 * command text — ~18px per the approved design spec; off tokens.tsx's
 * scale (16 and 20 both miss it), so it stays a literal. */
const INSTALL_DIVIDER_HEIGHT = 18

/** The popover's rendered width, in px — ~132px per the approved design
 * spec, wide enough for "pnpm" plus its checkmark without wrapping. */
const INSTALL_POPOVER_WIDTH = 132

/** Gap between the prefix trigger and the popover below it, in px. */
const INSTALL_POPOVER_GAP = SPACE.xxs

/** A popover menu item's font size, in px — {@link FONT_SIZE.bodySm} (14),
 * per the approved design spec. */
const INSTALL_POPOVER_ITEM_FONT_SIZE = FONT_SIZE.bodySm

/** The checkmark beside the popover's active item, in px. */
const INSTALL_CHECK_SIZE = 10

/* -----------------------------------------------------------------
 * CSS
 * ----------------------------------------------------------------- */

/**
 * The nav's responsive rules: three hardening rules that make the whole
 * `<Nav>` subtree render identically regardless of what the rest of the
 * page does (or doesn't) provide, then the two breakpoint rules transcribed
 * from the artboards' shared `<helmet><style>` preamble, plus the mobile
 * menu's own rules appended after them (invented — see the module doc
 * comment — so kept visibly separate from the canvas-pinned block above).
 *
 * `<Nav>` is meant to render pixel-identically no matter which page embeds
 * it, but three of the properties its own markup leaves to inheritance —
 * `box-sizing`, `.mono`/`.display`'s `font-family`, and `line-height` — are
 * either never declared by tokens.tsx's `designBaseCss()` at all, or (for
 * `.mono`/`.display`) declared with only the ordinary specificity of a bare
 * class selector. Either way, `<Nav>` ends up inheriting whatever the *host
 * page* happens to do around it instead of a value it controls itself:
 *
 * - `box-sizing`: every generator except `IndexPage` links or inlines a
 *   legacy, pre-redesign stylesheet (`assets/diagram-page.css`,
 *   `assets/blog.css`, `editor/css/variables.css`, …) that resets `*,
 *   *::before, *::after { box-sizing: border-box }` for its own old UI.
 *   `<Nav>` has no *currently* box-sizing-sensitive element (everything
 *   here is either padding-only or auto-sized), so this doesn't fix a
 *   live bug today — it's defensive, so the day a fixed-size element with
 *   padding gets added here, its math is `<Nav>`'s own to control rather
 *   than a bet on whatever the host page happens to reset.
 * - `.mono`/`.display` (the nav wordmark's and the install pill's fonts):
 *   this one *is* live, and was one of two confirmed causes of the install
 *   pill rendering at a visibly different height depending on which page
 *   you were on. `packages/core/src/theme.ts` emits each rendered
 *   diagram's colors as a bare, unscoped `<style>` *inside the SVG* —
 *   including, when the active theme uses one, a `.mono { font-family:
 *   'JetBrains Mono', ... }` rule for the diagram's own monospace text. An
 *   inline `<style>` inside an embedded (not `<img>`'d) SVG is not scoped
 *   to that SVG by the browser, so this rule leaks into the whole document
 *   — and on any page that both renders a live diagram *and* has this nav
 *   (the home page's theme showcase, every diagrams page, …), it collides
 *   with `.mono` on {@link NavInstall}'s pill text and — cascade ties go
 *   to whichever `<style>` is later in the DOM, not to `<Nav>`'s own —
 *   often wins, silently swapping the pill onto a different font stack
 *   than {@link FONTS}.mono and changing its rendered width/height.
 *   Restating both classes scoped to {@link NAV_ROOT_ID} outranks a bare
 *   `.mono` on specificity alone, so `<Nav>` wins regardless of DOM order
 *   or how many diagrams a page embeds.
 * - `line-height`: the other confirmed cause. `designBaseCss()`'s `body`
 *   rule now sets this to {@link LINE_HEIGHT}.body (see that function's
 *   doc comment), but `<Nav>`'s own links and pill text set an explicit
 *   `font-size` without a matching `line-height`, relying on inheritance —
 *   and editor-page.tsx doesn't compose `designBaseCss()` at all (it has
 *   its own `scopedDesignTokensCss()`, which was never given a
 *   `line-height` either — see that page's module doc comment for why).
 *   So on every page except `IndexPage`, `<Nav>` picked up whatever
 *   `line-height` the host page's *other* CSS happened to leave on `body`
 *   (1.6 from `assets/diagram-page.css`, a different value from
 *   `assets/blog.css`, the browser default on editor.html) rather than one
 *   `<Nav>` controls — changing the links' and pill's line-box height, and
 *   with it the whole bar's rendered height, page to page. Setting it once
 *   on {@link NAV_ROOT_ID} means `<Nav>` no longer depends on the host
 *   page providing (or not providing) any particular base style at all.
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
  return `#${NAV_ROOT_ID},
#${NAV_ROOT_ID} *,
#${NAV_ROOT_ID} *::before,
#${NAV_ROOT_ID} *::after {
  box-sizing: border-box;
}

#${NAV_ROOT_ID} {
  line-height: ${LINE_HEIGHT.body};
}

#${NAV_ROOT_ID} .display {
  font-family: var(--font-display);
  font-weight: ${FONT_WEIGHT.bold};
}

#${NAV_ROOT_ID} .mono {
  font-family: var(--font-mono);
}

${MEDIA.tablet} {
  .nav-bar { padding: ${NAV_PAD_Y.tablet}px ${NAV_PAD_X.tablet}px !important; }
  .nav-links { display: none !important; }
  .menu-toggle { display: inline-flex !important; }
}

${MEDIA.mobile} {
  .nav-bar { padding: ${NAV_PAD_Y.mobile}px ${NAV_PAD_X.mobile}px !important; }
  .nav-npm-text { display: none !important; }
  .nav-install-copy { min-width: 0 !important; }
}

@media (min-width: ${BREAKPOINTS.tablet + 1}px) and (max-width: ${NAV_CRAMPED_MAX}px) {
  .nav-npm-text { display: none !important; }
  .nav-install-copy { min-width: 0 !important; }
}

/*
 * Above the canvas's own 1440px artboard width (invented; not part of the
 * #590 canvas — see NAV_WIDE_MIN's doc comment), grow the bar's padding so
 * its content re-centers at the same ${LAYOUT.maxWidth}px column the page
 * body already clamps to, instead of leaving the fixed 80px padding behind
 * as the viewport keeps growing.
 */
@media (min-width: ${NAV_WIDE_MIN + 1}px) {
  .nav-bar {
    padding-left: calc((100% - ${LAYOUT.maxWidth}px) / 2) !important;
    padding-right: calc((100% - ${LAYOUT.maxWidth}px) / 2) !important;
  }
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
   * the homepage keeps that default. As of zombie-mermaid#902, the
   * homepage passes an empty fragment: its package-manager selector moved
   * into the hero's own `HeroInstall` (`index-app.tsx`), so the header
   * renders nothing in this slot rather than falling back to `NavInstall`
   * and duplicating it. (An earlier, #759-era homepage instead passed a
   * `<div id="nav-theme-slot" />` placeholder here for a live theme picker
   * reparented into it at runtime; that page-level use has since been
   * retired, though `NAV_THEME_SLOT_ID` and the plumbing for it remain in
   * `nav-island.tsx`/`demo/nav-client.tsx` — the "no `<button>` in Nav's
   * SSR output" invariant (`__tests__/demo-nav.test.ts`) holds regardless
   * of which slot content a page passes.)
   */
  installSlot?: ReactNode
  /**
   * `position: sticky; top: 0` instead of the canvas's own `position:
   * relative`. Defaults to `false`, but every page currently opts in —
   * see each page's own `<NavIsland sticky .../>` call site. Stays a
   * per-page prop rather than a hardcoded value so a future page can still
   * opt out.
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
 * The chevron-down glyph after the popover trigger's "npm" label —
 * {@link ChevronRightIcon}'s path rotated 90°, drawn locally rather than
 * imported since {@link IconProps} has no rotation escape hatch. Invented
 * for the package-manager selector (zombie-mermaid#719, see the module
 * doc comment); still drawn in the icon set's own stroke style (the same
 * {@link ICON_VIEW_BOX}/{@link ICON_STROKE_WIDTH}/{@link ICON_LINE_CAP}
 * {@link MenuToggle} draws its own local svg with) so it reads as part of
 * the same family.
 */
export function InstallChevronGlyph() {
  return (
    <svg
      width={INSTALL_CHEVRON_SIZE}
      height={INSTALL_CHEVRON_SIZE}
      viewBox={ICON_VIEW_BOX}
      fill="none"
      stroke={colorVar('--cyan')}
      strokeWidth={ICON_STROKE_WIDTH}
      strokeLinecap={ICON_LINE_CAP}
      strokeLinejoin={ICON_LINE_CAP}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/**
 * The install pill's leading "npm ▾" segment — clicking or pressing
 * Enter/Space opens {@link NavInstallPopover} below it. A `role="button"`
 * span, not a `<button>`, matching {@link NavInstall}'s own pre-existing
 * pattern (see `__tests__/demo-nav.test.ts`'s "no extra `<button>`"
 * assertion this file's module doc comment references).
 *
 * Invented for the package-manager selector (zombie-mermaid#719) — see the
 * module doc comment for where the design came from.
 */
export function NavInstallPrefix({
  manager,
  open,
  onToggle,
  triggerRef,
}: {
  manager: PackageManager
  open: boolean
  onToggle: () => void
  triggerRef: RefObject<HTMLSpanElement | null>
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>): void {
    if (
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'ArrowDown'
    ) {
      event.preventDefault()
      if (!open) onToggle()
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      onToggle()
    }
  }

  return (
    <span
      ref={triggerRef}
      className="nav-install-prefix"
      role="button"
      tabIndex={0}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label="Choose package manager"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${SPACE.xxs}px`,
        padding: `${INSTALL_PREFIX_PAD_Y}px ${INSTALL_PREFIX_PAD_X}px`,
        borderRadius: `${RADIUS.sm}px`,
        color: colorVar('--cyan'),
        cursor: 'pointer',
      }}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      <span style={{ minWidth: `${INSTALL_PREFIX_LABEL_MIN_WIDTH_CH}ch` }}>
        {manager}
      </span>
      <InstallChevronGlyph />
    </span>
  )
}

/**
 * The install pill's popover: all four {@link PACKAGE_MANAGERS}, with a
 * checkmark on the current selection. Reachable via the arrow keys once
 * focus lands inside it ({@link NavInstall} moves focus to the active
 * item when it opens), and each item is itself a `role="option"` span —
 * same "no literal `<button>`" reasoning as {@link NavInstallPrefix}.
 *
 * Invented for the package-manager selector (zombie-mermaid#719) — see the
 * module doc comment for where the design came from.
 */
export function NavInstallPopover({
  manager,
  onSelect,
  onClose,
  triggerRef,
  itemRefs,
  popoverRef,
}: {
  manager: PackageManager
  onSelect: (manager: PackageManager) => void
  onClose: () => void
  triggerRef: RefObject<HTMLSpanElement | null>
  itemRefs: RefObject<(HTMLSpanElement | null)[]>
  popoverRef: RefObject<HTMLSpanElement | null>
}) {
  function handleItemKeyDown(
    event: KeyboardEvent<HTMLSpanElement>,
    item: PackageManager,
    index: number,
  ): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(item)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      triggerRef.current?.focus()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      itemRefs.current[(index + 1) % PACKAGE_MANAGERS.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      itemRefs.current[
        (index - 1 + PACKAGE_MANAGERS.length) % PACKAGE_MANAGERS.length
      ]?.focus()
    }
  }

  return (
    <span
      ref={popoverRef}
      className="nav-install-popover"
      role="listbox"
      aria-label="Package manager"
      style={{
        position: 'absolute',
        top: `calc(100% + ${INSTALL_POPOVER_GAP}px)`,
        left: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        width: `${INSTALL_POPOVER_WIDTH}px`,
        background: colorVar('--panel'),
        border: `1px solid ${colorVar('--border')}`,
        borderRadius: `${RADIUS.lg}px`,
        padding: `${SPACE.xs}px`,
        zIndex: NAV_Z_INDEX + 1,
        cursor: 'default',
      }}
    >
      {PACKAGE_MANAGERS.map((item, index) => {
        const active = item === manager
        return (
          <span
            key={item}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
            className="nav-install-option"
            role="option"
            aria-selected={active}
            tabIndex={0}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: `${SPACE.xs}px`,
              padding: `${SPACE.xs}px ${SPACE.sm}px`,
              borderRadius: `${RADIUS.sm}px`,
              fontFamily: 'var(--font-mono)',
              fontSize: `${INSTALL_POPOVER_ITEM_FONT_SIZE}px`,
              color: colorVar(active ? '--text' : '--text-dim'),
              background: active ? colorVar('--panel-2') : 'transparent',
              cursor: 'pointer',
            }}
            onClick={() => onSelect(item)}
            onKeyDown={(event) => handleItemKeyDown(event, item, index)}
          >
            {item}
            {active ? (
              <CheckIcon size={INSTALL_CHECK_SIZE} color={colorVar('--cyan')} />
            ) : null}
          </span>
        )
      })}
    </span>
  )
}

/* -----------------------------------------------------------------
 * Package-manager install state (zombie-mermaid#719)
 *
 * Extracted out of {@link NavInstall} (zombie-mermaid#902) so the homepage
 * hero's own compact instance (`index-app.tsx`'s `HeroInstall`) can drive
 * the same popover-and-copy behavior without a second copy of this state —
 * only the surrounding chrome (the outer `<Pill>`'s background/border) is
 * ever specific to where it's mounted.
 * ----------------------------------------------------------------- */

/** Everything {@link usePackageManagerInstall} hands back to a caller. */
export interface PackageManagerInstall {
  /** The popover's current selection. */
  selectedManager: PackageManager
  /** Whether {@link NavInstallPopover} is open. */
  popoverOpen: boolean
  /** Whether the "copied" flash is showing. */
  copied: boolean
  /** `command`, rewritten for {@link selectedManager}. */
  displayedCommand: string
  /** The longest of the four managers' commands for this `command`'s
   * package name — always the npm form. A caller reserves this as the copy
   * target's `min-width` (in `ch`) so switching managers never shrinks the
   * pill (zombie-mermaid#902). */
  widestCommand: string
  /** Attach to the trigger element {@link NavInstallPrefix} renders. */
  triggerRef: RefObject<HTMLSpanElement | null>
  /** Attach to the wrapper around a rendered {@link NavInstallPopover}. */
  popoverRef: RefObject<HTMLSpanElement | null>
  /** Attach to each popover item, for {@link NavInstallPopover}'s roving focus. */
  itemRefs: RefObject<(HTMLSpanElement | null)[]>
  /** Opens/closes the popover. */
  togglePopover: () => void
  /** Closes the popover without moving focus. */
  closePopover: () => void
  /** Picks a manager, closes the popover, and returns focus to the trigger. */
  selectManager: (next: PackageManager) => void
  /** Copies {@link displayedCommand} and flashes {@link copied}. */
  copyCommand: () => void
  /** Enter/Space activates {@link copyCommand}. */
  handleCopyKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => void
}

/**
 * State and handlers behind the install pill's package-manager popover and
 * copy-to-clipboard button — shared by {@link NavInstall} (the nav bar, on
 * every page but the homepage) and the homepage hero's own compact
 * instance. Takes the same `command` prop either caller already has (a
 * page's `installCommand`/{@link NAV_INSTALL_COMMAND}), so there is exactly
 * one definition of this behavior regardless of which chrome wraps it.
 *
 * The initial SSR render always shows npm (`useState`'s default), matching
 * the pill's pre-#719 behavior exactly; the popover starts closed.
 */
export function usePackageManagerInstall(
  command: string,
): PackageManagerInstall {
  const [selectedManager, setSelectedManager] = useState<PackageManager>('npm')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const revertTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const popoverRef = useRef<HTMLSpanElement | null>(null)
  const itemRefs = useRef<(HTMLSpanElement | null)[]>([])

  const packageName = packageNameFromCommand(command)
  const displayedCommand =
    selectedManager === 'npm'
      ? command
      : installCommandFor(selectedManager, packageName)
  // Always the `npm install <pkg>` form: `install` outruns the other three
  // managers' shared `add` verb regardless of `packageName`, so this is
  // always at least as long as any of the four rendered commands. Reserved
  // as the copy target's `min-width` (see the two call sites) so switching
  // managers can only ever leave *trailing* space in the pill, never shrink
  // it and shove whatever sits next to it (zombie-mermaid#902).
  const widestCommand = installCommandFor('npm', packageName)

  // Cleared on unmount so a pending revert never fires against an
  // unmounted component (defensive — neither caller intentionally unmounts
  // this, but hydration boundaries are exactly the place to not assume
  // that).
  useEffect(() => {
    return () => {
      if (revertTimer.current) clearTimeout(revertTimer.current)
    }
  }, [])

  // Closes the popover on a click/tap outside both the trigger and the
  // popover itself, and on Escape regardless of which of the two currently
  // holds focus — the same "click elsewhere or Escape closes it" contract
  // NAV_MOBILE_MENU_SCRIPT gives the mobile menu, done here in React state
  // instead since this popover is real `useState`, not a runtime script.
  useEffect(() => {
    if (!popoverOpen) return

    function handlePointerDown(event: globalThis.MouseEvent): void {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setPopoverOpen(false)
    }

    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === 'Escape') {
        setPopoverOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [popoverOpen])

  // Moves focus into the popover when it opens — onto the currently
  // selected item, mirroring how opening {@link MobileNavPanel} focuses
  // its first link.
  useEffect(() => {
    if (!popoverOpen) return
    const activeIndex = PACKAGE_MANAGERS.indexOf(selectedManager)
    itemRefs.current[activeIndex >= 0 ? activeIndex : 0]?.focus()
    // Deliberately keyed on `popoverOpen` alone, not every `selectedManager`
    // change while open — selecting an item already closes the popover
    // (see `selectManager`), so re-running this on that change would never
    // observably differ.
  }, [popoverOpen])

  function copyCommand(): void {
    if (!displayedCommand || !navigator.clipboard) return
    navigator.clipboard.writeText(displayedCommand).then(() => {
      setCopied(true)
      if (revertTimer.current) clearTimeout(revertTimer.current)
      revertTimer.current = setTimeout(
        () => setCopied(false),
        NAV_COPY_FEEDBACK_MS,
      )
    })
  }

  function handleCopyKeyDown(event: KeyboardEvent<HTMLSpanElement>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      copyCommand()
    }
  }

  function selectManager(next: PackageManager): void {
    setSelectedManager(next)
    setPopoverOpen(false)
    triggerRef.current?.focus()
  }

  return {
    selectedManager,
    popoverOpen,
    copied,
    displayedCommand,
    widestCommand,
    triggerRef,
    popoverRef,
    itemRefs,
    togglePopover: () => setPopoverOpen((open) => !open),
    closePopover: () => setPopoverOpen(false),
    selectManager,
    copyCommand,
    handleCopyKeyDown,
  }
}

/**
 * The install pill: the canvas's `muted` {@link Pill} lifted onto
 * `--panel-2`, holding the package-manager selector, the command, and a
 * copy glyph — all driven by {@link usePackageManagerInstall}.
 *
 * The text is the element the 600px rule hides, so it must stay its own
 * `.nav-npm-text` span rather than being the pill's bare text content.
 *
 * As of zombie-mermaid#719 (invented, not canvas-pinned — see the module
 * doc comment), the pill also carries {@link NavInstallPrefix}: clicking it
 * (rather than the rest of the pill) opens {@link NavInstallPopover} to
 * pick a package manager, which drives both the prefix label and the
 * command text/copy payload. Neither the prefix nor the popover is nested
 * inside a click-to-copy region — they sit beside it as their own
 * focusable, `role`-carrying spans — so there is no ambiguity between
 * "open the popover" and "copy the command" clicks, and no nested
 * interactive roles for assistive tech to untangle.
 */
function NavInstall({ command }: { command: string }) {
  const install = usePackageManagerInstall(command)

  return (
    <Pill
      mono
      style={{
        background: colorVar('--panel-2'),
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <NavInstallPrefix
        manager={install.selectedManager}
        open={install.popoverOpen}
        onToggle={install.togglePopover}
        triggerRef={install.triggerRef}
      />
      <span
        className="nav-install-divider"
        aria-hidden="true"
        style={{
          width: '1px',
          height: `${INSTALL_DIVIDER_HEIGHT}px`,
          background: colorVar('--border'),
        }}
      />
      <span
        className="nav-install-copy"
        role="button"
        tabIndex={0}
        aria-label="Copy install command"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${SPACE.sm}px`,
          flex: 1,
          // Reserves room for the widest of the four managers' commands —
          // see `widestCommand`'s doc comment — so switching managers can
          // only ever leave trailing space here, never shrink the pill.
          // Zeroed back out (navCss's `.nav-install-copy` rules) wherever
          // `.nav-npm-text` itself goes `display: none` — no sense
          // reserving room for text that isn't rendered.
          minWidth: `calc(${install.widestCommand.length}ch + ${SPACE.sm}px + ${COPY_ICON_SIZE}px)`,
          cursor: 'pointer',
        }}
        onClick={install.copyCommand}
        onKeyDown={install.handleCopyKeyDown}
      >
        <span className="nav-npm-text">{install.displayedCommand}</span>
        <CopyIcon
          size={COPY_ICON_SIZE}
          strokeWidth={COPY_ICON_STROKE}
          color={install.copied ? NAV_COPY_SUCCESS_COLOR : NAV_COPY_ICON_COLOR}
        />
      </span>
      {install.popoverOpen ? (
        <NavInstallPopover
          manager={install.selectedManager}
          onSelect={install.selectManager}
          onClose={install.closePopover}
          triggerRef={install.triggerRef}
          itemRefs={install.itemRefs}
          popoverRef={install.popoverRef}
        />
      ) : null}
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
 * {@link MenuToggle} at runtime — still a "static markup, runtime script"
 * split (unlike the install pill's copy behavior, real React state as of
 * #800; see {@link NavInstall}'s doc comment). `position: fixed` on
 * `.mobile-nav-panel` means it covers the viewport regardless of where
 * `Nav` sits in the page, so it renders as `Nav`'s sibling rather than
 * nested inside the bar.
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
 * `StrokeIcon`). {@link NavInstall} reverts to this after the "copied"
 * flash rather than a hand-typed duplicate of the color.
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

/* -----------------------------------------------------------------
 * Hydration (zombie-mermaid#800)
 * ----------------------------------------------------------------- */

/**
 * `nav-root`: id of the *hydration container* every page's Nav-hydration
 * client script (`demo/nav-client.tsx`'s `hydrateNav()`) mounts onto — see
 * `demo/components/nav-island.tsx`'s `NavIsland`, which every page-level
 * generator now renders in place of a bare `<Nav .../>`.
 *
 * A separate wrapper element from `Nav`'s own rendered root, for the same
 * reason `dashboard-app.tsx`'s `DASHBOARD_ROOT_ID` is (see that constant's
 * doc comment): `Nav` itself returns a fragment — the bar, then {@link
 * MobileNavPanel} as its sibling — and `hydrateRoot(container, node)`
 * requires a single container whose *children* match what `node` renders,
 * not a container that is itself part of that render output.
 */
export const NAV_ROOT_ID = 'nav-root'

/**
 * `nav-props`: the `<script type="application/json">` element
 * `demo/nav-client.tsx` reads a page's Nav props out of — see
 * `nav-island.tsx`'s `NavHydrationProps` for the JSON-safe subset of
 * {@link NavProps} actually embedded (a real `installSlot` element can't
 * round-trip through JSON, so it's carried as a boolean flag instead and
 * reconstructed client-side).
 */
export const NAV_PROPS_ELEMENT_ID = 'nav-props'

/**
 * `nav-theme-slot`: id of the placeholder `<div>` the homepage passes as
 * {@link NavProps.installSlot} (see that prop's own doc comment) —
 * exported so `nav-island.tsx` can reconstruct the exact same element on
 * both sides of hydration without a second hardcoded copy of the string,
 * and so `demo/index-page-client.ts`'s `document.getElementById(...)`
 * lookup and this id can never drift apart.
 */
export const NAV_THEME_SLOT_ID = 'nav-theme-slot'

/* -----------------------------------------------------------------
 * Mobile menu behavior
 * ----------------------------------------------------------------- */

/**
 * Opens, closes, and focus-manages {@link MobileNavPanel} — a plain runtime
 * script, not React state, even though `Nav` itself hydrates as of #800:
 * the toggle and panel render exactly the same DOM either way, and out-of-
 * scope for #800 (see this file's module doc comment on the mobile menu
 * being invented, not canvas-pinned) — {@link NavInstall}'s copy button is
 * the one piece of `Nav` interactivity this issue converts to real
 * `onClick`/`useState`.
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
 *
 * Also resets the menu when the viewport grows past {@link
 * BREAKPOINTS}.tablet while it's open (a window resize, or a phone
 * rotated). {@link navCss}'s own `min-width` safety net only hides the
 * panel visually (`opacity/pointer-events`) at that point — the toggle
 * (already `display: none` there, so invisible either way) and `<html>`
 * both stay stuck in their "open" state otherwise, which leaves background
 * scroll locked on desktop indefinitely and, if the viewport later shrinks
 * back below the breakpoint, makes the panel reappear already open with no
 * click that opened it. `window.matchMedia`'s own `change` event is the
 * primary signal, with a `resize`-driven fallback gated on an actual
 * `.matches` flip for environments that don't reliably dispatch `change`
 * for an emulated viewport (devtools/CDP-driven resizing, observed the same
 * way in `demo/diagram-page-client.ts`'s `narrowViewportQuery` and
 * `demo/client.ts`'s gallery equivalent) even though `.matches` itself is
 * correct there — the exact same two-layer pattern, applied here to the
 * opposite (`min-width`) direction.
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

  var desktopQuery = window.matchMedia('(min-width: ${BREAKPOINTS.tablet + 1}px)')

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

    function closeIfDesktop() {
      if (desktopQuery.matches && panel.classList.contains('is-open')) {
        closeMenu(toggle, panel, false)
      }
    }

    desktopQuery.addEventListener('change', closeIfDesktop)

    var lastDesktopMatch = desktopQuery.matches
    window.addEventListener('resize', function () {
      if (desktopQuery.matches === lastDesktopMatch) return
      lastDesktopMatch = desktopQuery.matches
      closeIfDesktop()
    })
  })
})()`

/**
 * {@link NAV_MOBILE_MENU_SCRIPT} in a `<script>` element.
 *
 * Render this once per page, after the last `<Nav>`/{@link NavIsland} in
 * the document.
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
            // A page that overrides installSlot (any NavInstallSlotKind,
            // 'empty' included) leaves the trailing flex child with no
            // real content but the mobile-only MenuToggle, which is
            // itself display:none above the tablet breakpoint -- barStyle's
            // justify-content:space-between still treats that now-empty
            // child as a real flex item, splitting the header's leftover
            // width evenly between "before the links" and "after the
            // links" and stranding nav-links mid-bar with a dead gap to
            // its right. marginLeft:'auto' claims that leftover space for
            // the gap before nav-links instead, pushing it flush against
            // the (empty) trailing child. Left unset (space-between's
            // default split) when installSlot is left undefined -- e.g. a
            // bare `<Nav/>` in tests, or any future caller that wants the
            // real NavInstall pill -- where the trailing child's real
            // width already keeps nav-links positioned correctly.
            marginLeft: installSlot !== undefined ? 'auto' : undefined,
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
