/** @jsxRuntime automatic */
/**
 * The home page (index.ts → index.html) as the site redesign's actual
 * marketing landing page (#598, part of the #590 "Diagram-Native Showcase"
 * redesign).
 *
 * Until #598 this file rendered the interactive sample gallery — every
 * shape, edge type, and theme variant, rendered client-side for browsing.
 * That gallery's job (letting a visitor browse every sample/theme
 * combination) now belongs to the Diagrams hub (#599's `/diagrams/`) and the
 * Editor (`editor.html`); this file is the page that sends a first-time
 * visitor to those, not the page that replaces them.
 *
 * As of zombie-mermaid#804, this file holds only the page *shell*
 * (`<html>`/`<head>`, the `NavIsland`/`ThemeShowcase`/`Footer` sibling
 * islands, the hydration containers/script wiring) — the hydrated body
 * content (hero, feature grid, CLI/MCP section, gallery teaser, proof
 * section, blog teaser) lives in `index-app.tsx`'s `IndexHeroApp`/
 * `IndexMainApp`, split out specifically so `demo/index-client.tsx` (the
 * browser bundle) never needs to import this file, and therefore never
 * pulls in `react-dom/server` (used below for `renderToString`) into the
 * client bundle. `ThemeShowcase` stays here rather than moving into either
 * app: it calls `renderMermaidSVG` to build-time-render its six diagrams
 * (Node-only work a client bundle can't do), so it's static markup plus a
 * small separate bundled client script (`demo/index-page-client.ts`, via
 * `index.ts`'s `bundleClientScript()`) that auto-cycles those six
 * pre-rendered diagrams through all of `THEMES`, live, with no interactive
 * control on the page itself — see that section's own doc comment for why.
 *
 * Layout, copy, and every colour/measurement below come from the design
 * canvas linked in #590's body
 * (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`),
 * specifically its `Main.dc.html` (desktop) / `MainMobile.dc.html` (mobile)
 * artboards — the two are byte-identical, so the responsive behaviour lives
 * entirely in the shared component `*Css()` functions and {@link homePageCss}'s
 * `@media` blocks, not in a second markup path. See `index-app.tsx`'s
 * header comment for its own deliberate deviations from the canvas
 * (unchanged by this split). This file's own deviation: the theme
 * showcase renders six *real* diagrams (one per diagram type this library
 * supports), auto-cycling live across every real theme in `THEMES`, not
 * the canvas's five static per-theme cards with invented theme names
 * ("Neon", "Pastel", …) or a single flowchart. See {@link ThemeShowcase}'s
 * own doc comment.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { renderToString } from 'react-dom/server'
import { FORK_URL, HOME_HREF, ROOT_NAV_HREFS } from './site-chrome.tsx'
import { NavMobileMenuScript } from './nav.tsx'
import { NavIsland } from './nav-island.tsx'
import { Footer, type FooterColumn } from './footer.tsx'
import { SectionEyebrow } from './primitives.tsx'
import { SharedPageStyles } from './shared-page-css.tsx'
import {
  DesignFontLinks,
  FONT_SIZE,
  LAYOUT,
  LETTER_SPACING,
  MEDIA,
  RADIUS,
  SPACE,
  colorVar,
} from './tokens.tsx'
import { renderMermaidSVG } from '../../src/index.ts'
import { THEMES } from '@zombie-mermaid/core'
import { DIAGRAM_TYPE_PROFILES } from '../diagram-pages-data.ts'
import { THEME_LABELS } from '../theme-labels.ts'
import {
  IndexHeroApp,
  IndexMainApp,
  INDEX_HERO_ROOT_ID,
  INDEX_MAIN_ROOT_ID,
} from './index-app.tsx'

// Re-exported for existing callers/tests that import these from
// index-page.tsx rather than index-app.tsx directly (this file was the
// sole home for all of them before the #804 split).
export {
  IndexHeroApp,
  IndexMainApp,
  INDEX_HERO_ROOT_ID,
  INDEX_MAIN_ROOT_ID,
} from './index-app.tsx'

const NPM_URL = 'https://www.npmjs.com/package/zombie-mermaid'
const SITE_URL = 'https://dfadler.github.io/zombie-mermaid/'
const OG_IMAGE_URL = 'https://dfadler.github.io/zombie-mermaid/og-image.png'
const PLAUSIBLE_DOMAIN = 'dfadler.github.io/zombie-mermaid'

/* -----------------------------------------------------------------
 * Content: real repo data, not invented copy
 * ----------------------------------------------------------------- */

