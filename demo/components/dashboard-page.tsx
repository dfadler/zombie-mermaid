/** @jsxRuntime automatic */
/**
 * The maintenance-transparency dashboard page (dashboard.ts → dashboard.html)
 * rebuilt in the #590 shared visual system (#610) — replacing the bare
 * "← back to the gallery" link and the old `--t-*`-themed `.dash-*` markup
 * with the shared Nav/Footer (#593/#594) and the design canvas's dark,
 * card-based layout (#592 tokens, #595 primitives, #596 icons).
 *
 * Every real number below is still `demo/dashboard-model.ts`'s
 * `DashboardData`, sourced unchanged from the committed
 * `demo/dashboard-data.json` snapshot (see dashboard.ts's header comment and
 * scripts/generate-dashboard-data.ts) — this redesign changes only how that
 * data is displayed, never how it is produced. The one section the canvas's
 * `Dashboard.dc.html` artboard shows without a number — "Rescued issues" —
 * stays deliberately generic here too: no rescued-issue count has been
 * confirmed accurate, so the teaser card names the idea ("a number of
 * them") rather than a figure, exactly as the canvas's own copy does (it
 * does not put a number in that card either).
 *
 * The canvas has no "Response time" section. This page keeps one anyway —
 * it is real data (`DashboardData['responseTime']`) the pre-redesign page
 * already showed, and dropping it would be a silent feature regression the
 * design source never asked for. It is reskinned to match everything else
 * on the page (a `Card`, the shared type scale) rather than left in the old
 * `.dash-response` styling it used before.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 *
 * As of zombie-mermaid#799, this file holds only the page *shell*
 * (`<html>`/`<head>`, static `<Nav>`, the hydration container/script
 * wiring) — the hydrated body content (hero, metrics, response time, ...)
 * lives in `dashboard-app.tsx`'s `DashboardApp`, split out specifically so
 * `demo/dashboard-client.tsx` (the browser bundle) never needs to import
 * this file, and therefore never pulls in `react-dom/server` (used below
 * for `renderToString`) into the client bundle. See `dashboard-app.tsx`'s
 * own header comment for the measured bundle-size impact.
 *
 * `<Footer>` renders here too (as a plain sibling of the {@link
 * DASHBOARD_ROOT_ID} container, inside the same `dc-root` wrapper
 * `DashboardApp`'s own hydrated content sits in — so the visible layout is
 * unchanged), rather than inside `DashboardApp`'s tree — it has no
 * client-side behavior of its own, so nothing is lost.
 */
import { renderToString } from 'react-dom/server'
import {
  buildDashboardViewModel,
  type DashboardData,
} from '../dashboard-model.ts'
import { escapeJsonForScriptTag } from '../format.ts'
import {
  DashboardApp,
  DASHBOARD_PROPS_ELEMENT_ID,
  DASHBOARD_ROOT_ID,
  FORK_URL,
  ROUTES,
  dashboardFooterColumns,
} from './dashboard-app.tsx'
import { Footer } from './footer.tsx'
import { NavMobileMenuScript } from './nav.tsx'
import { NavIsland } from './nav-island.tsx'
import { DesignFontLinks, colorVar } from './tokens.tsx'

// Re-exported for existing callers/tests that import these from
// dashboard-page.tsx rather than dashboard-app.tsx directly (this file was
// the sole home for all of them before the #799 split).
export {
  DashboardApp,
  DASHBOARD_PROPS_ELEMENT_ID,
  DASHBOARD_ROOT_ID,
  FORK_URL,
  UPSTREAM_URL,
  ROUTES,
  MetricsSection,
  RepoMetricsCard,
  RescuedTeaser,
  ResponseTimeSection,
  type DashboardAppProps,
  type MetricsSectionProps,
  type ResponseTimeSectionProps,
} from './dashboard-app.tsx'

const PAGE_DESCRIPTION =
  "A factual, snapshot comparison of zombie-mermaid's maintenance activity against upstream beautiful-mermaid: commit recency, issue/PR throughput, and bugs fixed here that remain open upstream."

export interface DashboardPageProps {
  data: DashboardData
  /** The page's full stylesheet — tokens/primitives/nav/footer CSS plus this page's own (see dashboard.ts). */
  css: string
  /**
   * The bundled `demo/dashboard-client.tsx` entry (zombie-mermaid#799) that
   * hydrates {@link DashboardApp} — see `dashboard.ts`'s
   * `bundleDashboardClient()` doc comment for why this is inlined rather
   * than written to `assets/` and referenced by `src`. Defaults to `''` (no
   * hydration script rendered at all — SSR-only, same as before #799),
   * used by existing tests that don't care about hydration. `dashboard.ts`'s
   * real `generate()` always passes the built bundle.
   */
  clientScript?: string
}

