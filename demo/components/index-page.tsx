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
 * app: it renders static markup (a hand-authored decorative flowchart svg,
 * not a build-time Mermaid render) plus a small separate bundled client
 * script (`demo/index-page-client.ts`, via `index.ts`'s
 * `bundleClientScript()`) that wires up its click-to-pick theme selector —
 * see that section's own doc comment.
 *
 * Layout, copy, and every colour/measurement below come from the design
 * canvas linked in #590's body
 * (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`),
 * specifically its `Main.dc.html` (desktop) / `MainMobile.dc.html` (mobile)
 * artboards — the two are byte-identical, so the responsive behaviour lives
 * entirely in the shared component `*Css()` functions and {@link homePageCss}'s
 * `@media` blocks, not in a second markup path. See `index-app.tsx`'s
 * header comment for its own deliberate deviations from the canvas
 * (unchanged by this split). `ThemeShowcase` itself now follows a *newer*
 * canvas ("1e — Flow + Burst",
 * `https://claude.ai/code/artifact/021183bd-f416-4d93-a21a-9febe1b8c69f`)
 * pixel-for-pixel: a single decorative flowchart, re-themed in place on a
 * manual pick only (no ambient auto-cycle, no six-diagram gallery) — see
 * {@link ThemeShowcase}'s own doc comment. One deliberate coordinate fix
 * on top of that 1:1 copy: the canvas's own "Deploy?" diamond sits flush
 * against the pipeline→Deploy connector and its "pass" label, hiding both
 * behind the diamond's opaque fill — moved 35 units right here (with its
 * text, burst ring, and outgoing yes/no curves shifted to match) to open
 * the same kind of gap the canvas's own "Auth?" diamond already has.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { renderToString } from 'react-dom/server'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { asciiToHtml } from '../../ascii-html.ts'
import { escapeJsonForScriptTag } from '../format.ts'
import { FORK_URL, HOME_HREF, ROOT_NAV_HREFS } from './site-chrome.tsx'
import { NavMobileMenuScript } from './nav.tsx'
import { NavIsland } from './nav-island.tsx'
import { Document } from './document.tsx'
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
import { THEMES } from '@zombie-mermaid/core'
import {
  IndexHeroApp,
  IndexMainApp,
  INDEX_HERO_ROOT_ID,
  INDEX_HERO_PROPS_ELEMENT_ID,
  INDEX_MAIN_ROOT_ID,
  type IndexHeroAppProps,
} from './index-app.tsx'
import { HERO_MERMAID_SOURCE } from './hero-output-panel.tsx'

// Re-exported for existing callers/tests that import these from
// index-page.tsx rather than index-app.tsx directly (this file was the
// sole home for all of them before the #804 split).
export {
  IndexHeroApp,
  IndexMainApp,
  INDEX_HERO_ROOT_ID,
  INDEX_HERO_PROPS_ELEMENT_ID,
  INDEX_MAIN_ROOT_ID,
} from './index-app.tsx'

/**
 * The hero output panel's real ASCII state — `renderMermaidASCII` run
 * against the exact same source {@link HeroCodePanel} (in
 * `hero-output-panel.tsx`) displays, then column-width-corrected the same
 * way `fork-fixes.ts` already does for its own ASCII panels
 * (`asciiToHtml`, trailing-whitespace stripped per line first).
 * `colorMode: 'none'` matches the CLI's own default for a non-TTY target —
 * `'auto'`'s TTY detection behaves differently under Node than a real
 * terminal, which this build-time call is not.
 */
const heroAsciiHtml = asciiToHtml(
  renderMermaidASCII(HERO_MERMAID_SOURCE, { colorMode: 'none' }).replace(
    /[ \t]+$/gm,
    '',
  ),
)

/**
 * {@link ThemeShowcase}'s own hand-kept-in-sync Mermaid source — mirrors
 * the hand-drawn `#theme-showcase-diagram` svg's shapes/labels below
 * (Start → Auth? → a Build/Test pipeline → Deploy?, with a Ship
 * it/Rollback branch and a Monitor tap off the pipeline) node-for-node and
 * label-for-label, the same "third hand-kept copy" tradeoff
 * `HERO_MERMAID_SOURCE`'s own doc comment accepts. Referencing the
 * `Pipeline` subgraph id directly in the surrounding edges (rather than a
 * plain node inside it) is what keeps both `Build` and `Test` rendered
 * inside the pipeline's ASCII box — routing an edge through a member node
 * instead pulls that node out of the subgraph in this renderer's layout.
 */