/**
 * The Mermaid source {@link ThemeShowcase} renders live, matching what
 * `index-app.tsx`'s `IndexHeroApp` hand-drawn mock already depicts ("Start
 * → Deploy? → Ship it / Iterate") so the showcase diagram tells the same
 * story the hero does, one section down — rather than an unrelated
 * invented example.
 */
const THEME_SHOWCASE_SOURCE = `graph TD
    Start --> Deploy{Deploy?}
    Deploy -->|yes| Ship[Ship it]
    Deploy -->|no| Iterate[Iterate]`

/**
 * {@link ThemeShowcase}'s starting theme, before a visitor picks one (or a
 * stored preference from another page restores on load — see
 * `demo/index-page-client.ts`). Real, not the `''` Default pseudo-theme:
 * this showcase's whole point is proving the 15 real themes, so its picker
 * renders with `includeDefault={false}` and needs an actual key to render
 * the initial SSR diagram with. `dracula` also mirrors `theme-picker.tsx`'s
 * own `INLINE_THEMES`, which already surfaces it as one of the two themes
 * always shown outside the "N Themes" dropdown.
 */
const THEME_SHOWCASE_DEFAULT_THEME = 'dracula'

/**
 * Fixed height of the showcase's diagram card, so the section doesn't
 * reflow every ~2.8s as `index-page-client.ts`'s cycle swaps between
 * diagram types of very different natural aspect ratios (a tall, narrow
 * flowchart vs. a short, wide ER diagram) — see `renderShowcaseDiagrams()`.
 * Comfortably fits the tallest of the six diagram types at this card's
 * content width (the xy-chart, ~355px once scaled to fit); anything taller
 * shrinks via `max-height` on the svg, or is clipped by the card's own
 * `overflow: hidden` as a last resort.
 */
const THEME_SHOWCASE_DIAGRAM_CARD_HEIGHT = 400

/* -----------------------------------------------------------------
 * Page-specific CSS: the responsive rules and animations the canvas
 * defines that aren't already covered by tokens.tsx / primitives.tsx /
 * nav.tsx / footer.tsx's own `*Css()` functions.
 * ----------------------------------------------------------------- */

/**
 * A hero-only stacking breakpoint, wider than {@link MEDIA}.tablet's 900px
 * — a deliberate deviation from the canvas, which only ever defines
 * a desktop (1440px) and a mobile (390px) artboard with nothing in between.
 * `.hero-row`'s two flex children (`hero-copy` at 500px + `hero-visual` at
 * 700px, plus the row's 48px gap) need ~1250px of content width before
 * neither has to shrink, so leaving the row layout active down to 900px
 * squeezes both the copy and the diagram together across the entire
 * 900-1400px band — covering most real laptop viewport widths (1024, 1280,
 * 1366). Stacking at 1200px instead keeps the side-by-side row for
 * genuinely wide screens and gives everything narrower the same spacious
 * full-width column treatment the tablet breakpoint already uses below it,
 * rather than a cramped in-between state.
 */
const HERO_STACK_MEDIA = '@media (max-width: 1200px)'

/**
 * Keyframes for the six per-diagram-type gallery animations plus the
 * shared "marching ants" edge animation, transcribed from Main.dc.html's
 * helmet style block — each keyed to what that diagram type actually shows
 * in motion (a state diagram's radar ping, a sequence diagram's message
 * flow, an ER diagram's relationship pulse, …), plus this page's own
 * hero/section responsive rules. Every animation is disabled under
 * `prefers-reduced-motion: reduce`.
 *
 * Emit once, after shared-page-css.tsx's `sharedPageCss()` (via
 * `SharedPageStyles`) — this page's `<style>` order in {@link IndexPage}.
 *
 * A fourth deliberate deviation from the canvas, alongside the three this
 * file's header comment already names: the body gradient's middle stop is
 * `colorVar('--bg-soft')`, not the canvas's literal `#0d1120`. That literal
 * is a fixed, non-`var()` colour tokens.tsx's `--bg-soft` was already
 * defined for ("a lifted page background... for alternating full-bleed
 * sections") — using it instead makes this gradient re-theme along with
 * the rest of the site chrome (#772) rather than leaving a static dark band
 * behind on every non-default theme, including light ones.
 */
