/** @jsxRuntime automatic */
/**
 * The live-editor page (editor.ts → editor.html) as React components.
 *
 * #423's pilot rendered only the document shell here and spliced the whole
 * `<body>` in as one raw HTML string, because editor/html/*.html weren't
 * component-shaped yet. #589 finished the port: the topbar and the two
 * panels are real components now
 * (demo/components/editor-topbar.tsx, demo/components/editor-panels.tsx),
 * `editor/html/` is gone, and the only thing still spliced in raw is the
 * inline `<script type="module">` carrying the bundled renderer plus every
 * editor/js/*.js module — which stays a separately bundled vanilla script
 * by design (see docs/decisions/react-site-migration-plan.md).
 *
 * #609 (part of the #590 site redesign) adds the shared {@link Nav} and
 * {@link Footer} plus a hero header and a feature strip, all lifted from
 * the design canvas's `Editor.dc.html` artboard (see #590's body). This is
 * presentation only: {@link EditorChrome} — the topbar, the two panels, and
 * the toast — is untouched, byte-for-byte the same tree
 * editor/__tests__/support/harness.ts mounts and editor/js/*.js queries by
 * id. Two things had to change to fit it into the new chrome, both confined
 * to this file:
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
 *    overflow:hidden` over an explicit height — so `<EditorChrome>`'s three
 *    children (`.topbar`, `.main`, the toast) lay out exactly as before,
 *    just scoped to a smaller, bordered box instead of the whole window.
 *    `<EditorChrome>` renders a fragment, so those three elements land as
 *    `.editor-tool-shell`'s direct children with no wrapper `<div>` in
 *    between — the same "no wrapper" invariant the component's own doc
 *    comment describes, just one level down from `<body>`.
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
 */
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { escapeJsonForScriptTag } from '../format.ts'
import { SiteHead } from './site-head.tsx'
import { FORK_URL } from './site-chrome.tsx'
import {
  EditorApp,
  EDITOR_PROPS_ELEMENT_ID,
  EDITOR_ROOT_ID,
  type EditorAppProps,
} from './editor-app.tsx'
import { type EditorThemeItem } from './editor-topbar.tsx'
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

// Re-exported for existing callers/tests that import these from
// editor-page.tsx rather than editor-app.tsx directly (this file was the
// sole home for EditorChrome before the #806 split).
export {
  EditorApp,
  EditorChrome,
  EDITOR_PROPS_ELEMENT_ID,
  EDITOR_ROOT_ID,
  type EditorAppProps,
} from './editor-app.tsx'

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
   * The theme dropdown's entries (see editor.ts's `ThemeDropdownItems`) —
   * plain, JSON-serializable data (not a pre-built `ReactNode`, unlike
   * before #806) since it now doubles as {@link EditorApp}'s hydration
   * props.
   */
  themes: readonly EditorThemeItem[]
  /**
   * The bundled renderer plus every editor/js/*.js module, concatenated by
   * editor.ts exactly as before and inlined as one module script. Entirely
   * unaffected by #806's hydration of {@link EditorApp} — see that
   * component's own doc comment (editor-app.tsx) for why these modules
   * don't need to change to keep working against hydrated (rather than
   * only server-rendered) markup.
   */
  scriptJs: string
  /**
   * The bundled `demo/nav-only-client.tsx` entry (zombie-mermaid#800) that
   * hydrates `<Nav>`, inlined into its own separate `<script type="module">`
   * — not concatenated into {@link scriptJs}. See editor.ts's own doc
   * comment for why: two independently-minified bundles concatenated as
   * plain text risk colliding top-level identifier names (the exact hazard
   * that already forces `bundleThemeStateBridge()`'s IIFE wrapper there);
   * a second `<script type="module">` tag gets its own module scope for
   * free instead.
   */
  navClientScript: string
  /**
   * The bundled `demo/editor-client.tsx` entry (zombie-mermaid#806) that
   * hydrates {@link EditorApp} against {@link EDITOR_ROOT_ID} — its own
   * separate `<script type="module">` tag, for the identical
   * concatenation-collision reason {@link navClientScript}'s doc comment
   * gives. Defaults to `''` (no hydration script at all — SSR-only),
   * matching every other page's `clientScript` default.
   */
  editorClientScript?: string
}

export function EditorPage({
  css,
  themes,
  scriptJs,
  navClientScript,
  editorClientScript = '',
}: EditorPageProps) {
  const appProps: EditorAppProps = { themes }
  const homeHref = '/zombie-mermaid/'
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
        <div className={ZM_SHELL}>
          <NavIsland
            active="editor"
            homeHref={homeHref}
            hrefs={{
              diagrams: 'diagrams/',
              forkFixes: 'fork-fixes.html',
              blog: 'blog/',
              github: FORK_URL,
            }}
          />
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
          {/*
            Plain, inert hydration container -- see dashboard-app.tsx's
            DASHBOARD_ROOT_ID doc comment for why EditorApp's own root
            can't carry this id itself, and dashboard-page.tsx's own, more
            detailed version of this comment for why renderToString (not
            renderToStaticMarkup) is needed here. `.editor-tool-shell`
            already is (and was, pre-#806) a plain wrapper div around
            EditorChrome's rendered output with no markup of its own, so it
            simply gains an id rather than needing a second wrapper.
          */}
          <div
            className="editor-tool-shell"
            id={EDITOR_ROOT_ID}
            dangerouslySetInnerHTML={{
              // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this page's own EditorApp component tree rendered via renderToString (see the comment above); never user input
              __html: renderToString(<EditorApp {...appProps} />),
            }}
          />
        </div>
        <script
          type="application/json"
          id={EDITOR_PROPS_ELEMENT_ID}
          dangerouslySetInnerHTML={{
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from this page's own EditorAppProps, escaped with escapeJsonForScriptTag; never user input
            __html: escapeJsonForScriptTag(JSON.stringify(appProps)),
          }}
        />

        <div className={ZM_SHELL}>
          <EditorFeatureStrip />
          <Footer />
        </div>

        {/*
          Deliberately *before* the `scriptJs` tag below, not after: both
          are `type="module"` (which, like `defer`, execute in document
          order relative to each other), and `editor/js/init.ts`'s own
          top-level code (bundled into `scriptJs`) synchronously mutates
          DOM nodes *inside* EDITOR_ROOT_ID -- `updateLineNumbers()` sets
          `#line-numbers`'s `textContent`, for one -- the moment it runs.
          If that ran before this file's `hydrateRoot()` call (in `demo/
          editor-client.tsx`, wrapped in `flushSync()` for exactly this
          reason), React's own hydration-match verification would find
          `#line-numbers` already containing text it never rendered itself
          and fail with a real hydration-mismatch error -- caught for real
          in a browser during #806's development (not by reasoning alone),
          the same class of bug `diagram-type-client.tsx`'s `flushSync()`
          fix already addresses for a different page (see that file's own
          header comment). Running this script first, combined with
          `flushSync()` there, guarantees hydration always fully settles
          before `editor/js` gets a chance to touch anything.
        */}
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/editor-client.tsx bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: editorClientScript }}
        />
        {/* Bundled renderer */}
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own src/browser.ts bundle plus editor/js/*.js, both under version control and concatenated at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: scriptJs }}
        />
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
