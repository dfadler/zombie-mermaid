/** @jsxRuntime automatic */
/**
 * The "what this fork fixes" before/after showcase (fork-fixes.ts →
 * fork-fixes.html) as React components — restyled for the #590 site
 * redesign (#608), part of #590's larger move onto the shared component
 * library (#591: tokens.tsx, primitives.tsx, icons.tsx, nav.tsx, footer.tsx).
 *
 * As of zombie-mermaid#802, this file holds only the page *shell*
 * (`<html>`/`<head>`, the `NavIsland`/`ThemePickerSection`/`Footer` sibling
 * islands, the hydration container/script wiring) — the hydrated hero +
 * fixes-list content (the syntax highlighter, `FixPanel`, `FixSection`,
 * ...) lives in `fork-fixes-app.tsx`'s `ForkFixesApp`, split out
 * specifically so `demo/fork-fixes-client.tsx` (the browser bundle) never
 * needs to import this file, and therefore never pulls in `react-dom/
 * server` (used below for `renderToString`) into the client bundle — see
 * `fork-fixes-app.tsx`'s own header comment, and `dashboard-app.tsx`'s
 * (the pattern this mirrors) for the full rationale, including why
 * `<ThemePickerSection>`/`<Footer>` render here as plain siblings rather
 * than nested inside `ForkFixesApp`'s hydrated tree.
 *
 * Every real fact rendered (the PR/commit/render mode/upstream-issue
 * metadata, the source, and the before/after content itself) still comes
 * from fork-fixes.ts unchanged — extracting each pre-fix source tree,
 * rendering both halves of every pair, converting ASCII output through
 * ascii-html.ts, checking for a committed real-terminal screenshot, and
 * failing the build if any pair renders identically. None of that moved;
 * only how the result is laid out and hydrated did. See fork-fixes.ts's
 * own header for the guarantees this file must not weaken.
 *
 * Layout, colours, type, and spacing are lifted from the design canvas
 * linked in #590's body
 * (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`),
 * artboard `ForkFixes.dc.html` — the same canvas tokens.tsx, primitives.tsx,
 * nav.tsx, footer.tsx, and icons.tsx were extracted from.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { renderToString } from 'react-dom/server'
import { escapeJsonForScriptTag } from '../format.ts'
import { FORK_URL, HOME_HREF, ROOT_NAV_HREFS } from './site-chrome.tsx'
import { Footer, type FooterColumn } from './footer.tsx'
import { NavMobileMenuScript } from './nav.tsx'
import { NavIsland } from './nav-island.tsx'
import { ThemePickerSection } from './theme-picker-section.tsx'
import {
  ForkFixesApp,
  FORK_FIXES_PROPS_ELEMENT_ID,
  FORK_FIXES_ROOT_ID,
  type FixSectionProps,
  type ForkFixesAppProps,
} from './fork-fixes-app.tsx'
import { DesignFontLinks } from './tokens.tsx'

// Re-exported for existing callers/tests that import these from
// fork-fixes-page.tsx rather than fork-fixes-app.tsx directly (this file
// was the sole home for all of them before the #802 split).
export {
  ForkFixesApp,
  FORK_FIXES_PROPS_ELEMENT_ID,
  FORK_FIXES_ROOT_ID,
  tokenizeMermaidSource,
  FixPanel,
  FixSection,
  type SourceTokenKind,
  type SourceToken,
  type PanelContent,
  type FixSectionProps,
  type ForkFixesAppProps,
} from './fork-fixes-app.tsx'

const NAV_HREFS = { ...ROOT_NAV_HREFS, forkFixes: '#' }

const FOOTER_COLUMNS: readonly FooterColumn[] = [
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
      {
        label: 'npm package',
        href: 'https://www.npmjs.com/package/zombie-mermaid',
      },
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

export interface ForkFixesPageProps {
  /**
   * The full stylesheet: tokens.tsx's `designBaseCss()`, primitives.tsx's
   * `primitivesCss()`, nav.tsx's `navCss()`, footer.tsx's `footerCss()`, and
   * demo/fork-fixes.css, in that order — see fork-fixes.ts's `generate()`.
   */
  css: string
  fixes: readonly FixSectionProps[]
  /**
   * The bundled `demo/theme-bar-only-client.ts` script (#687), inlined so
   * the page's `ThemePickerSection` is interactive.
   */
  themeBarScript: string
  /**
   * The bundled `demo/fork-fixes-client.tsx` entry (zombie-mermaid#802)
   * that hydrates {@link ForkFixesApp} and `<NavIsland>` (via `hydrateNav()`
   * — mirroring `dashboard-client.tsx`'s exact pattern: one bundle for both,
   * rather than a separate `nav-only-client.tsx` bundle paying for its own
   * copy of `react`/`react-dom` on top of this one). Inlined the same way
   * `themeBarScript` is. Defaults to `''` (no hydration script rendered at
   * all — SSR-only), matching `themeBarScript`'s own default; used by
   * existing tests that don't care about hydration. `fork-fixes.ts`'s real
   * `generate()` always passes the built bundle.
   */
  clientScript?: string
}