export const THEME_SHOWCASE_MERMAID_SOURCE = `graph TD
  Start --> Auth{Auth?}
  Auth -->|ok| Pipeline
  subgraph Pipeline
    Build --> Test
  end
  Pipeline -->|pass| Deploy{Deploy?}
  Deploy -->|yes| Ship[Ship it]
  Deploy -->|no| Rollback
  Pipeline --> Monitor
`

/**
 * The theme showcase's real ASCII state — same `renderMermaidASCII()` +
 * `asciiToHtml()` build-time pipeline as {@link heroAsciiHtml}, run against
 * {@link THEME_SHOWCASE_MERMAID_SOURCE} instead. Unlike the hero panel this
 * never re-renders per theme pick — `wireThemePicker()` (`demo/index-page-
 * client.ts`) only ever swaps the `--tsd-*` CSS custom properties this
 * static HTML already reads through the `.theme-showcase-ascii` class
 * (`color: var(--tsd-text)`), so one build-time render covers every theme.
 */
const themeShowcaseAsciiHtml = asciiToHtml(
  renderMermaidASCII(THEME_SHOWCASE_MERMAID_SOURCE, {
    colorMode: 'none',
  }).replace(/[ \t]+$/gm, ''),
)

const NPM_URL = 'https://www.npmjs.com/package/zombie-mermaid'
const SITE_URL = 'https://dfadler.github.io/zombie-mermaid/'
const OG_IMAGE_URL = 'https://dfadler.github.io/zombie-mermaid/og-image.png'
const PLAUSIBLE_DOMAIN = 'dfadler.github.io/zombie-mermaid'

/* -----------------------------------------------------------------
 * Content: real repo data, not invented copy
 * ----------------------------------------------------------------- */

/**
 * {@link ThemeShowcase}'s starting theme, before a visitor picks one from
 * {@link ThemeShowcasePicker}. Real, not the `''` Default pseudo-theme:
 * this showcase's whole point is proving the 15 real themes, and there's no
 * "Default" diagram rendering to fall back to here (unlike
 * `theme-picker.tsx`'s `includeDefault` pages). `dracula` also mirrors
 * `theme-picker.tsx`'s own `INLINE_THEMES`, which already surfaces it as
 * one of the two themes always shown outside that picker's "N Themes"
 * dropdown.
 */
const THEME_SHOWCASE_DEFAULT_THEME = 'dracula'

/**
 * Blends `fgHex` into `bgHex` at `pctFg`% — the design canvas's own inline
 * `mix()` helper (Main.dc.html), transcribed rather than shared:
 * `demo/index-page-client.ts` keeps an identical copy for its own re-theme
 * step, and this file only ever runs at build time under Node, so there's
 * no reasonable shared module for three lines of arithmetic without
 * creating a cross-bundle dependency neither side needs otherwise.
 */
function mixHex(fgHex: string, bgHex: string, pctFg: number): string {
  const f = parseInt(fgHex.slice(1), 16)
  const b = parseInt(bgHex.slice(1), 16)
  const fr = (f >> 16) & 255
  const fg = (f >> 8) & 255
  const fb = f & 255
  const br = (b >> 16) & 255
  const bgc = (b >> 8) & 255
  const bb = b & 255
  const t = pctFg / 100
  const r = Math.round(fr * t + br * (1 - t))
  const g = Math.round(fg * t + bgc * (1 - t))
  const bl = Math.round(fb * t + bb * (1 - t))
  const hex = (v: number) => v.toString(16).padStart(2, '0')
  return '#' + hex(r) + hex(g) + hex(bl)
}

/** The six color roles {@link ThemeShowcase}'s decorative flowchart needs, derived from a theme's `bg`/`fg`/`accent` the same way Main.dc.html's `renderVals()` does. */
interface ShowcaseDiagramColors {
  bg: string
  nodeFill: string
  nodeStroke: string
  text: string
  labelText: string
  muted: string
  arrow: string
}

/**
 * Derives {@link ShowcaseDiagramColors} from a theme, matching the design
 * canvas's `renderVals()` mapping exactly (`nodeFill`/`nodeStroke`/
 * `labelText`/`muted` as fixed mix percentages of `fg` into `bg`; `arrow`
 * as the theme's own `accent`, falling back to the same 85% mix
 * `packages/core/src/theme.ts`'s `MIX.arrow` uses for themes with none —
 * `zinc-light`/`zinc-dark`). Shared by {@link ThemeShowcasePicker}'s swatch
 * dots (just `arrow`) and {@link ThemeShowcase}'s diagram card.
 */