function homePageCss(): string {
  return `body {
  background: linear-gradient(180deg, ${colorVar('--bg')} 0%, ${colorVar('--bg-soft')} 40%, ${colorVar('--bg')} 100%);
  overflow-x: hidden;
}

.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 100;
  padding: ${SPACE.md}px ${SPACE.xl}px;
  background: ${colorVar('--panel')};
  color: ${colorVar('--text')};
}
.skip-link:focus {
  left: ${SPACE.xl}px;
  top: ${SPACE.xl}px;
}

@keyframes marchingAnts { to { stroke-dashoffset: -24; } }
.edge-anim { stroke-dasharray: 6 6; animation: marchingAnts 0.9s linear infinite; }

@keyframes radarPing {
  0% { r: 14; opacity: 0.55; stroke-width: 2; }
  100% { r: 27; opacity: 0; stroke-width: 0.5; }
}
.radar-ping { transform-origin: center; animation: radarPing 1.8s ease-out infinite; }

@keyframes msgFlowRight { to { stroke-dashoffset: -16; } }
@keyframes msgFlowLeft { to { stroke-dashoffset: 16; } }
.msg-flow-right { stroke-dasharray: 4 4; animation: msgFlowRight 1.1s linear infinite; }
.msg-flow-left { stroke-dasharray: 4 4; animation: msgFlowLeft 1.1s linear 0.55s infinite; }

@keyframes drawLine {
  0% { stroke-dashoffset: 56; }
  55%, 100% { stroke-dashoffset: 0; }
}
.draw-line { stroke-dasharray: 56; animation: drawLine 2.8s ease-in-out infinite; }

@keyframes relationPulse {
  0%, 100% { opacity: 0.45; stroke-width: 2; }
  50% { opacity: 1; stroke-width: 3; }
}
.relation-pulse { transform-origin: center; animation: relationPulse 1.8s ease-in-out infinite; }

@keyframes barGrow {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.4); }
}
.bar-grow { transform-box: fill-box; transform-origin: bottom; animation: barGrow 1.6s ease-in-out infinite; }

/* -- Theme showcase: full-bleed animated backdrop + auto-cycling proof.
   demo/index-page-client.ts's startShowcaseCycle() drives the actual
   theme/diagram swapping (JS, not CSS) -- everything here is either the
   ambient background motion or static layout/type. */
.theme-showcase { background: ${colorVar('--bg-soft')}; }
.theme-showcase-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.theme-showcase-mesh {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1800px;
  height: 1400px;
  margin: -700px 0 0 -900px;
  background: conic-gradient(
    from 0deg,
    color-mix(in srgb, ${colorVar('--violet')} 24%, transparent),
    color-mix(in srgb, ${colorVar('--cyan')} 18%, transparent),
    color-mix(in srgb, ${colorVar('--pink')} 18%, transparent),
    color-mix(in srgb, ${colorVar('--amber')} 16%, transparent),
    color-mix(in srgb, ${colorVar('--violet')} 24%, transparent)
  );
  filter: blur(120px);
  opacity: 0.5;
  animation: themeShowcaseMeshSpin 60s linear infinite, themeShowcaseMeshRoam 34s ease-in-out infinite;
}
@keyframes themeShowcaseMeshSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes themeShowcaseMeshRoam {
  0% { margin-left: -900px; margin-top: -700px; }
  33% { margin-left: -1080px; margin-top: -560px; }
  66% { margin-left: -760px; margin-top: -820px; }
  100% { margin-left: -900px; margin-top: -700px; }
}
.theme-showcase-aurora { position: absolute; inset: -10%; animation: themeShowcaseHue 26s linear infinite; }
.theme-showcase-glow { position: absolute; border-radius: 50%; filter: blur(90px); mix-blend-mode: screen; }
.theme-showcase-glow.g1 { width: 560px; height: 560px; background: ${colorVar('--violet')}; opacity: 0.36; top: -10%; left: 2%; animation: themeShowcaseDrift1 17s ease-in-out infinite alternate; }
.theme-showcase-glow.g2 { width: 520px; height: 520px; background: ${colorVar('--cyan')}; opacity: 0.3; top: 6%; right: 0%; animation: themeShowcaseDrift2 21s ease-in-out infinite alternate; }
.theme-showcase-glow.g3 { width: 480px; height: 480px; background: ${colorVar('--pink')}; opacity: 0.26; bottom: -14%; left: 20%; animation: themeShowcaseDrift3 24s ease-in-out infinite alternate; }
.theme-showcase-glow.g4 { width: 500px; height: 500px; background: ${colorVar('--amber')}; opacity: 0.22; bottom: -6%; right: 12%; animation: themeShowcaseDrift4 19s ease-in-out infinite alternate; }
@keyframes themeShowcaseHue { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }
@keyframes themeShowcaseDrift1 { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(150px,-85px) scale(1.14); } 100% { transform: translate(-85px,65px) scale(0.92); } }
@keyframes themeShowcaseDrift2 { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(-130px,100px) scale(0.88); } 100% { transform: translate(85px,-75px) scale(1.1); } }
@keyframes themeShowcaseDrift3 { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(110px,95px) scale(1.12); } 100% { transform: translate(-130px,-55px) scale(0.9); } }
@keyframes themeShowcaseDrift4 { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(-100px,-85px) scale(1.08); } 100% { transform: translate(120px,55px) scale(0.94); } }

.theme-showcase-term {
  background: color-mix(in srgb, ${colorVar('--panel')} 82%, transparent);
  backdrop-filter: blur(6px);
  border: 1px solid ${colorVar('--border')};
  border-radius: ${RADIUS.card}px;
  overflow: hidden;
}
.theme-showcase-term-bar { display: flex; gap: 7px; padding: 12px 14px; border-bottom: 1px solid ${colorVar('--border')}; }
.theme-showcase-term-dot { width: 9px; height: 9px; border-radius: 50%; }
/* height fits its fixed 6-line content (the leading theme-name comment
   line, ":root {", 3 var lines, "}") at this font-size/line-height, plus
   a few px of slack for cross-browser line-box rounding -- content never
   gains or loses a line, only the swapped-in theme name/hex values' text
   changes width, so this never needs to grow. */
.theme-showcase-term-body { font-size: 13px; line-height: 1.95; padding: 16px 18px; color: ${colorVar('--text-dim')}; height: 158px; }
.theme-showcase-kw { color: ${colorVar('--blue')}; }
.theme-showcase-comment { color: ${colorVar('--text-faint')}; }
.theme-showcase-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 8px;
  vertical-align: middle;
  transition: background 900ms ease;
}
.theme-showcase-diagram-card {
  height: ${THEME_SHOWCASE_DIAGRAM_CARD_HEIGHT}px;
  border-radius: ${RADIUS.card}px;
  border: 1px solid ${colorVar('--border')};
  padding: ${SPACE.xl}px;
  margin-top: ${SPACE.xl}px;
  display: flex;
  justify-content: center;
  transition: background 900ms ease;
  overflow: hidden;
}
/* Fills the card -- a plain block would collapse to 0x0 once its children
   (the six slots) go position: absolute below, since absolutely
   positioned children no longer contribute to a parent's intrinsic size. */
#theme-showcase-diagrams { position: relative; width: 100%; height: 100%; }
/* All six slots stack exactly on top of each other; only the .is-active
   one is visible. index-page-client.ts's startShowcaseCycle() runs each
   step as a strict, staged sequence rather than animating this and the
   card's own background transition at once: fade the current diagram out
   (this rule's own opacity transition) -- once it's fully transparent,
   re-theme it and animate the card's background (900ms, above) -- once
   that finishes, fade the new diagram (already re-themed) back in. So the
   diagram is never visible while its own colors change (each slot is
   always either hidden or at full contrast, never interpolating between
   two themes' colors, which made text briefly unreadable when tried) and
   never competes on-screen with the background's own color transition.
   350ms here is deliberately quicker than the card's 900ms: it only has
   to clear the diagram off-screen (or bring it back), not carry a color
   change of its own. Keep this file's own DIAGRAM_FADE_MS in sync by
   hand if either changes -- see that constant's doc comment. */
.theme-showcase-diagram-slot {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 350ms ease;
  pointer-events: none;
}
.theme-showcase-diagram-slot.is-active { opacity: 1; pointer-events: auto; }
.theme-showcase-diagram-slot svg {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  /* Fixed px, not a percentage: the slot's own height is auto (sized to
     this svg), so a percentage max-height here would have no definite
     containing block to resolve against and would compute to none. This
     page has no box-sizing: border-box reset, so the card's own
     "height" declaration above is already its content-box height --
     no padding to subtract here. */
  max-height: ${THEME_SHOWCASE_DIAGRAM_CARD_HEIGHT}px;
  margin: 0 auto;
}

.theme-showcase-frac { display: inline-flex; align-items: baseline; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.theme-showcase-frac-cur { font-size: 34px; font-weight: 700; color: ${colorVar('--cyan')}; letter-spacing: -0.02em; }
.theme-showcase-frac-slash { font-size: 20px; color: ${colorVar('--text-faint')}; margin: 0 1px; }
.theme-showcase-frac-total { font-size: 20px; color: ${colorVar('--text-faint')}; }

${MEDIA.reducedMotion} {
  .edge-anim { animation: none; }
  .radar-ping { animation: none; opacity: 0; }
  .msg-flow-right { animation: none; }
  .msg-flow-left { animation: none; }
  .draw-line { animation: none; stroke-dashoffset: 0; }
  .relation-pulse { animation: none; }
  .bar-grow { animation: none; transform: scaleY(1); }
  .theme-showcase-mesh, .theme-showcase-aurora, .theme-showcase-glow { animation: none !important; }
}

${HERO_STACK_MEDIA} {
  .hero-row { flex-direction: column !important; align-items: flex-start !important; padding: 64px 24px 72px 24px !important; gap: 40px !important; }
  .hero-copy { flex: 1 1 auto !important; max-width: 100% !important; }
  .hero-copy p { max-width: 100% !important; }
  .hero-visual { flex: 1 1 auto !important; width: 100% !important; max-width: 560px; }
}

${MEDIA.tablet} {
  .why-fork-grid { grid-template-columns: 1fr !important; }
  .pillar-grid { grid-template-columns: 1fr !important; }
  .cli-mcp-row { flex-direction: column !important; }
  .gallery-grid { grid-template-columns: repeat(3, 1fr) !important; }
  .proof-grid { grid-template-columns: 1fr !important; }
  .theme-showcase-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
}

${MEDIA.mobile} {
  .hero-row { padding: 48px 20px 56px 20px !important; }
  .hero-h1 { font-size: ${FONT_SIZE.h1Mobile}px !important; }
  .gallery-grid { grid-template-columns: repeat(2, 1fr) !important; }
  .stat-row { flex-wrap: wrap !important; gap: 16px !important; }
  .fixes-teaser-card { flex-direction: column !important; align-items: flex-start !important; }
  .blog-teaser-card { flex-direction: column !important; align-items: flex-start !important; }
  .blog-teaser-inner { flex-direction: column !important; align-items: flex-start !important; gap: 14px !important; }
  .theme-showcase-mesh { width: 1100px !important; height: 900px !important; margin: -450px 0 0 -550px !important; }
}`
}

