/** @jsxRuntime automatic */
/**
 * The live-editor page (editor.ts → editor.html) as React components.
 *
 * #423's pilot rendered only the document shell here and spliced the whole
 * `<body>` in as one raw HTML string, because editor/html/*.html weren't
 * component-shaped yet. #589 finished the port: the topbar and the two
 * panels are real components now
 * (demo/components/editor-topbar.tsx, demo/components/editor-panels.tsx).
 * `editor/html/` is gone. #806 replaced the last raw splice (an inline
 * `<script type="module">` carrying the bundled renderer plus every
 * editor/js/*.js module, spliced via `dangerouslySetInnerHTML`) with a
 * real server-render-then-hydrate boundary — see the "Hydration" section
 * of this comment below.
 *
 * #609 (part of the #590 site redesign) adds the shared {@link Nav} and
 * {@link Footer} plus a hero header and a feature strip, all lifted from
 * the design canvas's `Editor.dc.html` artboard (see #590's body). This is
 * presentation only: the tool's own chrome — the topbar, the two panels,
 * and the toast, now `<EditorAppIsland>`'s hydrated subtree (see
 * `demo/components/editor-app.tsx`'s `EditorApp`) — is untouched,
 * byte-for-byte the same tree editor/__tests__/support/harness.ts mounts
 * and editor/js/*.js queries by id. Two things had to change to fit it
 * into the new chrome, both confined to this file:
 *
 * 1. **The page now scrolls.** editor/css/variables.css pins `html`/`body`
 *    to a fixed `height:100vh; overflow:hidden` app-shell so `.main`'s
 *    `flex:1` fills the whole viewport between `.topbar` and the toast.
 *    That still works — see point 2 — but the *page* now carries real
 *    content above and below the tool (nav, hero, feature strip, footer),
 *    so it has to scroll like every other redesigned page. {@link
 *    editorPageCss} overrides just `height`/`overflow` on `html, body`
 *    (same selector, later in the cascade wins) and leaves the engine's own
 *    `display:flex; flex-direction:column` declaration alone.
 * 2. **The tool now lives in a fixed-height card, not the full viewport.**
 *    `.editor-tool-shell` (defined here, not in editor/css) reproduces
 *    body's old contract — `display:flex; flex-direction:column;
 *    overflow:hidden` over an explicit height — so `<EditorApp>`'s three
 *    children (`.topbar`, `.main`, the toast) lay out exactly as before,
 *    just scoped to a smaller, bordered box instead of the whole window.
 *    `<EditorApp>` renders a fragment, so those three elements land as
 *    `.editor-tool-shell`'s direct children with no wrapper `<div>` in
 *    between — the same "no wrapper" invariant the component's own doc
 *    comment describes, just one level down from `<body>` (the actual
 *    element `.editor-tool-shell` holds is `#editor-root`, `<EditorAppIsland>`'s
 *    hydration container — see this file's "Hydration" section — but that
 *    container is a plain, inert wrapper `<EditorApp>` renders no markup
 *    of its own into, so the invariant still holds one level further down).
 *
 * The new chrome's colours come from tokens.tsx's design-system palette,
 * which is *not* safe to load at `:root` here: editor/css/variables.css
 * already defines `--bg`, `--border`, and `--green` for its own light/dark
 * theming (derived from `--t-bg`/`--t-fg`, which the dark-mode toggle
 * rewrites at runtime), and tokens.tsx's `COLORS` reuses those exact three
 * names for unrelated values. Loading `designTokensCss()` at `:root` would
 * silently overwrite the tool's own theme variables and break the dark-mode
 * toggle. {@link editorPageCss} instead scopes the whole palette to
 * `.zm-shell` — the wrapper around the nav/hero block and the one around
 * the feature-strip/footer block — so it cascades to their descendants
 * (Nav, Footer, Card, the icons) without ever reaching `:root` or the tool.
 * `.editor-tool-shell`'s own border/shadow use the same palette's literal
 * hex values (tokens.tsx's `COLORS`, read directly rather than through
 * `var()`) for the same reason: a `var(--border)` reference there would
 * resolve against the *tool's* `--border` (an ordinary CSS custom property
 * inherited from its nearest ancestor, and `.editor-tool-shell` sits outside
 * `.zm-shell`'s scope), not the design system's.
 *
 * Deliberately not reproduced from the canvas: the decorative theme-swatch
 * strip between the hero and the tool. It has no `data-theme`/click
 * handlers in the mockup — it is static marketing art — and the tool
 * directly below it already has a real, working 15-theme dropdown
 * (`<EditorTopbar>`'s `#theme-dropdown-btn`). Shipping an inert copy next
 * to the real control would read as a second, broken theme picker.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 *
 * ## Hydration (zombie-mermaid#806)
 *
 * The tool's chrome (topbar, panels, toast — what used to be
 * `<EditorChrome>`, rendered via `renderToStaticMarkup` with a separate
 * vanilla-JS bundle bolted on) is now `<EditorAppIsland>`: a real
 * server-render-then-hydrate boundary, matching `dashboard.html`/
 * `fork-fixes.html`'s established pattern. See
 * `demo/components/editor-app.tsx`'s header comment for the state/DOM-ref
 * core this introduces, and `demo/components/editor-app-island.tsx` for
 * the server-side half of the boundary.
 *
 * Two real `<script type="module">` tags run, in this order (document
 * order is execution order for module scripts):
 *
 * 1. `rendererSetupJs` — `window.__themeColors` (the site-chrome re-theming
 *    table, see this file's own module doc comment and `demo/editor-
 *    client.tsx`'s), the bundled Mermaid renderer (`window.__mermaid`),
 *    and the theme-state bridge (`window.__themeState`).
 * 2. `editorClientScript` — `demo/editor-client.tsx`'s bundle: hydrates
 *    `<EditorApp>` against pristine, server-rendered markup, hydrates
 *    `<NavIsland>`, re-themes the chrome via `initChromeTheme()`, then
 *    loads and runs {@link appJs} itself.
 *
 * `appJs` — the remaining 15 legacy `editor/js/*.ts` modules (unchanged, still
 * concatenated the same way `bundleEditorJs()` always has) — is **not** a
 * third `<script type="module">` tag. It's embedded as inert data (a
 * `<script>` with a `type` no browser executes) and only actually run once
 * `demo/editor-client.tsx`'s `runLegacyEditorBundle()` explicitly loads it
 * via a `Blob` URL, *after* confirming `<EditorApp>` has really finished
 * hydrating (not just "come after in the script tag order" — see that
 * file's header comment and `editor-app.tsx`'s `EDITOR_HYDRATED_EVENT` doc
 * comment for why script order alone turned out not to be enough: several
 * legacy modules mutate DOM inside `<EditorApp>`'s hydration boundary at
 * module-top-level, and `hydrateRoot()`'s own hydration pass is scheduled
 * asynchronously rather than run synchronously inside the `hydrateRoot()`
 * call).
 */