function deriveShowcaseColors(theme: {
  bg: string
  fg: string
  accent?: string
}): ShowcaseDiagramColors {
  return {
    bg: theme.bg,
    nodeFill: mixHex(theme.fg, theme.bg, 6),
    nodeStroke: mixHex(theme.fg, theme.bg, 26),
    text: theme.fg,
    labelText: mixHex(theme.fg, theme.bg, 45),
    muted: mixHex(theme.fg, theme.bg, 34),
    arrow: theme.accent ?? mixHex(theme.fg, theme.bg, 85),
  }
}

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

/* -- Theme showcase: full-bleed animated backdrop behind a single
   decorative flowchart, re-themed in place on a picker click.
   demo/index-page-client.ts's wireThemePicker() drives the actual
   re-theme (JS, not CSS) -- everything here is either the ambient
   background motion or static layout/type/shape. */
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
    color-mix(in srgb, #bd93f9 24%, transparent),
    color-mix(in srgb, ${colorVar('--cyan')} 18%, transparent),
    color-mix(in srgb, ${colorVar('--pink')} 18%, transparent),
    color-mix(in srgb, ${colorVar('--amber')} 16%, transparent),
    color-mix(in srgb, #bd93f9 24%, transparent)
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
/* #bd93f9, not colorVar('--violet') (#a374e8) -- Main.dc.html has no
   --violet token at all; every violet in the canvas (here and the mesh
   gradient above) is this exact literal, matched rather than mapped onto
   this site's own (different) shared violet accent. */
.theme-showcase-glow.g1 { width: 560px; height: 560px; background: #bd93f9; opacity: 0.36; top: -10%; left: 2%; animation: themeShowcaseDrift1 17s ease-in-out infinite alternate; }
.theme-showcase-glow.g2 { width: 520px; height: 520px; background: ${colorVar('--cyan')}; opacity: 0.3; top: 6%; right: 0%; animation: themeShowcaseDrift2 21s ease-in-out infinite alternate; }
.theme-showcase-glow.g3 { width: 480px; height: 480px; background: ${colorVar('--pink')}; opacity: 0.26; bottom: -14%; left: 20%; animation: themeShowcaseDrift3 24s ease-in-out infinite alternate; }
.theme-showcase-glow.g4 { width: 500px; height: 500px; background: ${colorVar('--amber')}; opacity: 0.22; bottom: -6%; right: 12%; animation: themeShowcaseDrift4 19s ease-in-out infinite alternate; }
@keyframes themeShowcaseHue { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }
@keyframes themeShowcaseDrift1 { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(150px,-85px) scale(1.14); } 100% { transform: translate(-85px,65px) scale(0.92); } }
@keyframes themeShowcaseDrift2 { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(-130px,100px) scale(0.88); } 100% { transform: translate(85px,-75px) scale(1.1); } }
@keyframes themeShowcaseDrift3 { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(110px,95px) scale(1.12); } 100% { transform: translate(-130px,-55px) scale(0.9); } }
@keyframes themeShowcaseDrift4 { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(-100px,-85px) scale(1.08); } 100% { transform: translate(120px,55px) scale(0.94); } }

/* Diagram card: every color role a re-theme touches lives as a CSS custom
   property set inline on this element (deriveShowcaseColors() at SSR time,
   demo/index-page-client.ts's wireThemePicker() on a pick) -- descendant
   svg elements below read them via var(), so a re-theme is one
   setProperty() call per role on this single element rather than walking
   the diagram's individual shapes. Matches the design canvas's own
   transition durations/easing exactly (500ms ease). */