/* -----------------------------------------------------------------
 * Theme showcase
 * ----------------------------------------------------------------- */

/**
 * The six diagram types this library renders, one real Mermaid source each,
 * for the showcase to cycle through. `flowchart` reuses {@link
 * THEME_SHOWCASE_SOURCE} (matching the hero's own mock — see that
 * constant's doc comment); the other five reuse the exact, already-vetted
 * source each type's own SEO landing page renders
 * (`demo/diagram-pages-data.ts`'s `DIAGRAM_TYPE_PROFILES`), rather than
 * hand-typing new Mermaid a second time for this page alone.
 */
const SHOWCASE_TYPE_SLUGS = [
  'flowchart',
  'sequence',
  'class',
  'state',
  'er',
  'xy-chart',
] as const

function showcaseSource(slug: (typeof SHOWCASE_TYPE_SLUGS)[number]): string {
  if (slug === 'flowchart') return THEME_SHOWCASE_SOURCE
  const profile = DIAGRAM_TYPE_PROFILES.find((p) => p.slug === slug)
  if (!profile) {
    throw new Error(
      `demo/components/index-page.tsx: no DIAGRAM_TYPE_PROFILES entry for slug "${slug}"`,
    )
  }
  return profile.source
}

/**
 * The showcase's six build-time diagrams, one per {@link
 * SHOWCASE_TYPE_SLUGS} entry, all rendered in
 * {@link THEME_SHOWCASE_DEFAULT_THEME}'s colours — the client script cycles
 * both which diagram is visible and which theme is applied from there (see
 * this file's header comment and `demo/index-page-client.ts`). Thrown, not
 * a silent fallback: this only ever runs at `index.ts` generation time
 * under Node, so a typo'd theme key or slug should fail the build loudly
 * rather than ship a broken page.
 */