import type { ReactNode } from 'react'
import { SiteHead } from './site-head.tsx'
import { HOME_HREF, ROOT_NAV_HREFS } from './site-chrome.tsx'
import { EditorAppIsland } from './editor-app-island.tsx'
import { EDITOR_LEGACY_APP_JS_ELEMENT_ID } from './editor-app.tsx'
import type { EditorThemeItem } from './editor-topbar.tsx'
import { NavMobileMenuScript, NavStyle } from './nav.tsx'
import { NavIsland } from './nav-island.tsx'
import { Footer, FooterStyle } from './footer.tsx'
import { Card, PrimitivesStyle } from './primitives.tsx'
import {
  ChevronRightIcon,
  DownloadIcon,
  ShareIcon,
  SyncRenderIcon,
  ThemesIcon,
} from './icons.tsx'
import {
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  FONTS,
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'

/* -----------------------------------------------------------------
 * The new chrome's CSS
 * ----------------------------------------------------------------- */

/** The class scoping the design-system palette away from `:root`. See the
 * module doc comment for why `:root` itself is off-limits on this page. */
const ZM_SHELL = 'zm-shell'

/**
 * tokens.tsx's palette and type stack as custom properties on `selector`,
 * plus the same base element rules `designBaseCss()` applies at `:root` on
 * every other redesigned page. A scoped equivalent of `designTokensCss()` +
 * `designBaseCss()` — see the module doc comment for why this page can't
 * use those directly.
 */
function scopedDesignTokensCss(selector: string): string {
  const colors = Object.entries(COLORS)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')
  return `.${selector} {
${colors}
  --font-display: ${FONTS.display};
  --font-body: ${FONTS.body};
  --font-mono: ${FONTS.mono};
  font-family: var(--font-body);
  color: var(--text);
  background: var(--bg);
}

.${selector} h1,
.${selector} h2,
.${selector} h3,
.${selector} .display {
  font-family: var(--font-display);
  font-weight: ${FONT_WEIGHT.bold};
}

.${selector} a {
  color: var(--cyan);
  text-decoration: none;
}

.${selector} a:hover {
  color: var(--pink);
}`
}

/** The hero h1's desktop size, in px — the mockup's own literal (46), not
 * on tokens.tsx's `FONT_SIZE` scale (its `h1` step is a plainer 38). */
const HERO_H1_SIZE = 46
/** The hero h1's size at {@link BREAKPOINTS_MOBILE} and below — this one
 * does match tokens.tsx's `FONT_SIZE.h1Mobile`, kept literal alongside
 * {@link HERO_H1_SIZE} rather than split across two sources. */
const HERO_H1_SIZE_MOBILE = 34
/** Mirrors tokens.tsx's `BREAKPOINTS.mobile` — kept literal so this file's
 * CSS text doesn't need a second import just for one number. */
const BREAKPOINTS_MOBILE = 600
/** Mirrors tokens.tsx's `BREAKPOINTS.tablet`. */
const BREAKPOINTS_TABLET = 900

/**
 * This page's own layout rules: the scoped palette (one `.zm-shell` class
 * rule, matching both of the page's `.zm-shell` divs), the scroll-enabling
 * override, the tool's card frame, and the feature grid's responsive
 * columns.
 */
function editorPageCss(): string {
  return `${scopedDesignTokensCss(ZM_SHELL)}

/* The tool's own engine (editor/css/variables.css) pins html/body to a
 * fixed-height, non-scrolling app-shell. This page now has real content
 * above and below the tool, so it must scroll like the rest of the site.
 * Only height/overflow are touched — display:flex stays the engine's own,
 * unedited declaration, and later rules win the cascade at equal
 * specificity, so this doesn't need !important. */
html,
body {
  height: auto;
  min-height: 100vh;
  overflow: visible;
}

/* Reproduces body's old contract (display:flex; flex-direction:column;
 * overflow:hidden over an explicit height) so <EditorChrome>'s three
 * fragment children lay out exactly as before, just scoped to a card
 * instead of the whole viewport. Colours are literal hex (tokens.tsx's
 * COLORS), not var() — see the module doc comment for why. */
.editor-tool-shell {
  display: flex;
  flex-direction: column;
  height: min(720px, 82vh);
  min-height: 480px;
  max-width: ${LAYOUT.maxWidth}px;
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid ${COLORS['--border']};
  border-radius: 20px;
  box-shadow: 0 18px 44px rgba(10, 13, 22, 0.35);
  /* The tool's own engine (editor/css/topbar.css, color-picker.css,
   * font-picker.css, misc.css) reaches z-index 100-9999 for its topbar,
   * pickers, and toasts -- reasonable *inside* a tool that used to own the
   * whole viewport, not once the tool lives in a card partway down a
   * scrolling page. Without isolation, those values compete directly with
   * the rest of the page's z-index scale (nav.tsx's bar is 10, its mobile
   * menu overlay 9) and win, so the tool's own chrome would show through
   * a fullscreen overlay meant to cover everything. The isolation property
   * below makes this box its own stacking context -- the tool's internal
   * z-index values stay contained here, however high they go, and the box
   * itself paints in normal document order in the page's own context. */
  isolation: isolate;
}

@media (max-width: ${BREAKPOINTS_TABLET}px) {
  .editor-tool-shell {
    height: min(640px, 78vh);
  }
  .page-h1 {
    font-size: ${HERO_H1_SIZE}px;
  }
  .editor-features-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: ${BREAKPOINTS_MOBILE}px) {
  .editor-tool-shell {
    height: min(560px, 74vh);
  }
  .page-h1 {
    font-size: ${HERO_H1_SIZE_MOBILE}px;
  }
  .editor-features-grid {
    grid-template-columns: 1fr;
  }
}`
}

/* -----------------------------------------------------------------
 * The new chrome's markup
 * ----------------------------------------------------------------- */

/** Breadcrumb + heading + description, lifted from the canvas's page
 * header — the only copy on this page that isn't the tool itself. */
function EditorHero({ homeHref }: { homeHref: string }) {
  return (
    <div
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.snug}px ${LAYOUT.gutter.desktop}px ${SPACE['5xl']}px ${LAYOUT.gutter.desktop}px`,
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <nav
          aria-label="Breadcrumb"
          className="mono"
          style={{
            fontSize: `${FONT_SIZE.bodySm}px`,
            display: 'flex',
            alignItems: 'center',
            gap: `${SPACE.xs}px`,
          }}
        >
          <a href={homeHref} style={{ color: colorVar('--text-faint') }}>
            Home
          </a>
          <ChevronRightIcon size={12} strokeWidth={2.4} />
          <span style={{ color: colorVar('--text-dim') }}>Editor</span>
        </nav>
        <h1
          className="page-h1"
          style={{
            fontSize: `${HERO_H1_SIZE}px`,
            lineHeight: 1.1,
            letterSpacing: LETTER_SPACING.display,
            maxWidth: 760,
          }}
        >
          Write Mermaid, watch it render as you type.
        </h1>
        <p
          style={{
            fontSize: `${FONT_SIZE.lead}px`,
            lineHeight: 1.6,
            color: colorVar('--text-dim'),
            maxWidth: 640,
          }}
        >
          A live SVG preview, 15 switchable themes, pan &amp; zoom, and
          one-click SVG export — every diagram you edit here round-trips through
          the URL, so a shared link reproduces the exact view.
        </p>
      </div>
    </div>
  )
}

/** One card in the feature strip below the tool. */
interface EditorFeature {
  icon: ReactNode
  title: string
  description: string
}

/** The four features the canvas's editor page calls out, in canvas order —
 * each icon is icons.tsx's own component for that exact feature (see each
 * icon's CANVAS note for the Editor.dc.html reference). */
const EDITOR_FEATURES: readonly EditorFeature[] = [
  {
    icon: <SyncRenderIcon size={26} color={colorVar('--blue')} />,
    title: 'Live, debounced rendering',
    description:
      'Type or paste Mermaid source and the preview re-renders a beat later — no explicit "run" button, no full page reload.',
  },
  {
    icon: <ShareIcon size={26} />,
    title: 'Shareable via URL',
    description:
      'The diagram source and selected theme both round-trip through the URL hash — copy the link, send the exact view.',
  },
  {
    icon: <ThemesIcon size={26} color={colorVar('--violet')} />,
    title: '15 built-in themes',
    description:
      'Switch instantly between all 15 themes right from the toolbar, with no re-parse of your diagram source.',
  },
  {
    icon: <DownloadIcon size={26} />,
    title: 'One-click SVG export',
    description:
      'Download the exact rendered diagram as a clean, standalone SVG file — ready to drop into docs or slides.',
  },
] as const

/** The feature-strip section below the tool: an eyebrow + heading over a
 * four-card grid, one card per {@link EDITOR_FEATURES} entry. */
function EditorFeatureStrip() {
  return (
    <div
      className="section-px"
      style={{
        padding: `${SPACE['5xl']}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px`,
        background: colorVar('--bg-soft'),
        borderTop: `1px solid ${colorVar('--border')}`,
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `0 auto ${SPACE['7xl']}px auto`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <span className="section-eyebrow">
          Everything a mermaid.live user expects
        </span>
        <h2
          style={{
            fontSize: `${FONT_SIZE.h2}px`,
            letterSpacing: LETTER_SPACING.heading,
          }}
        >
          Built to be the fast, shareable way to draft a diagram.
        </h2>
      </div>

      <div
        className="editor-features-grid"
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: `${SPACE['3xl']}px`,
        }}
      >
        {EDITOR_FEATURES.map((feature) => (
          <Card
            key={feature.title}
            padding={26}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: `${SPACE.lg}px`,
            }}
          >
            {feature.icon}
            <h3 style={{ fontSize: `${FONT_SIZE.lead}px` }}>{feature.title}</h3>
            <p
              style={{
                fontSize: `${FONT_SIZE.bodySm}px`,
                color: colorVar('--text-dim'),
                lineHeight: 1.5,
              }}
            >
              {feature.description}
            </p>
          </Card>
        ))}
      </div>
    </div>
  )
}

export interface EditorPageProps {
  css: string
  /**
   * The theme dropdown's entries, as plain JSON-serializable data (see
   * editor.ts's `themes` build) — `<EditorAppIsland>` both renders them
   * server-side and embeds them for `demo/editor-client.tsx` to hydrate
   * against. Raw data, not a `ReactNode` (unlike the old `themeItems`
   * prop): the island needs to `JSON.stringify` this, which a `ReactNode`
   * can't round-trip through.
   */
  themes: readonly EditorThemeItem[]
  /**
   * `window.__themeColors` (the bg/fg table `initChromeTheme()` needs —
   * every other page gets this from `ThemePickerSection`; this page embeds
   * it directly instead, see editor.ts's `generateEditorHtml()`), the
   * bundled Mermaid renderer (`window.__mermaid`), and the theme-state
   * bridge (`window.__themeState`). Must run before {@link
   * editorClientScript} (both are `type="module"`, so document order is
   * execution order) — see this file's header comment.
   */
  rendererSetupJs: string
  /**
   * The bundled `demo/editor-client.tsx` entry (zombie-mermaid#806) that
   * hydrates `<EditorApp>`, hydrates `<NavIsland>`, and then loads and
   * runs {@link appJs} itself once hydration is confirmed complete — see
   * this file's header comment and `demo/editor-client.tsx`'s own header
   * comment for why that has to be an explicit runtime step rather than
   * just a later `<script>` tag.
   */
  editorClientScript: string
  /**
   * The remaining 15 legacy `editor/js/*.js` modules (zoom.ts/pan.ts/
   * resize.ts moved to React state by #807), concatenated by editor.ts
   * exactly as before #806 — unchanged behavior. As of #806, embedded as
   * *inert* data (a `<script>` element whose `type` no browser executes),
   * not a `<script type="module">` tag — {@link editorClientScript} loads
   * and runs it explicitly, at the right time. See this file's header
   * comment for why.
   */
  appJs: string
}

export function EditorPage({
  css,
  themes,
  rendererSetupJs,
  editorClientScript,
  appJs,
}: EditorPageProps) {
  const homeHref = HOME_HREF
  // This page's own "Editor" nav item has no real destination -- omit the
  // key so nav.tsx falls back to NAV_ITEMS's `#editor` placeholder, same
  // as every other page's active-page self-link.
  const { editor: _editor, ...editorNavHrefs } = ROOT_NAV_HREFS
  return (
    <html lang="en">
      <head>
        <SiteHead title="zombie-mermaid — Live Editor" css={css} />
        {/* SiteHead only emits the SVG favicon (first shaped around
            dashboard.ts, which needs nothing else). The original template
            also links a .ico fallback and an apple-touch-icon; kept here as
            siblings rather than growing SiteHead's props for one consumer. */}
        <link rel="icon" type="image/x-icon" href="favicon.ico" />
        <link rel="apple-touch-icon" href="apple-touch-icon.png" />
        <PrimitivesStyle />
        <NavStyle />
        <FooterStyle />
        <style>{editorPageCss()}</style>
      </head>
      <body>
        {/*
          A separate `.zm-shell` wrapper from the hero's below, `display:
          contents` so it contributes no box of its own -- `<NavIsland
          sticky>`'s containing block (nav-island.tsx's `display: contents`
          on #nav-root pushes it here, its own parent) needs to span the
          page's full scroll height to have any room to actually stick, and
          the hero-sized `.zm-shell` below does not. `display: contents`
          still participates fully in the cascade (`--text`/`--bg`/etc
          inherit through it normally) and in descendant-selector matching
          (`.zm-shell .nav-bar` etc, from `scopedDesignTokensCss` above,
          still resolves through it) -- only its own box disappears, so the
          scoped palette still reaches `<NavIsland>` exactly as before.
        */}
        <div className={ZM_SHELL} style={{ display: 'contents' }}>
          <NavIsland
            sticky
            active="editor"
            homeHref={homeHref}
            hrefs={editorNavHrefs}
          />
        </div>
        <div className={ZM_SHELL}>
          <EditorHero homeHref={homeHref} />
        </div>

        <div
          className="section-px"
          style={{
            padding: `0 ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.snug}px ${LAYOUT.gutter.desktop}px`,
            // Literal hex (tokens.tsx's COLORS), not var(--bg): this div sits
            // between the two .zm-shell blocks, outside their scope, and
            // would otherwise show the *tool's* --bg (near-white) through as
            // a jarring pale band between two dark sections. See the module
            // doc comment on why var(--bg) itself is off-limits here.
            background: COLORS['--bg'],
          }}
        >
          <div className="editor-tool-shell">
            <EditorAppIsland themes={themes} />
          </div>
        </div>

        <div className={ZM_SHELL}>
          <EditorFeatureStrip />
          <Footer />
        </div>

        {/* 1. window.__themeColors + renderer + theme-state bridge — must run first (see header comment) */}
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own chromeThemeColorsScript() output plus the src/browser.ts bundle and the theme-state bridge, all under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: rendererSetupJs }}
        />
        {/* 2. Hydrates <EditorApp> + <NavIsland>, then loads (3) itself once hydration is confirmed done */}
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/editor-client.tsx bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: editorClientScript }}
        />
        {/* 3. Legacy editor/js/*.js modules — inert data, not an executable script (see header comment) */}
        <script
          type="application/x-zm-legacy-js"
          id={EDITOR_LEGACY_APP_JS_ELEMENT_ID}
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own editor/js/*.js modules, under version control and concatenated at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: appJs }}
        />
        <NavMobileMenuScript />
      </body>
    </html>
  )
}