.theme-showcase-diagram-card {
  position: relative;
  border-radius: ${RADIUS.card}px;
  padding: clamp(16px, 3vw, 28px);
  margin-top: ${SPACE.xl}px;
  border: 1.5px dashed var(--tsd-node-stroke);
  background: var(--tsd-bg);
  transition: background 500ms ease, border-color 500ms ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* -- theme-showcase-output-body: sizes itself to the svg's own 600x300
   viewBox aspect ratio (2/1) from its own width alone, rather than from
   whichever child (svg or ascii <pre>) happens to be visible -- this is
   what keeps the card the same height in both output modes: the ASCII
   <pre> is capped to this box's height and scrolls internally
   (theme-showcase-ascii below) instead of stretching the card to its own
   much taller natural content height. */
.theme-showcase-output-body {
  width: 100%;
  max-width: 560px;
  aspect-ratio: 2 / 1;
  margin: 0 auto;
  /* A flex item's default min-height is auto (its content's min-content
     size), which -- same trap as HeroInstall's own row min-width comment
     elsewhere in this file -- overrides aspect-ratio's own height the
     moment the ascii <pre>'s real (much taller) content is the one
     driving that min-content size. Without this, the ascii state grows
     the card instead of scrolling inside it. */
  min-height: 0;
}
.theme-showcase-diagram {
  width: 100%;
  height: 100%;
  display: block;
}
/* -- Theme showcase output toggle: an "OUTPUT / SVG / ASCII" segmented
   header mirroring the homepage hero's own HeroOutputPanel toggle
   (hero-output-panel.tsx) -- same .output-segment/.output-segment.active
   classes, but wired by plain DOM (demo/index-page-client.ts's
   initThemeShowcaseOutputToggle()) rather than React state, matching how
   the rest of this section's interactivity (the theme picker dropdown)
   already avoids pulling react-dom/server into the client bundle -- see
   this file's own header comment. */
.theme-showcase-output-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${SPACE.md}px;
  margin-bottom: ${SPACE.lg}px;
}
.theme-showcase-output-label {
  font-size: ${FONT_SIZE.micro}px;
  letter-spacing: ${LETTER_SPACING.eyebrow};
  text-transform: uppercase;
  color: var(--tsd-muted);
}
.theme-showcase-output-segments {
  display: flex;
  gap: 2px;
  background: ${colorVar('--panel')};
  border-radius: ${RADIUS.pill}px;
  padding: 2px;
}
.theme-showcase-ascii {
  display: none;
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  white-space: pre;
  font-variant-ligatures: none;
  font-size: ${FONT_SIZE.bodySm}px;
  line-height: 1.5;
  color: var(--tsd-text);
  transition: color 500ms ease;
}
.theme-showcase-diagram-card[data-output-mode='ascii'] .theme-showcase-diagram { display: none; }
.theme-showcase-diagram-card[data-output-mode='ascii'] .theme-showcase-ascii { display: block; }
.tsd-node {
  fill: var(--tsd-node-fill);
  stroke: var(--tsd-node-stroke);
  stroke-width: 1.5px;
  transition: fill 500ms ease, stroke 500ms ease;
}
.tsd-node-muted {
  fill: var(--tsd-node-fill);
  stroke: var(--tsd-muted);
  stroke-width: 1.5px;
  stroke-dasharray: 4 3;
  transition: fill 500ms ease, stroke 500ms ease;
}
.tsd-node-text { fill: var(--tsd-text); font-weight: 700; transition: fill 500ms ease; }
.tsd-label { fill: var(--tsd-label-text); transition: fill 500ms ease; }
.tsd-pipeline-box {
  fill: none;
  stroke: var(--tsd-muted);
  stroke-width: 1.5px;
  stroke-dasharray: 5 4;
  transition: stroke 500ms ease;
}
.tsd-flow {
  stroke: var(--tsd-arrow);
  stroke-width: 2px;
  fill: none;
  stroke-dasharray: 6 5;
  animation: themeShowcaseDashFlow 900ms linear infinite;
  transition: stroke 500ms ease;
}
@keyframes themeShowcaseDashFlow { to { stroke-dashoffset: -22; } }
.tsd-rollback-path { stroke: var(--tsd-muted); stroke-width: 1.5px; stroke-dasharray: 4 3; fill: none; transition: stroke 500ms ease; }
.tsd-monitor-path { stroke: var(--tsd-label-text); stroke-width: 1.5px; stroke-dasharray: 1.5 4; fill: none; transition: stroke 500ms ease; }
.tsd-monitor-dot { fill: var(--tsd-label-text); transition: fill 500ms ease; }
.tsd-arrow-fill { fill: var(--tsd-arrow); transition: fill 500ms ease; }
.theme-showcase-burst-ring {
  opacity: 0;
  fill: none;
  stroke: var(--tsd-arrow);
  stroke-width: 2px;
  transform-box: fill-box;
  transform-origin: center;
}
.theme-showcase-burst-ring.active { animation: themeShowcaseBurst 650ms ease-out; }
@keyframes themeShowcaseBurst {
  0% { opacity: 0.85; transform: scale(0.35); }
  100% { opacity: 0; transform: scale(2.4); }
}

/* -- Theme showcase picker: a "movie ticket stub" trigger + dropdown
   panel. Interaction (open/close, picking a theme) is wired by
   demo/index-page-client.ts's wireThemePicker() -- see ThemeShowcasePicker's
   own doc comment. */
