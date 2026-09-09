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
 * visitor to those, not the page that replaces them. Nothing here bundles
 * `src/browser.ts` or `demo/client.ts`, or calls shiki — the page is static
 * markup with CSS animations, matching the design canvas, plus a small
 * bundled client script (`demo/index-page-client.ts`, via `index.ts`'s
 * `bundleClientScript()`) that auto-cycles {@link ThemeShowcase}'s six real
 * diagrams through all of `THEMES`, live, with no interactive control on
 * the page itself — see that section's own doc comment for why.
 *
 * Layout, copy, and every colour/measurement below come from the design
 * canvas linked in #590's body
 * (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`),
 * specifically its `Main.dc.html` (desktop) / `MainMobile.dc.html` (mobile)
 * artboards — the two are byte-identical, so the responsive behaviour lives
 * entirely in the shared component `*Css()` functions and {@link homePageCss}'s
 * `@media` blocks, not in a second markup path. Deliberate deviations from
 * the canvas, all made to keep the page honest rather than decorative:
 *
 * - The theme showcase renders six *real* diagrams (one per diagram type
 *   this library supports), auto-cycling live across every real theme in
 *   `THEMES`, not the canvas's five static per-theme cards with invented
 *   theme names ("Neon", "Pastel", …) or a single flowchart. See
 *   {@link ThemeShowcase}'s own doc comment.
 * - The proof/maintenance numbers are the real snapshot from
 *   `demo/dashboard-data.json` (0 days / 334 merged / 1 open vs. upstream's
 *   124 days / 13 merged / 37 open, as of its own `generatedAt`), not the
 *   canvas's placeholder 0/178/5 vs. 117/13/37 — see {@link PROOF_SNAPSHOT}.
 * - The blog teaser is the real current newest post
 *   (`blog-posts/294-prs-14-days.md`), not the canvas's invented post — see
 *   {@link LATEST_POST}.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { ReactNode } from 'react'
import { FORK_URL } from './site-chrome.tsx'
import { NavMobileMenuScript } from './nav.tsx'
import { NavIsland } from './nav-island.tsx'
import { Footer, type FooterColumn } from './footer.tsx'
import {
  CheckIcon,
  ChecklistIcon,
  ICONS,
  LockIcon,
  LogoMark,
  TerminalIcon,
  FEATURE_ICONS,
} from './icons.tsx'
import { Card, CTA, Pill, SectionEyebrow } from './primitives.tsx'
import { SharedPageStyles } from './shared-page-css.tsx'
import {
  DesignFontLinks,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  LETTER_SPACING,
  MEDIA,
  RADIUS,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'
import { renderMermaidSVG } from '../../src/index.ts'
import { THEMES } from '@zombie-mermaid/core'
import { DIAGRAM_TYPE_PROFILES } from '../diagram-pages-data.ts'

const NPM_URL = 'https://www.npmjs.com/package/zombie-mermaid'
const NPM_INSTALL_COMMAND = 'npm install zombie-mermaid'
const SITE_URL = 'https://dfadler.github.io/zombie-mermaid/'
const OG_IMAGE_URL = 'https://dfadler.github.io/zombie-mermaid/og-image.png'
const PLAUSIBLE_DOMAIN = 'dfadler.github.io/zombie-mermaid'

/* -----------------------------------------------------------------
 * Content: real repo data, not invented copy
 * ----------------------------------------------------------------- */

/**
 * The Mermaid source {@link ThemeShowcase} renders live, matching what
 * {@link HeroVisual}'s hand-drawn mock already depicts ("Start → Deploy? →
 * Ship it / Iterate") so the showcase diagram tells the same story the hero
 * does, one section down — rather than an unrelated invented example.
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

/** The six diagram types the gallery teaser links to, and their `/diagrams/` routes. */
const GALLERY_TYPES = [
  { slug: 'flowchart', label: 'Flowchart' },
  { slug: 'state', label: 'State' },
  { slug: 'sequence', label: 'Sequence' },
  { slug: 'class', label: 'Class' },
  { slug: 'er', label: 'ER' },
  { slug: 'xy-chart', label: 'XY Chart' },
] as const

/**
 * Feature-grid copy, paired with {@link FEATURE_ICONS}'s six entries by
 * index. Paraphrases the README's own "Features" bullets (dual output, 15
 * built-in themes, full Shiki compatibility, mono mode, zero DOM
 * dependencies, synchronous rendering) rather than inventing marketing copy.
 */
const FEATURE_COPY = [
  'SVG for rich UIs, ASCII/Unicode for terminals — mermaid.js itself has no real terminal story.',
  'Live theme switching via CSS custom properties — no re-render needed, ever.',
  'Reuse the same VS Code themes your editor already renders code with.',
  'Full diagrams rendered from just two colors, when that’s all you’ve got.',
  'Pure TypeScript. Works in the browser, on the server, or anywhere else.',
  'No async, no flash of unstyled diagram — drops straight into React’s useMemo().',
] as const

/**
 * The real fork-vs-upstream snapshot from `demo/dashboard-data.json`
 * (`generatedAt: "2026-09-07T19:17:01.680Z"`), computed the same way
 * `demo/dashboard-model.ts` computes "days since last commit": whole days
 * from a repo's `lastPushedAt` to the snapshot's own `generatedAt`. See the
 * Dashboard page (`dashboard.html`) for the live, refreshed numbers — this
 * snapshot is deliberately captioned as a snapshot, not live data.
 */
const PROOF_SNAPSHOT = {
  asOf: 'Sep 7, 2026',
  fork: { daysSinceCommit: 0, mergedPRs: 334, openPRs: 1 },
  upstream: { daysSinceCommit: 124, mergedPRs: 13, openPRs: 37 },
  rescuedFixCount: 27,
} as const

/**
 * The real current newest post (`blog-posts/294-prs-14-days.md`), picked by
 * the same rule `blog.ts`'s `loadPosts()` uses (newest `date`, ties broken
 * by directory read order) rather than invented.
 */
const LATEST_POST = {
  slug: '294-prs-14-days',
  title:
    '294 PRs, 14 Days — What Agent-Driven OSS Maintenance Actually Looks Like',
  displayDate: 'Sep 6, 2026',
  description:
    'The real daily merge-count histogram behind two weeks of reviving a dead fork — not the rounder number the tracking issue guessed — and what it does and doesn’t tell you about agent-driven maintenance.',
} as const

/* -----------------------------------------------------------------
 * Page-specific CSS: the responsive rules and animations the canvas
 * defines that aren't already covered by tokens.tsx / primitives.tsx /
 * nav.tsx / footer.tsx's own `*Css()` functions.
 * ----------------------------------------------------------------- */

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
/* height fits its fixed 5-line content (":root {", 3 var lines, "}") at
   this font-size/line-height, plus a few px of slack for cross-browser
   line-box rounding -- content never gains or loses a line, only the
   swapped-in hex values' text changes width, so this never needs to grow. */
.theme-showcase-term-body { font-size: 13px; line-height: 1.95; padding: 16px 18px; color: ${colorVar('--text-dim')}; height: 132px; }
.theme-showcase-kw { color: ${colorVar('--blue')}; }
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
  align-items: center;
  justify-content: center;
  transition: background 900ms ease;
  overflow: hidden;
}
.theme-showcase-diagram-slot { width: 100%; justify-content: center; }
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

${MEDIA.tablet} {
  .hero-row { flex-direction: column !important; align-items: flex-start !important; padding: 64px 24px 72px 24px !important; gap: 40px !important; }
  .hero-copy { flex: 1 1 auto !important; max-width: 100% !important; }
  .hero-copy p { max-width: 100% !important; }
  .hero-visual { flex: 1 1 auto !important; width: 100% !important; max-width: 560px; }
  .feature-connectors { display: none !important; }
  .feature-grid-wrap { height: auto !important; }
  .feature-grid { grid-template-columns: 1fr 1fr !important; grid-template-rows: none !important; }
  .cli-mcp-row { flex-direction: column !important; }
  .gallery-grid { grid-template-columns: repeat(3, 1fr) !important; }
  .proof-grid { grid-template-columns: 1fr !important; }
  .theme-showcase-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
}

${MEDIA.mobile} {
  .hero-row { padding: 48px 20px 56px 20px !important; }
  .hero-h1 { font-size: ${FONT_SIZE.h1Mobile}px !important; }
  .feature-grid { grid-template-columns: 1fr !important; }
  .gallery-grid { grid-template-columns: repeat(2, 1fr) !important; }
  .stat-row { flex-wrap: wrap !important; gap: 16px !important; }
  .fixes-teaser-card { flex-direction: column !important; align-items: flex-start !important; }
  .blog-teaser-card { flex-direction: column !important; align-items: flex-start !important; }
  .blog-teaser-inner { flex-direction: column !important; align-items: flex-start !important; gap: 14px !important; }
  .theme-showcase-mesh { width: 1100px !important; height: 900px !important; margin: -450px 0 0 -550px !important; }
}`
}