export function DashboardPage({
  data,
  css,
  clientScript = '',
}: DashboardPageProps) {
  const viewModel = buildDashboardViewModel(data)
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Maintenance dashboard — Zombie Mermaid</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <link rel="icon" href="favicon.svg" type="image/svg+xml" />
        <DesignFontLinks />
        <style>{css}</style>
      </head>
      <body>
        <div
          className="dc-root"
          style={{
            width: '100%',
            maxWidth: '1440px',
            margin: '0 auto',
            // var()-based, not the canvas's literal '#0a0d16'/'#0d1120': a
            // fixed gradient here would leave a static dark band behind on
            // every non-default theme (#772's site-chrome re-theming). The
            // middle stop reuses --bg-soft, already defined for exactly
            // this "lifted page background" role (tokens.tsx).
            background: `linear-gradient(180deg, ${colorVar('--bg')} 0%, ${colorVar('--bg-soft')} 40%, ${colorVar('--bg')} 100%)`,
            position: 'relative',
          }}
        >
          {/*
            Its own hydration island (zombie-mermaid#800), separate from
            DASHBOARD_ROOT_ID -- see DashboardApp's doc comment
            (dashboard-app.tsx) for why Nav still isn't part of that
            boundary, and dashboard-client.tsx for where it's hydrated.
          */}
          <NavIsland
            sticky
            homeHref={ROUTES.home}
            hrefs={{
              diagrams: ROUTES.diagrams,
              editor: ROUTES.editor,
              forkFixes: ROUTES.forkFixes,
              blog: ROUTES.blog,
              github: FORK_URL,
            }}
          />
          {/*
            `overflow: hidden` used to live on the `.dc-root` div itself,
            but that made it an ancestor of the sticky `<NavIsland>` above —
            an `overflow` other than `visible` on any ancestor stops
            `position: sticky` from ever un-sticking from its static
            position, since the sticky element's nearest clipping ancestor
            is what its "stuck" offset is computed against, and this div
            was never itself the one scrolling. Scoping the clip to this
            inner wrapper (a sibling of NavIsland, not an ancestor) keeps
            whatever this was guarding against contained without breaking
            the header's stickiness.
          */}
          <div style={{ overflow: 'hidden' }}>
            {/*
            Plain, inert hydration container -- see DASHBOARD_ROOT_ID's doc
            comment (dashboard-app.tsx) for why DashboardApp's own root
            can't carry this id itself.

            Rendered via `renderToString`, not JSX (`<DashboardApp .../>`)
            nested directly in this component's own tree, and spliced in
            with `dangerouslySetInnerHTML` -- because the *outer* document
            (everything `renderHtmlDocument` in dashboard.ts renders) still
            goes through `renderToStaticMarkup`, which by design never
            emits the `<!-- -->` boundary comments React inserts between
            adjacent text-node siblings (see render-html.ts's own header
            comment: "these pages are never hydrated"). Without those
            comments, the HTML parser merges e.g. this page's hero
            paragraph's several JSX text/expression children ("Snapshot as
            of ", {generatedAtDisplay}, " — refreshed...") into one merged
            DOM text node, and `hydrateRoot()` then can't match it against
            the *separate* text nodes its own render pass expects -- a real
            hydration-mismatch error, caught by
            __tests__/dom/dashboard-hydration.test.ts while building this
            pattern. Calling `renderToString` explicitly for just this
            subtree (still exactly the same DashboardApp component/props
            the client hydrates against) produces those comments; splicing
            the result in via `dangerouslySetInnerHTML` keeps everything
            *outside* this container on the simpler, unchanged
            `renderToStaticMarkup` path, rather than switching the whole
            document (every other page's markup too) onto `renderToString`
            in this one issue. Later #797 sub-issues hydrating other pages
            copy this same `renderToString`-for-the-hydrated-island
            approach.
          */}
            <div
              id={DASHBOARD_ROOT_ID}
              dangerouslySetInnerHTML={{
                // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this page's own DashboardApp component tree rendered via renderToString (see the comment above); never user input
                __html: renderToString(<DashboardApp viewModel={viewModel} />),
              }}
            />

            <Footer columns={dashboardFooterColumns()} />
          </div>
        </div>
        <script
          type="application/json"
          id={DASHBOARD_PROPS_ELEMENT_ID}
          dangerouslySetInnerHTML={{
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from this page's own DashboardViewModel, escaped with escapeJsonForScriptTag; never user input
            __html: escapeJsonForScriptTag(JSON.stringify(viewModel)),
          }}
        />
        <NavMobileMenuScript />
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/dashboard-client.tsx bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: clientScript }}
        />
      </body>
    </html>
  )
}