.theme-showcase-picker { position: relative; }
.theme-showcase-picker-trigger {
  width: 100%;
  max-width: 280px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border: 1.5px dashed ${colorVar('--border')};
  border-radius: 4px;
  cursor: pointer;
  background:
    radial-gradient(circle at 0 50%, ${colorVar('--bg')} 8px, transparent 8.5px),
    radial-gradient(circle at 100% 50%, ${colorVar('--bg')} 8px, transparent 8.5px),
    ${colorVar('--panel')};
  color: ${colorVar('--text')};
  font-size: 14px;
  transition: border-color 160ms ease;
}
.theme-showcase-picker-trigger:hover,
.theme-showcase-picker-trigger:focus-visible {
  border-color: ${colorVar('--cyan')};
  outline: none;
}
.theme-showcase-picker-chip { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
.theme-showcase-picker-trigger #theme-showcase-picker-label { flex: 1; text-align: left; }
.theme-showcase-picker-caret { color: ${colorVar('--text-faint')}; transition: transform 200ms ease; }
.theme-showcase-picker.open .theme-showcase-picker-caret { transform: rotate(180deg); }
.theme-showcase-picker-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 2px);
  z-index: 5;
  max-width: 280px;
  border: 1.5px dashed ${colorVar('--border')};
  border-top: none;
  border-radius: 0 0 4px 4px;
  background: ${colorVar('--panel')};
  max-height: 300px;
  overflow-y: auto;
  transform-origin: top;
  animation: themeShowcasePickerTear 320ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
}
@keyframes themeShowcasePickerTear {
  0% { clip-path: inset(0 0 100% 0); transform: skewY(-1.5deg); }
  60% { clip-path: inset(0 0 0% 0); transform: skewY(0.6deg); }
  100% { clip-path: inset(0 0 0% 0); transform: skewY(0deg); }
}
.theme-showcase-picker-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 10px 20px;
  background: transparent;
  border: none;
  border-top: 1px dashed ${colorVar('--border')};
  cursor: pointer;
  font-size: 13px;
  color: ${colorVar('--text-dim')};
  min-height: 44px;
}
.theme-showcase-picker-option:first-child { border-top: none; }
.theme-showcase-picker-option:hover { background: color-mix(in srgb, ${colorVar('--cyan')} 7%, transparent); color: ${colorVar('--text')}; }
.theme-showcase-picker-option[aria-selected='true'] { color: ${colorVar('--cyan')}; }
.theme-showcase-picker-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }

/* -- Burst ring: a one-off accent-colored flash over the diagram card,
   fired only for a manual picker selection -- see ThemeShowcase's own doc
   comment. Its CSS lives above alongside the rest of the diagram's node
   classes (.theme-showcase-burst-ring): it's an svg <circle> centered on
   the Deploy? diamond, not a separate overlay element. */

.theme-showcase-footnote {
  position: relative;
  z-index: 2;
  max-width: ${LAYOUT.maxWidth}px;
  margin: ${SPACE['3xl']}px auto 0;
  padding-top: ${SPACE.lg}px;
  border-top: 1px solid ${colorVar('--border')};
  font-size: ${FONT_SIZE.caption}px;
  color: ${colorVar('--text-faint')};
}

${MEDIA.reducedMotion} {
  .edge-anim { animation: none; }
  .radar-ping { animation: none; opacity: 0; }
  .msg-flow-right { animation: none; }
  .msg-flow-left { animation: none; }
  .draw-line { animation: none; stroke-dashoffset: 0; }
  .relation-pulse { animation: none; }
  .bar-grow { animation: none; transform: scaleY(1); }
  .theme-showcase-mesh, .theme-showcase-aurora, .theme-showcase-glow { animation: none !important; }
  .theme-showcase-picker-panel { animation: none !important; }
  .tsd-flow { animation: none !important; }
  .theme-showcase-burst-ring.active { animation: none !important; opacity: 0 !important; }
}

.output-segment {
  border: none;
  background: transparent;
  color: ${colorVar('--text-faint')};
  font-family: inherit;
  font-size: ${FONT_SIZE.caption}px;
  font-weight: 700;
  padding: ${SPACE.xxs}px ${SPACE.md}px;
  border-radius: ${RADIUS.pill}px;
  cursor: pointer;
}
.output-segment.active { background: ${colorVar('--panel-2')}; color: ${colorVar('--text')}; }
.output-segment:focus-visible { outline: 2px solid ${colorVar('--cyan')}; outline-offset: -2px; }