/* -----------------------------------------------------------------
 * Hero
 * ----------------------------------------------------------------- */

/** The hero's hand-drawn terminal→diagram transform illustration. */
function HeroVisual() {
  return (
    <svg
      viewBox="0 0 700 460"
      width="100%"
      height="auto"
      style={{ display: 'block' }}
    >
      <rect
        x="20"
        y="50"
        width="260"
        height="320"
        rx="16"
        fill={colorVar('--panel')}
        stroke={colorVar('--border')}
        strokeWidth="1.5"
      />
      <circle cx="42" cy="72" r="5" fill="#ff6767" />
      <circle cx="60" cy="72" r="5" fill="#ffc85c" />
      <circle cx="78" cy="72" r="5" fill="#5ee08a" />
      <text
        x="36"
        y="110"
        className="mono"
        fontSize="13"
        fill={colorVar('--text-faint')}
      >
        graph TD
      </text>
      <text
        x="36"
        y="136"
        className="mono"
        fontSize="13"
        fill={colorVar('--text-dim')}
      >
        {'  Start --> '}
        <tspan fill={colorVar('--violet')}>Deploy</tspan>
        {'{Deploy?}'}
      </text>
      <text
        x="36"
        y="162"
        className="mono"
        fontSize="13"
        fill={colorVar('--text-dim')}
      >
        {'  Deploy -->|'}
        <tspan fill={colorVar('--green')}>yes</tspan>
        {'| '}
        <tspan fill={colorVar('--amber')}>Ship</tspan>
        {'[Ship it]'}
      </text>
      <text
        x="36"
        y="188"
        className="mono"
        fontSize="13"
        fill={colorVar('--text-dim')}
      >
        {'  Deploy -->|'}
        <tspan fill={colorVar('--pink')}>no</tspan>
        {'| '}
        <tspan fill={colorVar('--amber')}>Iterate</tspan>
        {'[Iterate]'}
      </text>

      <path
        d="M300 210 L392 210"
        stroke={colorVar('--cyan')}
        strokeWidth="2.5"
        fill="none"
        className="edge-anim"
        markerEnd="url(#arrowCyan)"
      />

      <rect
        x="430"
        y="50"
        width="140"
        height="50"
        rx="25"
        fill={colorVar('--blue')}
      />
      <text
        x="500"
        y="80"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#081018"
      >
        Start
      </text>

      <path
        d="M500 100 L500 140"
        stroke={colorVar('--cyan')}
        strokeWidth="2.5"
        fill="none"
        className="edge-anim"
        markerEnd="url(#arrowCyan)"
      />

      <polygon
        points="500,140 565,175 500,210 435,175"
        fill={colorVar('--violet')}
      />
      <text
        x="500"
        y="180"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill={colorVar('--bg')}
      >
        Deploy?
      </text>

      <path
        d="M435 175 C 390 225 410 265 442 298"
        stroke={colorVar('--green')}
        strokeWidth="2.5"
        fill="none"
        className="edge-anim"
        markerEnd="url(#arrowGreen)"
      />
      <text
        x="378"
        y="240"
        fontSize="12"
        fill={colorVar('--green')}
        className="mono"
      >
        yes
      </text>

      <path
        d="M565 175 C 610 225 592 265 606 298"
        stroke={colorVar('--pink')}
        strokeWidth="2.5"
        fill="none"
        className="edge-anim"
        markerEnd="url(#arrowPink)"
      />
      <text
        x="600"
        y="240"
        fontSize="12"
        fill={colorVar('--pink')}
        className="mono"
      >
        no
      </text>

      <rect
        x="382"
        y="300"
        width="130"
        height="50"
        rx="12"
        fill={colorVar('--green')}
      />
      <text
        x="447"
        y="330"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#081018"
      >
        Ship it
      </text>

      <rect
        x="546"
        y="300"
        width="130"
        height="50"
        rx="12"
        fill={colorVar('--pink')}
      />
      <text
        x="611"
        y="330"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#2a0a18"
      >
        Iterate
      </text>

      <defs>
        <marker
          id="arrowCyan"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill={colorVar('--cyan')} />
        </marker>
        <marker
          id="arrowGreen"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill={colorVar('--green')} />
        </marker>
        <marker
          id="arrowPink"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill={colorVar('--pink')} />
        </marker>
      </defs>
    </svg>
  )
}

