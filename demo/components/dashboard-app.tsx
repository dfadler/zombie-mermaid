/** @jsxRuntime automatic */
/**
 * The maintenance-transparency dashboard's *hydrated* content: everything
 * inside {@link DASHBOARD_ROOT_ID}'s hydration boundary (hero, metrics,
 * rescued-issues teaser, response time, the theme picker, the footer) --
 * split out from `dashboard-page.tsx`'s `DashboardPage` (zombie-mermaid#799)
 * specifically so this file, and everything it imports, never touches
 * `react-dom/server`.
 *
 * That split matters for real: `demo/dashboard-client.tsx` (the browser
 * hydration entry `dashboard.ts` bundles) imports {@link DashboardApp} from
 * *this* file, not from `dashboard-page.tsx`. `dashboard-page.tsx` imports
 * `renderToString` from `react-dom/server` for its own SSR-only purposes
 * (see that file's header comment); if `DashboardApp` still lived there,
 * the client bundle would import the whole `dashboard-page.tsx` module too
 * and drag `react-dom/server` in along with it -- confirmed while building
 * this: before this split, the bundled hydration script's minified/gzipped
 * size was ~118 KB gzip, well over the #797 epic issue's own measured
 * "~57.5 KB gzip" floor for `react` + `react-dom/client` alone. After the
 * split it's much closer to that floor (see this issue's PR description for
 * the exact before/after numbers) -- `react-dom/server` and its own,
 * separate weight simply isn't reachable from the client entry point
 * anymore.
 *
 * Design/content provenance (the #590 canvas, #592/#595/#596 tokens etc.)
 * is unchanged from before this split -- see `dashboard-page.tsx`'s own
 * header comment, which still applies to everything rendered here.
 */
import {
  type DashboardData,
  type DashboardViewModel,
  type RepoMetricsView,
} from '../dashboard-model.ts'
import { Footer } from './footer.tsx'
import {
  ActivityIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
} from './icons.tsx'
import { ThemePickerSection } from './theme-picker-section.tsx'
import { Card, CTA, SectionEyebrow, accentVar } from './primitives.tsx'
import {
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
export const ROUTES = {
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
 * the Fork Fixes page, without a specific count — see `dashboard-page.tsx`'s
 * header comment on why no number appears here.
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

/** How quickly a newly opened issue gets a first reply — real data, not on the design canvas (see `dashboard-page.tsx`'s header comment). */
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

/**
 * `dashboard-root`: id of the *hydration container* `demo/dashboard-
 * client.tsx`'s `hydrateRoot()` call mounts onto (zombie-mermaid#799) — a
 * plain wrapper `<div>` `dashboard-page.tsx`'s `DashboardPage` renders
 * directly, not part of {@link DashboardApp}'s own render output. This has
 * to be a separate element from `DashboardApp`'s own root:
 * `hydrateRoot(container, node)` treats `container` as inert and expects
 * *its children* to match what `node` renders — if `DashboardApp` itself
 * carried this id and was then hydrated with
 * `document.getElementById(DASHBOARD_ROOT_ID)` as its own container, React
 * would try to match `<DashboardApp>`'s rendered root against the
 * *existing* root's own children instead of against the root itself,
 * throwing a real hydration-mismatch error despite the server and client
 * trees being logically identical. (Caught by
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
 * footer. The exact same function runs on both sides of hydration:
 * `dashboard-page.tsx`'s `DashboardPage` renders it server-side (nested
 * inside the {@link DASHBOARD_ROOT_ID} container, itself inside a full
 * document), and `demo/dashboard-client.tsx` passes it straight to
 * `hydrateRoot()` client-side, targeting that same container. Takes a
 * pre-built {@link DashboardViewModel}, not raw `DashboardData` — see that
 * type's doc comment for why the client must never recompute a formatted
 * string itself.
 *
 * Deliberately does **not** include `<Nav>`. As of #799, that was because
 * `Nav`'s install-pill copy behavior still came from `NAV_COPY_SCRIPT`, a
 * plain, un-hydrated inline script that ran synchronously during HTML
 * parsing and mutated that pill's DOM (`role`/`tabindex`/`aria-label`,
 * several inline style properties) *before* this page's `type="module"`
 * hydration script got a chance to run (module scripts are deferred until
 * after parsing, same as `defer`) — if `<Nav>` had sat inside the hydrated
 * tree, `hydrateRoot()` would have found that already-mutated DOM and
 * thrown a real "hydrated but some attributes... didn't match" error (this
 * was caught for real, not by test/reasoning alone, via a manual browser
 * check with `read_console_messages`).
 *
 * `NAV_COPY_SCRIPT` is gone as of #800 — `Nav`'s copy button is real React
 * state now — but `<Nav>` *still* isn't part of this component: it hydrates
 * as its own separate island (`demo/components/nav-island.tsx`'s
 * `NavIsland`, `NAV_ROOT_ID`, mounted by `dashboard-client.tsx`'s
 * {@link hydrateNav}) rather than moving inside {@link DASHBOARD_ROOT_ID}'s
 * boundary. That keeps every page's Nav hydration on one shared, uniform
 * path (`nav-client.tsx`) regardless of whether the rest of that page is
 * hydrated at all — dashboard.html happens to also hydrate `DashboardApp`,
 * but editor.html/index.html/fork-fixes.html/blog/diagrams pages hydrate
 * *only* Nav, and giving dashboard.html a special "Nav folded into the main
 * app" shape it alone has isn't worth the inconsistency it would add for a
 * component with no cross-island state to share.
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