${HERO_STACK_MEDIA} {
  .hero-row { flex-direction: column !important; align-items: flex-start !important; padding-top: 64px !important; gap: 40px !important; }
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
  /* align-items: stretch (not the row layout's flex-start) so both panels
     fill the column's full width -- a "width: 100%" override here would
     double-count each panel's own padding/border on top of that 100%,
     since this codebase has no global box-sizing: border-box reset. */
  .hero-visual { flex-direction: column !important; align-items: stretch !important; }
  /* The install pill's full "npm install zombie-mermaid" text (plus the
     manager-switcher prefix and copy glyph) is wider than .hero-copy at
     this breakpoint even after hero-install.tsx's overflow-x: auto
     fallback kicks in -- shrinking the pill's own padding/type here closes
     most of that gap so the copy glyph stays on-screen without scrolling,
     rather than leaving it reachable only via a tiny internal scrollbar. */
  .hero-install-pill { padding: 8px 14px !important; font-size: 13px !important; }
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
 * A "movie ticket stub" theme selector: a trigger button (current theme's
 * swatch + label) that opens a listbox of all {@link THEMES} keys. Static
 * SSR markup only — like the rest of {@link ThemeShowcase}, this section
 * isn't part of either hydrated React app (see this file's header
 * comment), so open/close, keyboard support, and the actual theme pick are
 * all wired imperatively by `demo/index-page-client.ts`'s
 * `wireThemePicker()`. Deliberately its own component rather than
 * `demo/components/theme-picker.tsx`'s `ThemePicker`: that component's
 * pill row is the right shape for a persistent, always-visible control
 * (nav, per-diagram-type pages) but doesn't fit a single hero-style
 * "pick a theme" moment, and reworking its markup to look like a ticket
 * stub would mean forking a shared, multi-page component for one page's
 * visual. Both still end up calling the same underlying re-theme step —
 * see {@link ThemeShowcase}'s own doc comment.
 */
