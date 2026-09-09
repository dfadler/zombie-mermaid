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
 */
import { renderToString } from 'react-dom/server'
import {
  buildDashboardViewModel,
  type DashboardData,
  type DashboardViewModel,
  type RepoMetricsView,
} from '../dashboard-model.ts'
import { escapeJsonForScriptTag } from '../format.ts'
import { Footer } from './footer.tsx'
import {
  ActivityIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
} from './icons.tsx'
import { Nav, NavCopyScript, NavMobileMenuScript } from './nav.tsx'
import { ThemePickerSection } from './theme-picker-section.tsx'
import { Card, CTA, SectionEyebrow, accentVar } from './primitives.tsx'
import {
  DesignFontLinks,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'

/** The fork's own repository. */
export const FORK_URL = 'https://github.com/dfadler/zombie-mermaid'
/** The upstream repository this fork tracks. */
export const UPSTREAM_URL = 'https://github.com/lukilabs/beautiful-mermaid'
/** The published package, linked from the footer's Resources column. */
const NPM_URL = 'https://www.npmjs.com/package/zombie-mermaid'

/**
 * The site's real routes, relative to dashboard.html's own location in the
 * built `site/` directory (see package.json's `build:site` script, which
 * moves every generator's output into one flat `site/` alongside `blog/`
 * and `diagrams/`).
 */
const ROUTES = {
  home: 'index.html',
  diagrams: 'diagrams/index.html',
  editor: 'editor.html',
  forkFixes: 'fork-fixes.html',
  blog: 'blog/',
} as const

/** The dark green ink primitives.tsx documents for a solid-green CTA/pill — see its `SOLID_INK` note. */
const GREEN_SOLID_INK = '#04140b'

/**
 * One repo's stat card: a label, a status glyph, and its six numbers.
 *
 * Takes a pre-built {@link RepoMetricsView} (not raw `RepoStats` +
 * `referenceIso`) so nothing in this render path calls a locale-sensitive
 * formatter itself — see `dashboard-model.ts`'s `DashboardViewModel` doc
 * comment for why that matters once this tree hydrates client-side (#799).
 */
export function RepoMetricsCard({
  label,
  entries,
  highlight = false,
}: RepoMetricsView) {
  // --text-faint here (opacity 0.75 on top of it) computes to a ~2.65:1
  // contrast ratio against the card background — well under WCAG AA's 3:1
  // floor even for this card's large 32px numbers. --text-dim clears ~4.44:1,
  // comfortably above 3:1 and effectively at the 4.5:1 normal-text threshold
  // too, while the opacity still reads as "muted" against the highlighted
  // fork card.
  const ink = highlight ? accentVar('green') : colorVar('--text-dim')
  return (
    <Card
      accent={highlight ? 'green' : undefined}
      padding={36}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${SPACE['7xl']}px`,
        opacity: highlight ? 1 : 0.75,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: `${SPACE.xl}px`,
        }}
      >
        <p
          style={{
            fontSize: `${FONT_SIZE.bodyLg}px`,
            fontWeight: FONT_WEIGHT.bold,
            letterSpacing: '0.02em',
            color: ink,
          }}
        >
          {label}
        </p>
        {highlight ? (
          <CheckIcon size={20} strokeWidth={2.4} />
        ) : (
          <ClockIcon size={20} strokeWidth={2.4} />
        )}
      </div>
      <div
        className="metric-stats"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: `${SPACE['5xl']}px`,
        }}
      >
        {entries.map(([value, metricLabel]) => (
          <div key={metricLabel}>
            <p className="display" style={{ fontSize: '32px', color: ink }}>
              {value}
            </p>
            <p
              style={{
                fontSize: `${FONT_SIZE.caption}px`,
                color: colorVar('--text-dim'),
              }}
            >
              {metricLabel}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

export interface MetricsSectionProps {
  fork: RepoMetricsView
  upstream: RepoMetricsView
}

/** The fork-vs-upstream section: two {@link RepoMetricsCard}s side by side. */
export function MetricsSection({ fork, upstream }: MetricsSectionProps) {
  return (
    <div
      id="metrics"
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.snug}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px`,
        background: colorVar('--bg-soft'),
        borderTop: `1px solid ${colorVar('--border')}`,
        borderBottom: `1px solid ${colorVar('--border')}`,
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
        <SectionEyebrow>Fork vs. upstream, side by side</SectionEyebrow>
        <h2
          style={{
            fontSize: `${FONT_SIZE.h2}px`,
            letterSpacing: LETTER_SPACING.heading,
          }}
        >
          The numbers, side by side.
        </h2>
        <p
          style={{
            fontSize: `${FONT_SIZE.lead}px`,
            color: colorVar('--text-dim'),
            maxWidth: '640px',
          }}
        >
          Same metrics, same source, no cherry-picking — this fork simply moves
          and upstream mostly doesn't.
        </p>
      </div>

      <div
        className="stats-grid"
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: `${SPACE['5xl']}px`,
        }}
      >
        <RepoMetricsCard {...fork} />
        <RepoMetricsCard {...upstream} />
      </div>
    </div>
  )
}

