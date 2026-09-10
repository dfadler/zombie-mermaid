/**
 * `<Nav>`'s CSS, split out of nav.tsx (zombie-mermaid#933) so that file
 * doesn't own both layout markup and ~150 lines of CSS-string generation.
 *
 * Per #933's own body: this is the CSS-Modules issue (#938) coordination
 * point. #938 was still open with no merged PR when this split landed, so
 * `navCss()` stays exactly what it was — a template-literal CSS string, not
 * a `.module.css` file — just relocated to its own module. Converting it is
 * #938's to do, not this issue's.
 */
import {
  MOBILE_WATERMARK_SIZE,
  NAV_PAD_X,
  NAV_PAD_Y,
  NAV_ROOT_ID,
  NAV_Z_INDEX,
} from './nav-constants.ts'
import {
  BREAKPOINTS,
  FONT_WEIGHT,
  LAYOUT,
  LINE_HEIGHT,
  MEDIA,
  SPACE,
} from './tokens.tsx'

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
 * fills (see nav.tsx's module doc comment). Every redesigned page body
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

/** The watermark's opacity — faint enough to read as texture, not a logo. */
const MOBILE_WATERMARK_OPACITY = 0.05

/**
 * `z-index` on the overlay panel — one below {@link NAV_Z_INDEX}, so the
 * bar (and the toggle button inside it, mid-morph into a close "X") stays
 * visible and clickable above the overlay rather than being covered by it.
 */
const MOBILE_PANEL_Z_INDEX = NAV_Z_INDEX - 1

/**
 * The nav's responsive rules: three hardening rules that make the whole
 * `<Nav>` subtree render identically regardless of what the rest of the
 * page does (or doesn't) provide, then the two breakpoint rules transcribed
 * from the artboards' shared `<helmet><style>` preamble, plus the wide-
 * viewport rule and the mobile menu's own rules appended after them
 * (invented — see nav.tsx's module doc comment — so kept visibly separate
 * from the canvas-pinned block above).
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
 *   with `.mono` on the install pill's text and — cascade ties go to
 *   whichever `<style>` is later in the DOM, not to `<Nav>`'s own — often
 *   wins, silently swapping the pill onto a different font stack and
 *   changing its rendered width/height. Restating both classes scoped to
 *   {@link NAV_ROOT_ID} outranks a bare `.mono` on specificity alone, so
 *   `<Nav>` wins regardless of DOM order or how many diagrams a page
 *   embeds.
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
 * `!important` convention for the same reason (overriding the menu
 * toggle's inline `display: none`).
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