function ThemeShowcasePicker() {
  const themeEntries = Object.entries(THEMES)
  const defaultTheme = THEMES[THEME_SHOWCASE_DEFAULT_THEME]
  if (!defaultTheme) {
    throw new Error(`Unknown theme key: ${THEME_SHOWCASE_DEFAULT_THEME}`)
  }
  const defaultAccent = deriveShowcaseColors(defaultTheme).arrow

  return (
    <div className="theme-showcase-picker" id="theme-showcase-picker">
      <button
        type="button"
        className="theme-showcase-picker-trigger mono"
        id="theme-showcase-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-controls="theme-showcase-picker-panel"
      >
        <span
          className="theme-showcase-picker-chip"
          id="theme-showcase-picker-chip"
          style={{ background: defaultAccent }}
        />
        <span id="theme-showcase-picker-label">
          {THEME_SHOWCASE_DEFAULT_THEME}
        </span>
        <span className="theme-showcase-picker-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      <div
        className="theme-showcase-picker-panel"
        id="theme-showcase-picker-panel"
        role="listbox"
        aria-label="Themes"
        hidden
      >
        {themeEntries.map(([themeKey, colors]) => {
          const accent = deriveShowcaseColors(colors).arrow
          return (
            <button
              type="button"
              key={themeKey}
              className="theme-showcase-picker-option mono"
              role="option"
              data-theme={themeKey}
              aria-selected={themeKey === THEME_SHOWCASE_DEFAULT_THEME}
            >
              <span
                className="theme-showcase-picker-dot"
                style={{ background: accent }}
              />
              {themeKey}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ThemeShowcase() {
  const theme = THEMES[THEME_SHOWCASE_DEFAULT_THEME]
  if (!theme) {
    throw new Error(`Unknown theme key: ${THEME_SHOWCASE_DEFAULT_THEME}`)
  }
  const colors = deriveShowcaseColors(theme)
  const diagramCardStyle: Record<string, string> = {
    '--tsd-bg': colors.bg,
    '--tsd-node-fill': colors.nodeFill,
    '--tsd-node-stroke': colors.nodeStroke,
    '--tsd-text': colors.text,
    '--tsd-label-text': colors.labelText,
    '--tsd-muted': colors.muted,
    '--tsd-arrow': colors.arrow,
  }

  return (
    <div
      id="theme-showcase"
      className="section-px theme-showcase"
      style={{
        position: 'relative',
        padding: '100px 80px',
        borderTop: `1px solid ${colorVar('--border')}`,
        borderBottom: `1px solid ${colorVar('--border')}`,
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
          // Must outrank .theme-showcase-footnote's z-index (2): they're
          // sibling stacking contexts under #theme-showcase, and a later
          // sibling at an *equal* z-index wins the paint order regardless
          // of any z-index set on elements nested inside this one (like
          // the picker panel's own z-index below) -- that's how the
          // footnote used to render on top of the open dropdown.
          zIndex: 3,
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
            Pick a theme. Watch it flow.
          </h2>
          <p
            style={{
              fontSize: `${FONT_SIZE.lead}px`,
              color: colorVar('--text-dim'),
              margin: 0,
            }}
          >
            Fifteen palettes pulled from editors you already trust — Dracula,
            Nord, Solarized, Catppuccin, Tokyo Night, and more — each tuned so
            the diagram stays legible in every one.
          </p>
          <ThemeShowcasePicker />
        </div>

        <div
          id="theme-showcase-diagram-card"
          className="theme-showcase-diagram-card"
          data-output-mode="svg"
          style={diagramCardStyle}
        >
          <div className="theme-showcase-output-toggle">
            <span className="theme-showcase-output-label">Output</span>
            <div className="theme-showcase-output-segments">
              <button
                type="button"
                id="theme-showcase-output-svg"
                className="output-segment active"
                aria-pressed="true"
              >
                SVG
              </button>
              <button
                type="button"
                id="theme-showcase-output-ascii"
                className="output-segment"
                aria-pressed="false"
              >
                ASCII
              </button>
            </div>
          </div>
          <div className="theme-showcase-output-body">
            <svg
              id="theme-showcase-diagram"
              className="theme-showcase-diagram"
              viewBox="0 0 600 300"
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="theme-showcase-arrowhead"
                  markerWidth={7}
                  markerHeight={7}
                  refX={5}
                  refY={3.5}
                  orient="auto"
                >
                  <path className="tsd-arrow-fill" d="M0,0 L7,3.5 L0,7 Z" />
                </marker>
              </defs>

              <rect
                className="tsd-node"
                x={10}
                y={130}
                width={80}
                height={40}
                rx={10}
              />
              <text
                className="tsd-node-text"
                x={50}
                y={154}
                textAnchor="middle"
                fontSize={12}
              >
                Start
              </text>
              <path
                className="tsd-flow"
                d="M90,150 L120,150"
                markerEnd="url(#theme-showcase-arrowhead)"
              />

              <polygon
                className="tsd-node"
                points="160,120 190,150 160,180 130,150"
              />
              <text
                className="tsd-node-text"
                x={160}
                y={154}
                textAnchor="middle"
                fontSize={10.5}
              >
                Auth?
              </text>
              <path
                className="tsd-flow"
                d="M190,150 L225,150"
                markerEnd="url(#theme-showcase-arrowhead)"
              />
              <text className="tsd-label" x={200} y={140} fontSize={9.5}>
                ok
              </text>

              <rect
                className="tsd-pipeline-box"
                x={225}
                y={95}
                width={150}
                height={110}
                rx={10}
              />
              <text
                className="tsd-label"
                x={235}
                y={112}
                fontSize={9}
                letterSpacing="0.08em"
              >
                PIPELINE
              </text>
              <rect
                className="tsd-node"
                x={245}
                y={120}
                width={110}
                height={32}
                rx={7}
              />
              <text
                className="tsd-node-text"
                x={300}
                y={140}
                textAnchor="middle"
                fontSize={11}
              >
                Build
              </text>
              <path
                className="tsd-flow"
                d="M300,152 L300,166"
                markerEnd="url(#theme-showcase-arrowhead)"
              />
              <rect
                className="tsd-node"
                x={245}
                y={168}
                width={110}
                height={32}
                rx={7}
              />
              <text
                className="tsd-node-text"
                x={300}
                y={188}
                textAnchor="middle"
                fontSize={11}
              >
                Test
              </text>

              <path
                className="tsd-flow"
                d="M375,150 L410,150"
                markerEnd="url(#theme-showcase-arrowhead)"
              />
              <text className="tsd-label" x={382} y={142} fontSize={9.5}>
                pass
              </text>

              <polygon
                className="tsd-node"
                points="445,120 480,150 445,180 410,150"
              />
              <text
                className="tsd-node-text"
                x={445}
                y={154}
                textAnchor="middle"
                fontSize={10}
              >
                Deploy?
              </text>
              <circle
                id="theme-showcase-burst"
                className="theme-showcase-burst-ring"
                aria-hidden="true"
                cx={445}
                cy={150}
                r={28}
              />

              <path
                className="tsd-flow"
                d="M476,138 C 486,116 488,98 500,90"
                markerEnd="url(#theme-showcase-arrowhead)"
              />
              <text className="tsd-label" x={452} y={108} fontSize={9.5}>
                yes
              </text>
              <rect
                className="tsd-node"
                x={500}
                y={68}
                width={76}
                height={40}
                rx={9}
              />
              <text
                className="tsd-node-text"
                x={538}
                y={92}
                textAnchor="middle"
                fontSize={11}
              >
                Ship it
              </text>

              <path
                className="tsd-rollback-path"
                d="M476,162 C 486,184 488,202 500,210"
                markerEnd="url(#theme-showcase-arrowhead)"
              />
              <text className="tsd-label" x={452} y={200} fontSize={9.5}>
                no
              </text>
              <rect
                className="tsd-node-muted"
                x={496}
                y={192}
                width={84}
                height={40}
                rx={9}
              />
              <text
                className="tsd-node-text"
                x={538}
                y={216}
                textAnchor="middle"
                fontSize={10}
              >
                Rollback
              </text>

              <path className="tsd-monitor-path" d="M300,200 L300,250" />
              <circle className="tsd-monitor-dot" cx={300} cy={250} r={3} />
              <rect
                className="tsd-node"
                x={255}
                y={252}
                width={90}
                height={32}
                rx={7}
              />
              <text
                className="tsd-node-text"
                x={300}
                y={272}
                textAnchor="middle"
                fontSize={10.5}
              >
                Monitor
              </text>
            </svg>
            <pre
              id="theme-showcase-ascii"
              className="theme-showcase-ascii mono"
              // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidASCII() + asciiToHtml() output from this file's own THEME_SHOWCASE_MERMAID_SOURCE; never user input
              dangerouslySetInnerHTML={{ __html: themeShowcaseAsciiHtml }}
            />
          </div>
        </div>
      </div>

      <div className="theme-showcase-footnote">
        Want to add your own? Every theme here is just three color roles —{' '}
        <a
          href={`${FORK_URL}/blob/main/docs/theming.md`}
          target="_blank"
          rel="noopener"
        >
          see how easy one is to write →
        </a>
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
    <Document
      title="Zombie Mermaid — Mermaid Rendering, Made Beautiful"
      description="Open source diagram rendering library built for the AI era. Ultra-fast, fully themeable, outputs to SVG and ASCII. Supports Flowchart, State, Sequence, Class, ER, and XY Chart diagrams."
      head={
        <>
          {/*
            Document's favicon `<link>` (the primary SVG one, right after
            the description meta tag above) replaces this file's own —
            this reorders it ahead of the canonical link and the
            favicon.ico/apple-touch-icon fallbacks below, where it used to
            sit last among the three. A `<head>`-internal reordering with
            no rendering/SEO effect, not a behavior change (see
            document.tsx's own doc comment).
          */}
          <link rel="canonical" href={SITE_URL} />
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
        </>
      }
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <NavIsland
        homeHref={HOME_HREF}
        hrefs={ROOT_NAV_HREFS}
        sticky
        // The site header never shows the npm-install pill on any page --
        // nav.tsx's own NavInstall stays the *default* (used directly,
        // with no NavIsland involved at all, e.g. this repo's own unit
        // tests) -- see diagram-page.tsx/editor-page.tsx/fork-fixes-
        // page.tsx/blog-page.tsx's matching installSlotKind="empty" for
        // the rest of the site. Originally scoped to this page alone
        // (zombie-mermaid#902, to avoid duplicating the hero's own
        // install pill); made universal after the redesign shipped it
        // inconsistently everywhere else too. nav.tsx's own nav-links
        // marginLeft handles the "flush right" layout this used to need
        // a page-specific CSS class for.
        installSlotKind="empty"
      />
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
            __html: renderToString(<IndexHeroApp asciiHtml={heroAsciiHtml} />),
          }}
        />
        <script
          type="application/json"
          id={INDEX_HERO_PROPS_ELEMENT_ID}
          dangerouslySetInnerHTML={{
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from this page's own IndexHeroAppProps, escaped with escapeJsonForScriptTag; never user input
            __html: escapeJsonForScriptTag(
              JSON.stringify({
                asciiHtml: heroAsciiHtml,
              } satisfies IndexHeroAppProps),
            ),
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
    </Document>
  )
}