function renderShowcaseDiagrams(): { slug: string; html: string }[] {
  const theme = THEMES[THEME_SHOWCASE_DEFAULT_THEME]
  if (!theme) {
    throw new Error(`Unknown theme key: ${THEME_SHOWCASE_DEFAULT_THEME}`)
  }
  return SHOWCASE_TYPE_SLUGS.map((slug) => ({
    slug,
    html: renderMermaidSVG(showcaseSource(slug), {
      ...theme,
      title: `A ${slug} diagram, rendered live in the current theme`,
      interactivity: 'none',
    }),
  }))
}

/**
 * Six real diagrams — one per diagram type this library renders — auto-
 * cycling live through every real theme in `THEMES`. Replaces the
 * section's former interactive picker (#759) with a purely informational,
 * non-interactive proof: nothing on the page controls it, so it never
 * competes with the rest of the page for a visitor's clicks. (A header-
 * based theme switcher may take over this section's old picker role
 * site-wide later; that's separate, not-yet-scheduled work, not something
 * this section grows back on its own.)
 *
 * `demo/index-page-client.ts`'s `startShowcaseCycle()` does the actual
 * cycling, as a strict, staged sequence rather than one simultaneous
 * change: fade the visible diagram out, re-theme the next one via CSS
 * custom properties (`svg.style.setProperty('--bg', …)`, … — the same
 * "swap variables, no re-render" technique `demo/diagram-page-client.ts`'s
 * `applyThemeToDiagram` already uses elsewhere) and animate the card's
 * background to match while nothing diagram-shaped is on screen, then
 * fade the (already re-themed) diagram back in — see
 * `.theme-showcase-diagram-slot`'s own CSS comment for why. It also keeps
 * the `--bg`/`--fg`/`--accent` code panel and the `N / <count>` counter in
 * sync. `prefers-reduced-motion: reduce` stops the cycle before it starts —
 * the build-time render below (flowchart, in
 * {@link THEME_SHOWCASE_DEFAULT_THEME}'s colours) is a complete, correctly
 * themed diagram on its own, so that's a real fallback state, not a broken
 * one.
 *
 * `id="theme-showcase"` stays even though nothing observes it via
 * `IntersectionObserver` anymore (that relocation was the removed picker's
 * job) — kept as a stable in-page anchor, cheap to keep.
 */