/** Headline, subhead, the animated terminal→diagram visual, and the CTAs. */
function Hero() {
  return (
    <div
      className="hero-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: `${SPACE['7xl']}px`,
        padding: `${SECTION_SPACE.loose}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px`,
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div
        className="hero-copy"
        style={{
          flex: '0 1 500px',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE['3xl']}px`,
        }}
      >
        <SectionEyebrow>
          An actively maintained fork of beautiful-mermaid
        </SectionEyebrow>
        <h1
          className="hero-h1"
          style={{
            fontSize: '56px',
            lineHeight: 1.08,
            letterSpacing: LETTER_SPACING.display,
          }}
        >
          Your diagrams deserve more than one gray theme.
        </h1>
        <p
          style={{
            fontSize: '19px',
            lineHeight: 1.6,
            color: colorVar('--text-dim'),
            maxWidth: '480px',
          }}
        >
          zombie-mermaid renders Mermaid syntax into beautiful SVG or ASCII art
          — with 15 live-switchable themes, animated edges, and zero re-renders,
          right where AI-assisted coding happens.
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: `${SPACE['2xl']}px`,
            marginTop: `${SPACE.md}px`,
          }}
        >
          <Pill
            mono
            style={{
              background: colorVar('--panel'),
              border: `1px solid ${colorVar('--border')}`,
              color: colorVar('--text'),
            }}
          >
            <CheckIcon size={14} color="var(--green)" strokeWidth={2.4} />
            <span>{NPM_INSTALL_COMMAND}</span>
          </Pill>
          <CTA href="editor.html" accent="violet">
            View the live demo
          </CTA>
        </div>
      </div>

      <div
        className="hero-visual"
        style={{ flex: '0 1 700px', minWidth: 0, maxWidth: '100%' }}
      >
        <HeroVisual />
      </div>
    </div>
  )
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
 * cycling: every ~2.8s it swaps which of the six pre-rendered `<svg>`s
 * (`#theme-showcase-diagrams [data-slug]`) is visible and re-themes all six
 * in place via CSS custom properties (`svg.style.setProperty('--bg', …)`,
 * …) — the exact "swap variables, no re-render" technique
 * `demo/diagram-page-client.ts`'s `applyThemeToDiagram` already uses
 * elsewhere, just applied to six SVGs instead of one. It also keeps the
 * `--bg`/`--fg`/`--accent` code panel and the `N / <count>` counter in
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
                  className="theme-showcase-diagram-slot"
                  data-slug={d.slug}
                  style={{ display: i === 0 ? 'flex' : 'none' }}
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
 * Feature grid
 * ----------------------------------------------------------------- */

/** Six real features, six connectors — the canvas's node-graph feature grid. */
function FeatureGrid() {
  return (
    <div
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.loose}px ${LAYOUT.gutter.desktop}px`,
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto 72px auto',
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <SectionEyebrow>Built for how diagrams get used now</SectionEyebrow>
        <h2 style={{ fontSize: '38px', letterSpacing: LETTER_SPACING.heading }}>
          Six nodes, one rendering engine.
        </h2>
      </div>

      <div
        className="feature-grid-wrap"
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          position: 'relative',
          height: '464px',
        }}
      >
        <svg
          className="feature-connectors"
          viewBox="0 0 1280 464"
          width="1280"
          height="464"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 0,
            maxWidth: '100%',
          }}
        >
          <path
            d="M197 100 L639 100"
            stroke={colorVar('--blue')}
            strokeWidth="2.5"
            className="edge-anim"
            fill="none"
          />
          <path
            d="M639 100 L1081 100"
            stroke={colorVar('--violet')}
            strokeWidth="2.5"
            className="edge-anim"
            fill="none"
          />
          <path
            d="M1081 100 L1081 364"
            stroke={colorVar('--cyan')}
            strokeWidth="2.5"
            className="edge-anim"
            fill="none"
          />
          <path
            d="M1081 364 L639 364"
            stroke={colorVar('--pink')}
            strokeWidth="2.5"
            className="edge-anim"
            fill="none"
          />
          <path
            d="M639 364 L197 364"
            stroke={colorVar('--amber')}
            strokeWidth="2.5"
            className="edge-anim"
            fill="none"
          />
        </svg>

        <div
          className="feature-grid"
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gridTemplateRows: '200px 200px',
            gap: '64px 48px',
          }}
        >
          {FEATURE_ICONS.map((feature, i) => {
            const FeatureIcon = ICONS[feature.name]
            return (
              <Card
                key={feature.name}
                padding={28}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: `${SPACE.lg}px`,
                }}
              >
                <FeatureIcon size={28} />
                <h3 style={{ fontSize: '18px' }}>{feature.label}</h3>
                <p
                  style={{
                    fontSize: `${FONT_SIZE.body}px`,
                    color: colorVar('--text-dim'),
                    lineHeight: 1.5,
                  }}
                >
                  {FEATURE_COPY[i]}
                </p>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* -----------------------------------------------------------------
 * CLI + MCP
 * ----------------------------------------------------------------- */

/** One line of the CLI transcript. */
function TermLine({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

/** The CLI panel: a real transcript using this repo's actual flags. */
function CliPanel() {
  return (
    <div
      style={{
        flex: '1 1 0',
        display: 'flex',
        flexDirection: 'column',
        gap: `${SPACE.xl}px`,
      }}
    >
      <div
        className="code-panel-cli"
        style={{
          background: colorVar('--bg'),
          border: `1px solid ${colorVar('--border')}`,
          borderRadius: '14px',
          padding: '22px 26px 26px 26px',
          flex: '1 1 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${SPACE.xs}px`,
            marginBottom: `${SPACE.xl}px`,
          }}
        >
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#ff6767',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#ffc85c',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#5ee08a',
              display: 'inline-block',
            }}
          />
          <span
            className="mono"
            style={{
              fontSize: `${FONT_SIZE.caption}px`,
              color: colorVar('--text-faint'),
              marginLeft: `${SPACE.xs}px`,
            }}
          >
            terminal
          </span>
        </div>
        <div className="mono" style={{ fontSize: '13.5px', lineHeight: 1.9 }}>
          <TermLine>
            <span style={{ color: colorVar('--text-faint') }}>$</span>{' '}
            <span style={{ color: colorVar('--text') }}>
              zombie-mermaid render
            </span>{' '}
            <span style={{ color: colorVar('--amber') }}>diagram.mmd</span>{' '}
            <span style={{ color: colorVar('--violet') }}>--theme</span>{' '}
            <span style={{ color: colorVar('--amber') }}>dracula</span>
          </TermLine>
          <div style={{ color: colorVar('--green') }}>✓ wrote diagram.svg</div>
          <div style={{ marginTop: `${SPACE.sm}px` }}>
            <span style={{ color: colorVar('--text-faint') }}>$</span>{' '}
            <span style={{ color: colorVar('--text') }}>
              zombie-mermaid render
            </span>{' '}
            <span style={{ color: colorVar('--amber') }}>diagram.mmd</span>{' '}
            <span style={{ color: colorVar('--violet') }}>--ascii</span>
          </div>
          <div style={{ color: colorVar('--text-dim') }}>┌─────────┐</div>
          <div style={{ color: colorVar('--text-dim') }}>{'│  Start   │'}</div>
          <div style={{ color: colorVar('--text-dim') }}>└────┬────┘</div>
          <div style={{ color: colorVar('--cyan') }}>{'     │'}</div>
          <div style={{ marginTop: `${SPACE.sm}px` }}>
            <span style={{ color: colorVar('--text-faint') }}>$</span>{' '}
            <span style={{ color: colorVar('--text') }}>
              zombie-mermaid mcp
            </span>
          </div>
          <div style={{ color: colorVar('--green') }}>
            ✓ MCP server listening on stdio
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xxs}px`,
        }}
      >
        <h3 style={{ fontSize: '19px' }}>CLI</h3>
        <p
          style={{
            fontSize: `${FONT_SIZE.body}px`,
            color: colorVar('--text-dim'),
            lineHeight: 1.55,
          }}
        >
          Render SVG, ASCII, HTML, or PNG straight from a script or CI job —
          themes, direction overrides, and terminal hyperlinks all pass through
          as flags. <a href={`${FORK_URL}#cli`}>Full flag reference →</a>
        </p>
      </div>
    </div>
  )
}