/**
 * The "Rescued issues" teaser: a single card naming the idea and linking to
 * the Fork Fixes page, without a specific count — see this module's header
 * comment on why no number appears here.
 */
export function RescuedTeaser() {
  return (
    <div
      id="rescued"
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.loose}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px`,
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
        <SectionEyebrow>Bugs upstream never got to</SectionEyebrow>
        <h2
          style={{
            fontSize: `${FONT_SIZE.h2}px`,
            letterSpacing: LETTER_SPACING.heading,
          }}
        >
          Still broken upstream. Fixed here.
        </h2>
      </div>

      <Card
        className="rescued-card"
        padding={32}
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: `${SPACE['3xl']}px`,
          background: `linear-gradient(90deg, ${colorVar('--panel')} 0%, ${colorVar('--panel-2')} 100%)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${SPACE['2xl']}px`,
          }}
        >
          <ActivityIcon size={34} strokeWidth={1.8} />
          <div>
            <h3 style={{ fontSize: `${FONT_SIZE.subhead}px` }}>
              Rescued issues
            </h3>
            <p
              style={{
                fontSize: '14.5px',
                color: colorVar('--text-dim'),
                maxWidth: '560px',
              }}
            >
              Some bugs reported against upstream beautiful-mermaid never got
              fixed there. A number of them are already fixed in this fork —
              each one documented before/after on the fork-fixes evidence page.
            </p>
          </div>
        </div>
        <CTA
          href={ROUTES.forkFixes}
          accent="green"
          style={{ color: GREEN_SOLID_INK, whiteSpace: 'nowrap' }}
        >
          See what's fixed
        </CTA>
      </Card>
    </div>
  )
}

export interface ResponseTimeSectionProps {
  responseTime: DashboardData['responseTime']
}

/** How quickly a newly opened issue gets a first reply — real data, not on the design canvas (see this module's header comment). */
export function ResponseTimeSection({
  responseTime,
}: ResponseTimeSectionProps) {
  return (
    <div
      id="response"
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.tight}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.snug}px ${LAYOUT.gutter.desktop}px`,
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `0 auto ${SPACE['5xl']}px auto`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <SectionEyebrow>How fast issues get a first reply</SectionEyebrow>
        <h2
          style={{
            fontSize: `${FONT_SIZE.h3}px`,
            letterSpacing: LETTER_SPACING.heading,
          }}
        >
          Response time
        </h2>
      </div>

      <div style={{ maxWidth: `${LAYOUT.maxWidth}px`, margin: '0 auto' }}>
        {responseTime === null ? (
          <p
            style={{
              fontSize: `${FONT_SIZE.body}px`,
              color: colorVar('--text-dim'),
            }}
          >
            No recent issue with a first comment was found to sample.
          </p>
        ) : (
          <Card
            padding={28}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${SPACE['3xl']}px`,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <p
                className="display"
                style={{ fontSize: '32px', color: accentVar('cyan') }}
              >
                {responseTime.medianHours < 1 ? '<1' : responseTime.medianHours}
                h
              </p>
              <p
                style={{
                  fontSize: `${FONT_SIZE.caption}px`,
                  color: colorVar('--text-dim'),
                }}
              >
                Median time to first response (n={responseTime.sampleSize})
              </p>
            </div>
            <p
              style={{
                fontSize: `${FONT_SIZE.bodySm}px`,
                color: colorVar('--text-dim'),
                maxWidth: '34rem',
              }}
            >
              {responseTime.note}
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}

const PAGE_DESCRIPTION =
  "A factual, snapshot comparison of zombie-mermaid's maintenance activity against upstream beautiful-mermaid: commit recency, issue/PR throughput, and bugs fixed here that remain open upstream."

/**
 * `dashboard-root`: id of the *hydration container* `demo/dashboard-
 * client.tsx`'s `hydrateRoot()` call mounts onto (zombie-mermaid#799) — a
 * plain wrapper `<div>` {@link DashboardPage} renders directly, not part of
 * {@link DashboardApp}'s own render output. This has to be a separate
 * element from `DashboardApp`'s own root: `hydrateRoot(container, node)`
 * treats `container` as inert and expects *its children* to match what
 * `node` renders — if `DashboardApp` itself carried this id and was then
 * hydrated with `document.getElementById(DASHBOARD_ROOT_ID)` as its own
 * container, React would try to match `<DashboardApp>`'s rendered root
 * against the *existing* root's own children instead of against the root
 * itself, throwing a real hydration-mismatch error despite the server and
 * client trees being logically identical. (Caught by
 * `__tests__/dom/dashboard-hydration.test.ts` while building this pattern —
 * exactly the kind of bug that test exists to catch.)
 */
export const DASHBOARD_ROOT_ID = 'dashboard-root'

/**
 * `dashboard-props`: the `<script type="application/json">` element
 * `demo/dashboard-client.tsx` reads {@link DashboardViewModel} out of. See
 * that module's doc comment, and `dashboard-model.ts`'s
 * `DashboardViewModel` doc comment for why the *view model* (not raw
 * `DashboardData`) is what gets embedded and hydrated against.
 */
export const DASHBOARD_PROPS_ELEMENT_ID = 'dashboard-props'

export interface DashboardAppProps {
  viewModel: DashboardViewModel
}

/**
 * Everything inside {@link DASHBOARD_ROOT_ID}'s hydration boundary: hero,
 * metrics, rescued-issues teaser, response time, the theme picker, and the
 * footer. Extracted as its own component — rather than left inline in
 * {@link DashboardPage} — so the exact same function can run on both sides
 * of hydration: {@link DashboardPage} renders it server-side (nested inside
 * the {@link DASHBOARD_ROOT_ID} container, itself inside a full document),
 * and `demo/dashboard-client.tsx` passes it straight to `hydrateRoot()`
 * client-side, targeting that same container. Takes a pre-built
 * {@link DashboardViewModel}, not raw `DashboardData` — see that type's doc
 * comment for why the client must never recompute a formatted string
 * itself.
 *
 * Deliberately does **not** include `<Nav>` (zombie-mermaid#799): `Nav`'s
 * install-pill copy behavior still comes from `NAV_COPY_SCRIPT`
 * (nav.tsx) — a plain, un-hydrated inline script (#800 is the sub-issue
 * that replaces it with real React state) that runs synchronously during
 * HTML parsing and mutates that pill's DOM (adds `role`/`tabindex`/
 * `aria-label`, sets several inline style properties) *before* this page's
 * `type="module"` hydration script gets a chance to run (module scripts are
 * deferred until after parsing, same as `defer`). If `<Nav>` sat inside the
 * hydrated tree, `hydrateRoot()` would find that already-mutated DOM and
 * throw a real "hydrated but some attributes... didn't match" error — this
 * was caught for real (not by test/reasoning alone) via a manual browser
 * check with `read_console_messages`, exactly the "no hydration-mismatch
 * warnings in a real browser" acceptance criterion this issue calls for.
 * `DashboardPage` therefore keeps rendering `<Nav>` as static, unhydrated
 * SSR output, outside {@link DASHBOARD_ROOT_ID} entirely — the same way
 * every other page still will until #800 lands, which is what makes Nav
 * hydration a separate, already-sequenced sub-issue rather than something
 * this one needs to also solve.
 */
export function DashboardApp({ viewModel }: DashboardAppProps) {
  return (
    <>
      <div
        className="section-px"
        style={{
          padding: `${SECTION_SPACE.loose}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.tight}px ${LAYOUT.gutter.desktop}px`,
        }}
      >
        <div
          style={{
            maxWidth: `${LAYOUT.maxWidth}px`,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE['3xl']}px`,
          }}
        >
          <div
            className="mono"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${SPACE.sm}px`,
              fontSize: '13.5px',
              color: colorVar('--text-faint'),
            }}
          >
            <a href={ROUTES.home} style={{ color: colorVar('--text-faint') }}>
              Home
            </a>
            <ChevronRightIcon size={12} strokeWidth={2.4} />
            <span style={{ color: colorVar('--text-dim') }}>Dashboard</span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: `${SPACE.xl}px`,
            }}
          >
            <SectionEyebrow>
              Sourced from the GitHub API, not hand-tallied
            </SectionEyebrow>
            <h1
              className="page-h1"
              style={{
                fontSize: `${FONT_SIZE.h1}px`,
                lineHeight: 1.1,
                letterSpacing: LETTER_SPACING.heading,
                maxWidth: '820px',
              }}
            >
              Still shipping every week. Upstream mostly isn't.
            </h1>
            <p
              style={{
                fontSize: `${FONT_SIZE.lead}px`,
                lineHeight: 1.6,
                color: colorVar('--text-dim'),
                maxWidth: '680px',
              }}
            >
              A factual comparison of this fork's maintenance activity against{' '}
              <a href={UPSTREAM_URL}>upstream beautiful-mermaid</a> — commit
              recency, issue and PR throughput, and bugs fixed here that are
              still open upstream. Every number below is pulled straight from
              each repo's GitHub API, not hand-tallied.
            </p>
          </div>

          <div
            className="mono"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${SPACE.sm}px`,
              fontSize: `${FONT_SIZE.label}px`,
              color: colorVar('--text-faint'),
            }}
          >
            <ClockIcon size={13} strokeWidth={2} />
            <span>
              Snapshot as of {viewModel.generatedAtDisplay} — refreshed
              periodically, not live. See{' '}
              <a
                href={`${FORK_URL}/blob/main/scripts/generate-dashboard-data.ts`}
              >
                generate-dashboard-data.ts
              </a>
              .
            </span>
          </div>
        </div>
      </div>

      <MetricsSection fork={viewModel.fork} upstream={viewModel.upstream} />
      <RescuedTeaser />
      <ResponseTimeSection responseTime={viewModel.responseTime} />

      <ThemePickerSection />

      <Footer
        columns={[
          {
            title: 'Product',
            links: [
              { label: 'Diagrams', href: ROUTES.diagrams },
              { label: 'Editor', href: ROUTES.editor },
              { label: 'Fork fixes', href: ROUTES.forkFixes },
            ],
          },
          {
            title: 'Resources',
            links: [
              { label: 'Blog', href: ROUTES.blog },
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
        ]}
      />
    </>
  )
}