function ThemeShowcase() {
  const diagrams = renderShowcaseDiagrams()
  const theme = THEMES[THEME_SHOWCASE_DEFAULT_THEME]
  if (!theme) {
    throw new Error(`Unknown theme key: ${THEME_SHOWCASE_DEFAULT_THEME}`)
  }
  const accent = theme.accent
  if (!accent) {
    throw new Error(
      `THEME_SHOWCASE_DEFAULT_THEME (${THEME_SHOWCASE_DEFAULT_THEME}) has no accent`,
    )
  }
  const themeCount = Object.keys(THEMES).length

  return (
    <div
      id="theme-showcase"
      className="section-px theme-showcase"
      style={{
        position: 'relative',
        padding: '100px 80px',
        borderTop: `1px solid ${colorVar('--border')}`,
        borderBottom: `1px solid ${colorVar('--border')}`,
        overflow: 'hidden',
      }}
    >
      <div className="theme-showcase-bg" aria-hidden="true">
        <div className="theme-showcase-mesh" />
        <div className="theme-showcase-aurora">
          <div className="theme-showcase-glow g1" />
          <div className="theme-showcase-glow g2" />
          <div className="theme-showcase-glow g3" />
          <div className="theme-showcase-glow g4" />
        </div>
      </div>

      <div
        className="theme-showcase-grid"
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1.05fr',
          gap: `${SPACE['8xl']}px`,
          alignItems: 'start',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE.xl}px`,
          }}
        >
          <SectionEyebrow>Live theme switching</SectionEyebrow>
          <h2
            style={{ fontSize: '38px', letterSpacing: LETTER_SPACING.heading }}
          >
            Pick a theme. Switch it live — no re-render.
          </h2>
          <p
            style={{
              fontSize: `${FONT_SIZE.lead}px`,
              color: colorVar('--text-dim'),
              margin: 0,
            }}
          >
            Every one of the {themeCount} built-in themes is just{' '}
            <code className="mono" style={{ color: colorVar('--text') }}>
              --bg
            </code>
            ,{' '}
            <code className="mono" style={{ color: colorVar('--text') }}>
              --fg
            </code>
            , and{' '}
            <code className="mono" style={{ color: colorVar('--text') }}>
              --accent
            </code>
            . The diagram reads them live — no re-render, ever.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${SPACE.md}px`,
              marginTop: `${SPACE.xs}px`,
            }}
          >
            <span className="theme-showcase-frac">
              <span
                id="theme-showcase-counter"
                className="theme-showcase-frac-cur"
              >
                1
              </span>
              <span className="theme-showcase-frac-slash">/</span>
              <span className="theme-showcase-frac-total">{themeCount}</span>
            </span>
            <span
              style={{
                fontSize: `${FONT_SIZE.caption}px`,
                color: colorVar('--text-faint'),
              }}
            >
              themes, cycling
            </span>
          </div>
        </div>

        <div>
          <div className="theme-showcase-term">
            <div className="theme-showcase-term-bar">
              <span
                className="theme-showcase-term-dot"
                style={{ background: '#ff6767' }}
              />
              <span
                className="theme-showcase-term-dot"
                style={{ background: '#ffc85c' }}
              />
              <span
                className="theme-showcase-term-dot"
                style={{ background: '#5ee08a' }}
              />
            </div>
            <div className="theme-showcase-term-body mono">
              <span
                id="theme-showcase-theme-name"
                className="theme-showcase-comment"
              >
                {'/* ' +
                  (THEME_LABELS[THEME_SHOWCASE_DEFAULT_THEME] ??
                    THEME_SHOWCASE_DEFAULT_THEME) +
                  ' */'}
              </span>
              <br />
              :root {'{'}
              <br />
              &nbsp;&nbsp;
              <span className="theme-showcase-kw">--bg</span>:{' '}
              <span
                id="theme-showcase-bg-swatch"
                className="theme-showcase-swatch"
                style={{ background: theme.bg }}
              />
              <span id="theme-showcase-bg-val">{theme.bg}</span>;
              <br />
              &nbsp;&nbsp;
              <span className="theme-showcase-kw">--fg</span>:{' '}
              <span
                id="theme-showcase-fg-swatch"
                className="theme-showcase-swatch"
                style={{ background: theme.fg }}
              />
              <span id="theme-showcase-fg-val">{theme.fg}</span>;
              <br />
              &nbsp;&nbsp;
              <span className="theme-showcase-kw">--accent</span>:{' '}
              <span
                id="theme-showcase-accent-swatch"
                className="theme-showcase-swatch"
                style={{ background: accent }}
              />
              <span id="theme-showcase-accent-val">{accent}</span>;
              <br />
              {'}'}
            </div>
          </div>

          <div
            id="theme-showcase-diagram-card"
            className="theme-showcase-diagram-card"
            style={{ background: theme.bg }}
          >
            <div id="theme-showcase-diagrams">
              {diagrams.map((d, i) => (
                <div
                  key={d.slug}
                  className={
                    i === 0
                      ? 'theme-showcase-diagram-slot is-active'
                      : 'theme-showcase-diagram-slot'
                  }
                  data-slug={d.slug}
                  // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG output, never user input (see this file's header comment)
                  dangerouslySetInnerHTML={{ __html: d.html }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* -----------------------------------------------------------------
 * Footer links
 * ----------------------------------------------------------------- */

const HOME_FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Diagrams', href: 'diagrams/' },
      { label: 'Editor', href: 'editor.html' },
      { label: 'Fork fixes', href: 'fork-fixes.html' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: 'blog/' },
      { label: 'GitHub', href: FORK_URL },
      { label: 'npm package', href: NPM_URL },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'MIT Licensed' },
      { label: 'dfadler/zombie-mermaid', href: FORK_URL },
    ],
  },
]