/** One row of the MCP transcript: an avatar circle beside a message bubble. */
function McpRow({
  avatar,
  bubbleBorder,
  children,
}: {
  avatar: ReactNode
  bubbleBorder: string
  children: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: `${SPACE.md}px`,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          background: colorVar('--panel-2'),
          border: `1px solid ${colorVar('--border')}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {avatar}
      </div>
      <div
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          background: colorVar('--panel-2'),
          border: `1px solid ${bubbleBorder}`,
          borderRadius: '12px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xs}px`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** The MCP panel: an agent tool-call illustration, marked experimental per the README. */
function McpPanel() {
  return (
    <div
      style={{
        flex: '1 1 0',
        display: 'flex',
        flexDirection: 'column',
        gap: `${SPACE.xl}px`,
      }}
    >
      <Card
        accent="violet"
        padding={24}
        style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: `${SPACE.md}px`,
          }}
        >
          <Pill
            mono
            fontSize={12.5}
            style={{
              background: colorVar('--panel-2'),
              border: `1px solid ${colorVar('--border')}`,
              color: colorVar('--text-dim'),
              padding: '6px 14px',
            }}
          >
            <LockIcon size={12} strokeWidth={2.2} />
            MCP server
          </Pill>
          <Pill
            accent="amber"
            variant="tint"
            mono
            fontSize={11}
            style={{
              padding: '5px 12px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Experimental
          </Pill>
        </div>

        <McpRow
          avatar={<TerminalIcon size={16} />}
          bubbleBorder="var(--border)"
        >
          <p
            style={{
              fontSize: `${FONT_SIZE.label}px`,
              color: colorVar('--text-faint'),
            }}
          >
            Your coding agent calls a tool —
          </p>
          <p
            className="mono"
            style={{
              fontSize: `${FONT_SIZE.label}px`,
              color: colorVar('--violet'),
              fontWeight: FONT_WEIGHT.bold,
            }}
          >
            render_mermaid_svg({'{ diagram }'})
          </p>
        </McpRow>

        <McpRow avatar={<LogoMark size={16} />} bubbleBorder="var(--green)">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${SPACE.md}px`,
            }}
          >
            <svg
              viewBox="0 0 60 40"
              width="52"
              height="36"
              style={{ flexShrink: 0 }}
            >
              <rect
                x="4"
                y="4"
                width="20"
                height="12"
                rx="4"
                fill="none"
                stroke={colorVar('--blue')}
                strokeWidth="2"
              />
              <path
                d="M14 16 V24 H46 V24"
                stroke={colorVar('--green')}
                strokeWidth="2"
                fill="none"
                className="edge-anim"
              />
              <rect
                x="36"
                y="24"
                width="20"
                height="12"
                rx="4"
                fill="none"
                stroke={colorVar('--green')}
                strokeWidth="2"
              />
            </svg>
            <p style={{ fontSize: '12.5px', color: colorVar('--text-dim') }}>
              …and gets back a rendered SVG, no browser involved.
            </p>
          </div>
        </McpRow>
      </Card>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xxs}px`,
        }}
      >
        <h3 style={{ fontSize: '19px' }}>MCP server</h3>
        <p
          style={{
            fontSize: `${FONT_SIZE.body}px`,
            color: colorVar('--text-dim'),
            lineHeight: 1.55,
          }}
        >
          <span className="mono">render_mermaid_svg</span>,{' '}
          <span className="mono">render_mermaid_ascii</span>, and a
          sequence-activation checker, exposed over stdio — embed it, or run{' '}
          <span className="mono">zombie-mermaid mcp</span> directly. Shipped to
          gauge interest, not a finished implementation — the tool surface may
          still change.{' '}
          <a href={`${FORK_URL}#mcp-server`}>Read the MCP docs →</a>
        </p>
      </div>
    </div>
  )
}