/** The whole fork-fixes.html document. */
export function ForkFixesPage({
  css,
  fixes,
  themeBarScript,
  clientScript = '',
}: ForkFixesPageProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>What this fork fixes — zombie-mermaid</title>
        <meta
          name="description"
          content="Before/after renders of bugs zombie-mermaid fixes over upstream beautiful-mermaid."
        />
        <link rel="icon" href="favicon.svg" type="image/svg+xml" />
        <DesignFontLinks />
        <style>{css}</style>
      </head>
      <body>
        <NavIsland
          sticky
          active="forkFixes"
          homeHref={HOME_HREF}
          hrefs={NAV_HREFS}
        />

        {/*
          Plain, inert hydration container -- see dashboard-app.tsx's
          DASHBOARD_ROOT_ID doc comment for why ForkFixesApp's own root
          can't carry this id itself.

          Rendered via `renderToString`, not JSX (`<ForkFixesApp .../>`)
          nested directly in this component's own tree, and spliced in with
          `dangerouslySetInnerHTML` -- because the *outer* document
          (everything else this component renders) still goes through
          render-html.ts's `renderToStaticMarkup`, which never emits the
          `<!-- -->` text-boundary comments `hydrateRoot()` needs to match
          adjacent text-node siblings. `renderToString`, called here just
          for this island, produces them. See dashboard-page.tsx's own,
          more detailed version of this comment (the pattern this mirrors).
        */}
        <div
          id={FORK_FIXES_ROOT_ID}
          dangerouslySetInnerHTML={{
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this page's own ForkFixesApp component tree rendered via renderToString (see the comment above); never user input
            __html: renderToString(<ForkFixesApp fixes={fixes} />),
          }}
        />
        <script
          type="application/json"
          id={FORK_FIXES_PROPS_ELEMENT_ID}
          dangerouslySetInnerHTML={{
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from this page's own ForkFixesAppProps, escaped with escapeJsonForScriptTag; never user input
            __html: escapeJsonForScriptTag(
              JSON.stringify({ fixes } satisfies ForkFixesAppProps),
            ),
          }}
        />

        {/*
          Plain sibling JSX, not part of ForkFixesApp's hydrated tree -- see
          this file's header comment and fork-fixes-app.tsx's for why (in
          short: ThemePickerSection/ThemePickerIsland imports
          react-dom/server, and nesting it inside FORK_FIXES_ROOT_ID would
          both leak that into the client bundle and double-hydrate
          #theme-pills -- the bug found and fixed during this issue's own
          investigation, on dashboard.html). ThemePicker's own hydration
          still works: theme-bar-only-client.ts's hydrateThemeBar() (bundled
          as themeBarScript below) finds and hydrates ThemePickerIsland's
          #theme-pills exactly as it does on every other page.
        */}
        <ThemePickerSection tinted />

        <Footer columns={FOOTER_COLUMNS} />
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/theme-bar-only-client.ts bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: themeBarScript }}
        />
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/fork-fixes-client.tsx bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: clientScript }}
        />
        <NavMobileMenuScript />
      </body>
    </html>
  )
}