/* -----------------------------------------------------------------
 * The document
 * ----------------------------------------------------------------- */

export interface IndexPageProps {
  /** The SoftwareApplication JSON-LD block, indented and script-escaped. */
  jsonLd: string
  /**
   * `href` of the bundled `demo/index-page-client.ts` script (#759,
   * `index.ts`'s `bundleClientScript()`), which wires {@link ThemeShowcase}'s
   * picker, re-themes its diagram and the site chrome on every theme
   * change, and reparents the picker into the nav on scroll. Loaded as an
   * external `<script type="module" src>` (mirroring `demo/components/
   * diagram-page.tsx`'s `clientScriptSrc`) rather than inlined — this page
   * now has meaningfully more client logic than a one-line
   * `initThemeBar()` call. Unchanged by #804: `ThemeShowcase` isn't part
   * of either hydrated app (see this file's header comment), so its own
   * client wiring stays exactly as #759/#772/#783 left it.
   */
  clientScriptSrc: string
  /**
   * The bundled `demo/index-client.tsx` entry (zombie-mermaid#804) that
   * hydrates {@link IndexHeroApp}, {@link IndexMainApp}, and `<NavIsland>`
   * (via `hydrateNav()`) — one bundle for all three, mirroring
   * `dashboard-client.tsx`/`fork-fixes-client.tsx`/`blog-post-
   * client.tsx`'s exact pattern, and replacing the separate `nav-only-
   * client.tsx` bundle (`navClientScript`) this page used before. Defaults
   * to `''` (no hydration script at all — SSR-only), matching every other
   * page's `clientScript` default.
   */
  clientScript?: string
}