/** CLI + MCP: not just a browser library. */
function CliMcpSection() {
  return (
    <div
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.loose}px ${LAYOUT.gutter.desktop}px`,
        background: colorVar('--bg-soft'),
        borderTop: `1px solid ${colorVar('--border')}`,
        borderBottom: `1px solid ${colorVar('--border')}`,
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `0 auto ${SPACE['6xl']}px auto`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <SectionEyebrow>Not just a browser library</SectionEyebrow>
        <h2 style={{ fontSize: '38px', letterSpacing: LETTER_SPACING.heading }}>
          A real CLI. A real MCP server.
        </h2>
        <p
          style={{
            fontSize: `${FONT_SIZE.lead}px`,
            color: colorVar('--text-dim'),
            maxWidth: `${LAYOUT.proseMaxWidth}px`,
          }}
        >
          Render from a terminal, a CI pipeline, or hand it straight to your
          coding agent as a tool call — this isn't a browser-only diagram
          widget.
        </p>
      </div>

      <div
        className="cli-mcp-row"
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'stretch',
          gap: `${SPACE['5xl']}px`,
        }}
      >
        <CliPanel />
        <McpPanel />
      </div>
    </div>
  )
}

/* -----------------------------------------------------------------
 * Diagram type gallery teaser
 * ----------------------------------------------------------------- */

/** Flowchart: two boxes joined by a drawn connector. */
function FlowchartTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <rect
        x="6"
        y="8"
        width="34"
        height="18"
        rx="4"
        fill="none"
        stroke={colorVar('--blue')}
        strokeWidth="2"
      />
      <rect
        x="60"
        y="44"
        width="34"
        height="18"
        rx="4"
        fill="none"
        stroke={colorVar('--blue')}
        strokeWidth="2"
      />
      <path
        d="M23 26 V44 H77 V44"
        stroke={colorVar('--blue')}
        strokeWidth="2"
        fill="none"
        className="edge-anim"
      />
    </svg>
  )
}

/** State: two states, one pulsing (the "current" state radar ping). */
function StateTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <circle
        cx="24"
        cy="20"
        r="14"
        fill="none"
        stroke={colorVar('--violet')}
        strokeWidth="2"
        className="radar-ping"
      />
      <circle
        cx="24"
        cy="20"
        r="14"
        fill="none"
        stroke={colorVar('--violet')}
        strokeWidth="2"
      />
      <circle
        cx="76"
        cy="50"
        r="14"
        fill="none"
        stroke={colorVar('--violet')}
        strokeWidth="2"
      />
      <path
        d="M36 28 L64 42"
        stroke={colorVar('--violet')}
        strokeWidth="2"
        fill="none"
      />
    </svg>
  )
}

/** Sequence: two lifelines exchanging messages in both directions. */
function SequenceTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <line
        x1="22"
        y1="8"
        x2="22"
        y2="62"
        stroke={colorVar('--cyan')}
        strokeWidth="2"
      />
      <line
        x1="78"
        y1="8"
        x2="78"
        y2="62"
        stroke={colorVar('--cyan')}
        strokeWidth="2"
      />
      <path
        d="M22 24 H78"
        stroke={colorVar('--cyan')}
        strokeWidth="2"
        className="msg-flow-right"
      />
      <path
        d="M78 44 H22"
        stroke={colorVar('--cyan')}
        strokeWidth="2"
        className="msg-flow-left"
      />
    </svg>
  )
}

/** Class: a class box, its two member rows drawing themselves in. */
function ClassTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <rect
        x="22"
        y="8"
        width="56"
        height="50"
        rx="3"
        fill="none"
        stroke={colorVar('--amber')}
        strokeWidth="2"
      />
      <line
        x1="22"
        y1="26"
        x2="78"
        y2="26"
        stroke={colorVar('--amber')}
        strokeWidth="2"
        className="draw-line"
      />
      <line
        x1="22"
        y1="42"
        x2="78"
        y2="42"
        stroke={colorVar('--amber')}
        strokeWidth="2"
        className="draw-line"
        style={{ animationDelay: '0.5s' }}
      />
    </svg>
  )
}

/** ER: two entities, a pulsing relationship diamond between them. */
function ERTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <rect
        x="4"
        y="24"
        width="30"
        height="20"
        rx="3"
        fill="none"
        stroke={colorVar('--pink')}
        strokeWidth="2"
      />
      <rect
        x="66"
        y="24"
        width="30"
        height="20"
        rx="3"
        fill="none"
        stroke={colorVar('--pink')}
        strokeWidth="2"
      />
      <polygon
        points="50,20 60,34 50,48 40,34"
        fill="none"
        stroke={colorVar('--pink')}
        strokeWidth="2"
        className="relation-pulse"
      />
      <path
        d="M34 34 H40 M60 34 H66"
        stroke={colorVar('--pink')}
        strokeWidth="2"
        className="relation-pulse"
      />
    </svg>
  )
}

/** XY Chart: three bars growing, a trend line drawn across them. */
function XYChartTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <line
        x1="10"
        y1="8"
        x2="10"
        y2="62"
        stroke={colorVar('--green')}
        strokeWidth="2"
      />
      <line
        x1="10"
        y1="62"
        x2="94"
        y2="62"
        stroke={colorVar('--green')}
        strokeWidth="2"
      />
      <rect
        x="20"
        y="40"
        width="10"
        height="22"
        fill={colorVar('--green')}
        className="bar-grow"
      />
      <rect
        x="38"
        y="28"
        width="10"
        height="34"
        fill={colorVar('--green')}
        className="bar-grow"
        style={{ animationDelay: '0.2s' }}
      />
      <rect
        x="56"
        y="16"
        width="10"
        height="46"
        fill={colorVar('--green')}
        className="bar-grow"
        style={{ animationDelay: '0.4s' }}
      />
      <path
        d="M20 44 L46 30 L82 14"
        stroke={colorVar('--green')}
        strokeWidth="2"
        fill="none"
        className="edge-anim"
      />
    </svg>
  )
}

const GALLERY_TILES = [
  FlowchartTile,
  StateTile,
  SequenceTile,
  ClassTile,
  ERTile,
  XYChartTile,
]

/** Six diagram types, one engine — each card links to its `/diagrams/` page. */
function DiagramGalleryTeaser() {
  return (
    <div
      id="diagrams"
      className="section-px"
      style={{
        padding: '100px 80px',
        background: colorVar('--bg-soft'),
        borderTop: `1px solid ${colorVar('--border')}`,
        borderBottom: `1px solid ${colorVar('--border')}`,
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `0 auto ${SPACE['6xl']}px auto`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <SectionEyebrow>Six diagram types, one engine</SectionEyebrow>
        <h2 style={{ fontSize: '38px', letterSpacing: LETTER_SPACING.heading }}>
          Every shape your system needs to explain itself.
        </h2>
      </div>

      <div
        className="gallery-grid"
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: `${SPACE['3xl']}px`,
        }}
      >
        {GALLERY_TYPES.map((type, i) => {
          const Tile = GALLERY_TILES[i]!
          return (
            <Card
              key={type.slug}
              href={`diagrams/${type.slug}.html`}
              padding={18}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: `${SPACE.md}px`,
              }}
            >
              <Tile />
              <p
                style={{
                  fontSize: '13.5px',
                  fontWeight: FONT_WEIGHT.bold,
                  textAlign: 'center',
                  color: colorVar('--text'),
                }}
              >
                {type.label}
              </p>
            </Card>
          )
        })}
      </div>

      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `${SPACE['5xl']}px auto 0 auto`,
          textAlign: 'center',
        }}
      >
        <CTA href="diagrams/" accent="cyan" variant="ghost">
          Browse every diagram type
        </CTA>
      </div>
    </div>
  )
}

/* -----------------------------------------------------------------
 * Proof / maintenance
 * ----------------------------------------------------------------- */

/** One repo's stat row: days since last commit, merged PRs, open PRs. */
function StatRow({
  ink,
  daysSinceCommit,
  mergedPRs,
  openPRs,
}: {
  ink: string
  daysSinceCommit: number
  mergedPRs: number
  openPRs: number
}) {
  return (
    <div
      className="stat-row"
      style={{ display: 'flex', justifyContent: 'space-between' }}
    >
      <div>
        <p className="display" style={{ fontSize: '36px', color: ink }}>
          {daysSinceCommit} {daysSinceCommit === 1 ? 'day' : 'days'}
        </p>
        <p style={{ fontSize: '13.5px', color: colorVar('--text-dim') }}>
          since last commit
        </p>
      </div>
      <div>
        <p className="display" style={{ fontSize: '36px', color: ink }}>
          {mergedPRs}
        </p>
        <p style={{ fontSize: '13.5px', color: colorVar('--text-dim') }}>
          merged PRs
        </p>
      </div>
      <div>
        <p className="display" style={{ fontSize: '36px', color: ink }}>
          {openPRs}
        </p>
        <p style={{ fontSize: '13.5px', color: colorVar('--text-dim') }}>
          open PRs
        </p>
      </div>
    </div>
  )
}

/** Real fork-vs-upstream numbers, and a teaser linking to the full evidence. */
function ProofSection() {
  return (
    <div
      id="fixes"
      className="section-px"
      style={{ padding: `${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px` }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `0 auto ${SPACE['6xl']}px auto`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <SectionEyebrow>
          Straight from the live maintenance dashboard
        </SectionEyebrow>
        <h2 style={{ fontSize: '38px', letterSpacing: LETTER_SPACING.heading }}>
          Actively maintained. Not abandoned.
        </h2>
        <p
          style={{
            fontSize: `${FONT_SIZE.lead}px`,
            color: colorVar('--text-dim'),
            maxWidth: `${LAYOUT.proseMaxWidth}px`,
          }}
        >
          beautiful-mermaid stalled — dozens of open PRs, nothing merged in
          months. Here's the same fork, measured against the original as of{' '}
          {PROOF_SNAPSHOT.asOf} — see the{' '}
          <a href="dashboard.html">live dashboard</a> for current numbers.
        </p>
      </div>

      <div
        className="proof-grid"
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: `${SPACE['7xl']}px`,
        }}
      >
        <Card
          accent="green"
          padding={36}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE['4xl']}px`,
          }}
        >
          <p
            style={{
              fontSize: '15px',
              fontWeight: FONT_WEIGHT.bold,
              color: colorVar('--green'),
              letterSpacing: '0.02em',
            }}
          >
            zombie-mermaid (this fork)
          </p>
          <StatRow ink="var(--green)" {...PROOF_SNAPSHOT.fork} />
        </Card>

        <Card
          padding={36}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE['4xl']}px`,
            opacity: 0.75,
          }}
        >
          <p
            style={{
              fontSize: '15px',
              fontWeight: FONT_WEIGHT.bold,
              color: colorVar('--text-faint'),
              letterSpacing: '0.02em',
            }}
          >
            beautiful-mermaid (upstream)
          </p>
          <StatRow ink="var(--text-faint)" {...PROOF_SNAPSHOT.upstream} />
        </Card>
      </div>

      <Card
        className="fixes-teaser-card"
        padding={0}
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `${SPACE['6xl']}px auto 0 auto`,
          padding: '32px 36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: `${SPACE['3xl']}px`,
          background:
            'linear-gradient(90deg, var(--panel) 0%, var(--panel-2) 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${SPACE['2xl']}px`,
          }}
        >
          <ChecklistIcon size={34} />
          <div>
            <h3 style={{ fontSize: '19px' }}>What this fork fixes</h3>
            <p
              style={{
                fontSize: `${FONT_SIZE.body}px`,
                color: colorVar('--text-dim'),
              }}
            >
              {PROOF_SNAPSHOT.rescuedFixCount} documented bugs, each shown
              before/after with the actual pre-fix and post-fix code.
            </p>
          </div>
        </div>
        <CTA
          href="fork-fixes.html"
          accent="amber"
          style={{ whiteSpace: 'nowrap' }}
        >
          See the evidence
        </CTA>
      </Card>
    </div>
  )
}