export interface DashboardPageProps {
  data: DashboardData
  /** The page's full stylesheet — tokens/primitives/nav/footer CSS plus this page's own (see dashboard.ts). */
  css: string
  /**
   * The bundled `demo/theme-bar-only-client.ts` script (#687), inlined so
   * the page's `ThemePickerSection` is interactive. This page has nothing
   * of its own to re-theme (a static data snapshot, not a diagram) — the
   * picker here exists so a theme chosen elsewhere on the site stays
   * selected if a visitor lands here, and vice versa (shared `demo/
   * theme-state.ts` persistence).
   */
  themeBarScript: string
  /**
   * The bundled `demo/dashboard-client.tsx` entry (zombie-mermaid#799) that
   * hydrates {@link DashboardApp}, inlined the same way `themeBarScript`
   * is — see `dashboard.ts`'s `bundleDashboardClient()` doc comment for why
   * this is inlined rather than written to `assets/` and referenced by
   * `src`. Defaults to `''` (no hydration script rendered at all — SSR-only,
   * same as before #799), matching `themeBarScript`'s own default; used by
   * existing tests that don't care about hydration. `dashboard.ts`'s real
   * `generate()` always passes the built bundle.
   */
  clientScript?: string
}

export function DashboardPage({
  data,
  css,
  themeBarScript,
  clientScript = '',
}: DashboardPageProps) {
  const viewModel = buildDashboardViewModel(data)
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Maintenance dashboard — zombie-mermaid</title>
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
            overflow: 'hidden',
          }}
        >
          {/*
            Static, un-hydrated -- see DashboardApp's doc comment for why
            Nav specifically stays outside the hydration boundary as of
            #799 (its install-pill copy behavior isn't hydrated until #800).
          */}
          <Nav
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
            Plain, inert hydration container -- see DASHBOARD_ROOT_ID's doc
            comment for why DashboardApp's own root can't carry this id
            itself.

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
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this page's own DashboardApp component tree rendered via renderToString (see the comment above); never user input
            dangerouslySetInnerHTML={{
              __html: renderToString(<DashboardApp viewModel={viewModel} />),
            }}
          />
        </div>
        <script
          type="application/json"
          id={DASHBOARD_PROPS_ELEMENT_ID}
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from this page's own DashboardViewModel, escaped with escapeJsonForScriptTag; never user input
          dangerouslySetInnerHTML={{
            __html: escapeJsonForScriptTag(JSON.stringify(viewModel)),
          }}
        />
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/theme-bar-only-client.ts bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: themeBarScript }}
        />
        <NavCopyScript />
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