/** The whole index.html document: the marketing landing page. */
export function IndexPage({
  jsonLd,
  clientScriptSrc,
  clientScript = '',
}: IndexPageProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Zombie Mermaid — Mermaid Rendering, Made Beautiful</title>
        <meta
          name="description"
          content="Open source diagram rendering library built for the AI era. Ultra-fast, fully themeable, outputs to SVG and ASCII. Supports Flowchart, State, Sequence, Class, ER, and XY Chart diagrams."
        />
        <link rel="canonical" href={SITE_URL} />
        <link rel="icon" type="image/svg+xml" href="favicon.svg" />
        <link rel="icon" type="image/x-icon" href="favicon.ico" />
        <link rel="apple-touch-icon" href="apple-touch-icon.png" />
        <meta property="og:title" content="Zombie Mermaid" />
        <meta
          property="og:description"
          content="Open source diagram rendering library built for the AI era. Ultra-fast, fully themeable, outputs to SVG and ASCII."
        />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Zombie Mermaid" />
        <meta
          name="twitter:description"
          content="Mermaid rendering, made beautiful. Ultra-fast, fully themeable, outputs to SVG and ASCII."
        />
        <meta name="twitter:image" content={OG_IMAGE_URL} />
        <script
          type="application/ld+json"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- JSON-LD built from package.json at build time and escaped with escapeJsonForScriptTag
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
        {/* Plausible Analytics */}
        <script
          defer
          data-domain={PLAUSIBLE_DOMAIN}
          src="https://plausible.io/js/script.js"
        />
        <DesignFontLinks />
        <SharedPageStyles />
        <style>{homePageCss()}</style>
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <NavIsland homeHref={HOME_HREF} hrefs={ROOT_NAV_HREFS} sticky />
        <main id="main">
          {/*
            Plain, inert hydration containers -- see dashboard-app.tsx's
            DASHBOARD_ROOT_ID doc comment for why neither app's own root
            can carry these ids itself, and dashboard-page.tsx's own, more
            detailed version of this comment for why renderToString (not
            renderToStaticMarkup) is needed here. ThemeShowcase sits
            between them, unhydrated as part of either app -- see this
            file's header comment for why.
          */}
          <div
            id={INDEX_HERO_ROOT_ID}
            dangerouslySetInnerHTML={{
              // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this page's own IndexHeroApp component tree rendered via renderToString (see the comment above); never user input
              __html: renderToString(<IndexHeroApp />),
            }}
          />
          <ThemeShowcase />
          <div
            id={INDEX_MAIN_ROOT_ID}
            dangerouslySetInnerHTML={{
              // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this page's own IndexMainApp component tree rendered via renderToString (see the comment above); never user input
              __html: renderToString(<IndexMainApp />),
            }}
          />
        </main>
        <Footer columns={HOME_FOOTER_COLUMNS} />
        <script type="module" src={clientScriptSrc} />
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/index-client.tsx bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: clientScript }}
        />
        <NavMobileMenuScript />
      </body>
    </html>
  )
}