/* -----------------------------------------------------------------
 * Blog teaser
 * ----------------------------------------------------------------- */

/** The real newest post, linking to Blog. */
function BlogTeaser() {
  return (
    <div
      id="blog"
      className="section-px"
      style={{
        padding: `80px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px`,
      }}
    >
      <Card
        className="blog-teaser-card"
        padding={40}
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: `${SPACE['5xl']}px`,
        }}
      >
        <div
          className="blog-teaser-inner"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${SPACE['4xl']}px`,
          }}
        >
          <Pill
            mono
            style={{
              background: colorVar('--panel-2'),
              border: `1px solid ${colorVar('--border')}`,
              color: colorVar('--text-faint'),
              fontSize: `${FONT_SIZE.label}px`,
            }}
          >
            {LATEST_POST.displayDate}
          </Pill>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: `${SPACE.xs}px`,
              maxWidth: '560px',
            }}
          >
            <h3 style={{ fontSize: '21px' }}>
              <a
                href={`blog/${LATEST_POST.slug}.html`}
                style={{ color: colorVar('--text') }}
              >
                {LATEST_POST.title}
              </a>
            </h3>
            <p
              style={{
                fontSize: `${FONT_SIZE.body}px`,
                color: colorVar('--text-dim'),
                lineHeight: 1.5,
              }}
            >
              {LATEST_POST.description}
            </p>
          </div>
        </div>
        <a
          href="blog/"
          style={{
            fontSize: `${FONT_SIZE.bodyLg}px`,
            fontWeight: FONT_WEIGHT.bold,
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: `${SPACE.xxs}px`,
          }}
        >
          Read the blog
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      </Card>
    </div>
  )
}

/* -----------------------------------------------------------------
 * Footer links
 * ----------------------------------------------------------------- */

/** Real destinations for the shared Footer's Product/Resources/Project columns. */
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
   * diagram-page.tsx`'s `clientScriptSrc`) rather than inlined, unlike the
   * `themeBarScript` this replaces — this page now has meaningfully more
   * client logic than a one-line `initThemeBar()` call.
   */
  clientScriptSrc: string
  /**
   * The bundled `demo/nav-only-client.tsx` entry (zombie-mermaid#800) that
   * hydrates `<Nav>`, inlined into its own `<script type="module">` — see
   * editor-page.tsx's `EditorPageProps.navClientScript` doc comment for why
   * it stays a separate tag rather than being concatenated with any other
   * script.
   */
  navClientScript: string
}

/** The whole index.html document: the marketing landing page. */
export function IndexPage({
  jsonLd,
  clientScriptSrc,
  navClientScript,
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
        <NavIsland
          homeHref="/zombie-mermaid/"
          hrefs={{
            diagrams: 'diagrams/',
            editor: 'editor.html',
            forkFixes: 'fork-fixes.html',
            blog: 'blog/',
            github: FORK_URL,
          }}
          sticky
        />
        <main id="main">
          <Hero />
          <ThemeShowcase />
          <FeatureGrid />
          <CliMcpSection />
          <DiagramGalleryTeaser />
          <ProofSection />
          <BlogTeaser />
        </main>
        <Footer columns={HOME_FOOTER_COLUMNS} />
        <script type="module" src={clientScriptSrc} />
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/nav-only-client.tsx bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: navClientScript }}
        />
        <NavMobileMenuScript />
      </body>
    </html>
  )
}
