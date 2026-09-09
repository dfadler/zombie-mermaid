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
 * app — see `index-app.tsx`'s header comment for why (in short: it
 * renders `ThemePickerIsland`, an `react-dom/server` importer, and calls
 * `renderMermaidSVG` for its live diagram; neither belongs in a client
 * bundle).
 *
 * Layout, copy, and every colour/measurement below come from the design
 * canvas linked in #590's body
 * (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`),
 * specifically its `Main.dc.html` (desktop) / `MainMobile.dc.html` (mobile)
 * artboards — the two are byte-identical, so the responsive behaviour lives
 * entirely in the shared component `*Css()` functions and {@link homePageCss}'s
 * `@media` blocks, not in a second markup path. See `index-app.tsx`'s
 * header comment for the deliberate deviations from the canvas (unchanged
 * by this split).
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { renderToString } from 'react-dom/server'
import { FORK_URL } from './site-chrome.tsx'
import { NAV_THEME_SLOT_ID, NavMobileMenuScript } from './nav.tsx'
import { NavIsland } from './nav-island.tsx'
import { Footer, type FooterColumn } from './footer.tsx'
import { SectionEyebrow } from './primitives.tsx'
import { themePickerCss } from './theme-picker.tsx'
import { ThemePickerIsland } from './theme-picker-island.tsx'
import { SharedPageStyles } from './shared-page-css.tsx'
import {
  DesignFontLinks,
  FONT_SIZE,
  LAYOUT,
  LETTER_SPACING,
  MEDIA,
  SPACE,
  colorVar,
} from './tokens.tsx'
import { renderMermaidSVG } from '../../src/index.ts'
import { THEMES } from '@zombie-mermaid/core'
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

${MEDIA.reducedMotion} {
  .edge-anim { animation: none; }
  .radar-ping { animation: none; opacity: 0; }
  .msg-flow-right { animation: none; }
  .msg-flow-left { animation: none; }
  .draw-line { animation: none; stroke-dashoffset: 0; }
  .relation-pulse { animation: none; }
  .bar-grow { animation: none; transform: scaleY(1); }
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
}`
}

function renderThemeShowcaseDiagram(): string {
  const theme = THEMES[THEME_SHOWCASE_DEFAULT_THEME]
  if (!theme) {
    throw new Error(`Unknown theme key: ${THEME_SHOWCASE_DEFAULT_THEME}`)
  }
  return renderMermaidSVG(THEME_SHOWCASE_SOURCE, {
    ...theme,
    title: 'A flowchart, rendered live in the picked theme',
    interactivity: 'none',
  })
}

/**
 * One real diagram plus a full 15-theme {@link ThemePicker} (#759),
 * replacing the five static per-theme mock cards this section used to
 * render — the "Switch it live" claim right below the heading now has
 * something on the page that actually proves it, instead of five
 * hand-drawn SVGs with baked-in colours.
 *
 * `#theme-showcase`/`#theme-pills` are load-bearing ids, not decorative:
 * `demo/index-page-client.ts`'s `hydrateThemeBar()` (#801) hydrates the
 * picker by looking up `#theme-pills` (there must be exactly one on the
 * page — this is also why {@link IndexPage} no longer renders the separate
 * `ThemePickerSection` every other page does, which would otherwise render
 * a second, colliding `#theme-pills`), and its `IntersectionObserver`
 * watches `#theme-showcase` to know when to reparent the picker into the
 * sticky nav's `#nav-theme-slot` (`nav.tsx`'s `installSlot`).
 *
 * `includeDefault={false}`: the Default pseudo-theme has no real bg/fg to
 * render this section's own diagram with, and this showcase's whole point
 * is proving the 15 real themes — unlike every other page's
 * `ThemePickerSection`, which wants a Default pill since it only re-themes
 * the site chrome, with no specific diagram of its own to fall back from.
 */
function ThemeShowcase() {
  return (
    <div
      id="theme-showcase"
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
        <SectionEyebrow>Live theme switching</SectionEyebrow>
        <h2 style={{ fontSize: '38px', letterSpacing: LETTER_SPACING.heading }}>
          Pick a theme. Switch it live — no re-render.
        </h2>
        <p
          style={{
            fontSize: `${FONT_SIZE.lead}px`,
            color: colorVar('--text-dim'),
            maxWidth: `${LAYOUT.proseMaxWidth}px`,
          }}
        >
          Themes are pure CSS custom properties, so switching one is instant.
          Pick any of the fifteen below — the diagram, and this page's own
          chrome, repaint immediately. No reload.
        </p>
      </div>

      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: `${SPACE['4xl']}px`,
        }}
      >
        <ThemePickerIsland
          includeDefault={false}
          activeThemeKey={THEME_SHOWCASE_DEFAULT_THEME}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: `${SPACE.md}px`,
          }}
        />
        <div
          className="card theme-showcase-diagram"
          style={{
            width: '100%',
            maxWidth: '560px',
            padding: `${SPACE['4xl']}px`,
            display: 'flex',
            justifyContent: 'center',
          }}
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG output, never user input (see this file's header comment)
          dangerouslySetInnerHTML={{ __html: renderThemeShowcaseDiagram() }}
        />
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
        <style>{themePickerCss()}</style>
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
          // #759: the install pill is a placeholder here, not a real
          // NavInstall -- demo/index-page-client.ts reparents the real,
          // already-mounted #theme-pills picker into this slot once
          // #theme-showcase scrolls out of view (one-way; see that
          // module's own doc comment). Empty rather than NavInstall's
          // markup so nav.tsx's own "no <button> in SSR output" invariant
          // (__tests__/demo-nav.test.ts) holds here too: a real <button>
          // only ever arrives via that runtime reparenting. NavIsland
          // reconstructs this same placeholder client-side from
          // `hasInstallSlot` (zombie-mermaid#800) since a real element
          // can't round-trip through the JSON hydration payload — see
          // nav-island.tsx's `NavHydrationProps` doc comment.
          installSlot={<div id={NAV_THEME_SLOT_ID} />}
          sticky
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
