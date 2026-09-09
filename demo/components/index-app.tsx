/** @jsxRuntime automatic */
/**
 * The homepage's *hydrated* content (zombie-mermaid#804): {@link
 * IndexHeroApp} (headline, subhead, the animated hero visual, CTAs) and
 * {@link IndexMainApp} (the feature grid, CLI/MCP section, diagram gallery
 * teaser, proof section, and blog teaser). Split out of `index-page.tsx`
 * (which used to be a full-document owner, like `dashboard-page.tsx` was
 * pre-#799) specifically so this file, and everything it imports, never
 * touches `react-dom/server` — mirroring `dashboard-app.tsx`'s split.
 *
 * Two apps, not one, because {@link ThemeShowcase} sits *between* the hero
 * and the feature grid in `<main>`'s actual document order, and it can
 * never be part of either app: `ThemeShowcase` renders `<ThemePickerIsland>`
 * (`theme-picker-island.tsx`), which imports `react-dom/server` for its own
 * SSR-only purposes, and also calls `renderMermaidSVG` (`src/index.ts`) at
 * render time to produce its live diagram — pulling either into a client
 * bundle would leak `react-dom/server` (the exact #802-investigation bug
 * `dashboard-app.tsx`'s header comment documents) and/or drag this
 * package's whole parser/renderer into the homepage's hydration script for
 * zero benefit (the diagram is static, build-time-only content once
 * rendered). `ThemeShowcase` therefore stays in `index-page.tsx` as a
 * plain sibling *between* the two apps below — its own `#theme-pills`
 * picker keeps hydrating exactly as it does today, via `demo/index-page-
 * client.ts`'s `hydrateThemeBar()` (unchanged by this issue) — while
 * `<NavIsland>`/`<Footer>` are plain siblings too, for the same
 * reason `dashboard-page.tsx`/`fork-fixes-page.tsx`/`blog-page.tsx` keep
 * them out of their own hydrated trees.
 *
 * Neither app takes any props: every diagram-type/feature/proof-snapshot/
 * latest-post value below is a fixed marketing constant, not per-render
 * data (contrast `DashboardApp`'s `viewModel` or `ForkFixesApp`'s
 * `fixes`) — so there is nothing to serialize into a `<script
 * type="application/json">` props element, and `demo/index-client.tsx`
 * calls `hydrateRoot()` with no props to read back. The page's one piece
 * of real per-build data, the `SoftwareApplication` JSON-LD block, lives
 * entirely in `<head>` (never inside either app's `<body>` hydration
 * boundary — no page's `<head>` is ever part of a `hydrateRoot()` call
 * anywhere in this codebase) and stays untouched, rendered by `index-
 * page.tsx`'s shell exactly as before this split.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { ReactNode } from 'react'
import { FORK_URL } from './site-chrome.tsx'
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
import {
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'

const NPM_INSTALL_COMMAND = 'npm install zombie-mermaid'

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

/**
 * `index-hero-root`: id of {@link IndexHeroApp}'s hydration container —
 * a plain wrapper `<div>` `index-page.tsx`'s `IndexPage` renders directly,
 * not part of {@link IndexHeroApp}'s own render output. See `dashboard-
 * app.tsx`'s `DASHBOARD_ROOT_ID` doc comment for why this has to be a
 * separate element from the app's own root.
 */
export const INDEX_HERO_ROOT_ID = 'index-hero-root'

/**
 * `index-main-root`: id of {@link IndexMainApp}'s hydration container —
 * see {@link INDEX_HERO_ROOT_ID}'s doc comment for the same reasoning.
 */
export const INDEX_MAIN_ROOT_ID = 'index-main-root'

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
export function IndexHeroApp() {
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
 * The showcase's build-time diagram, rendered once in
 * {@link THEME_SHOWCASE_DEFAULT_THEME}'s colours (the client script
 * re-themes it live from there — see this file's header comment). Thrown,
 * not a silent fallback: this only ever runs at `index.ts` generation time
 * under Node, so a typo'd theme key should fail the build loudly rather
 * than ship a broken page.
 */
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

/**
 * Everything inside {@link INDEX_MAIN_ROOT_ID}'s hydration boundary: the
 * feature grid, CLI/MCP section, diagram gallery teaser, proof section,
 * and blog teaser — the same five components `index-page.tsx`'s
 * `IndexPage` used to render directly in `<main>`, in the same order. The
 * exact same function runs on both sides of hydration — see `dashboard-
 * app.tsx`'s {@link DashboardApp} doc comment for the general shape this
 * follows. No props: see this file's header comment for why.
 */
export function IndexMainApp() {
  return (
    <>
      <FeatureGrid />
      <CliMcpSection />
      <DiagramGalleryTeaser />
      <ProofSection />
      <BlogTeaser />
    </>
  )
}
