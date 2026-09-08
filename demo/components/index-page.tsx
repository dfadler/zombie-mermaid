/** @jsxRuntime automatic */
/**
 * The sample gallery (index.ts → index.html) as React components — the
 * largest page in #589's move of every site generator off template-literal
 * HTML.
 *
 * Pure functions of already-computed data. index.ts keeps everything that
 * needs I/O or a build step — reading and re-indenting the stylesheet,
 * building the JSON-LD block, bundling src/browser.ts and demo/client.ts,
 * and pre-highlighting every sample's source with shiki — and hands the
 * results here. The page stays a static document: the interactivity is
 * demo/client.ts, still a separately bundled vanilla script this shell
 * splices into one `<script type="module">` (see
 * docs/decisions/react-site-migration-plan.md — demo/client.ts's own
 * migration is explicitly out of scope for #589).
 *
 * Three things arrive as raw HTML and are spliced in with
 * `dangerouslySetInnerHTML`: shiki's highlighted source, `formatDescription`'s
 * `<code>`-annotated prose, and the bundled scripts. All three are build-time
 * output of this repo's own tooling over files under version control, never
 * user input. Each is attached to the element that already carries the class
 * it needs, so no extra wrapper element is introduced.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FontLinks, FORK_URL, GitHubMarkIcon } from './site-chrome.tsx'
import { ThemePicker } from './theme-picker.tsx'

const NPM_URL = 'https://www.npmjs.com/package/zombie-mermaid'
const MERMAID_ASCII_URL = 'https://github.com/AlexanderGrooff/mermaid-ascii'

/** One entry in a sidebar category group. */
export interface SidebarItem {
  /** The sample's index in samples-data.ts, used for the `#sample-N` anchor. */
  index: number
  /** The number shown to the reader, which skips the Hero samples. */
  displayNum: number
  /** The sample's title, with its redundant category prefix stripped. */
  title: string
}

/** One regular (non-Hero) sample card. */
export interface SampleCard {
  index: number
  title: string
  /** `description` run through `formatDescription` (backticks → `<code>`). */
  descriptionHtml: string
  /** shiki's highlighted Mermaid source, fences already stripped. */
  highlightedSourceHtml: string
  /** `JSON.stringify(sample.options)`, or null when the sample has none. */
  optionsJson: string | null
  /** `options.bg`, stored for "Default" theme restoration; '' when unset. */
  bg: string
}

/** One category: its sidebar group and its (initially hidden) card view. */
export interface CategorySection {
  label: string
  slug: string
  items: SidebarItem[]
  cards: SampleCard[]
}

/** The Hero sample's before/after showcase. */
export interface HeroCard {
  index: number
  /** shiki's highlighted Hero source, in the github-dark theme. */
  codeHtml: string
  bg: string
}

/**
 * The sidebar: one collapsible group per category, each listing its samples.
 *
 * The first category is the default active/expanded one — matching the
 * category view shown on initial load, before JS reads location.hash.
 */
export function Sidebar({ categories }: { categories: CategorySection[] }) {
  return (
    <nav className="sidebar" id="sidebar" aria-label="Sample navigation">
      <div className="sidebar-search">
        <label htmlFor="sample-search" className="visually-hidden">
          Search samples by title, diagram type, or description
        </label>
        <div className="sidebar-search-field">
          <svg
            className="sidebar-search-icon"
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="7" cy="7" r="5" />
            <line x1="10.8" y1="10.8" x2="14.5" y2="14.5" />
          </svg>
          <input
            type="search"
            id="sample-search"
            className="sidebar-search-input"
            placeholder="Search samples…"
            autoComplete="off"
            spellCheck="false"
          />
          <button
            type="button"
            className="sidebar-search-clear"
            id="sidebar-search-clear"
            aria-label="Clear search"
            hidden
          >
            ×
          </button>
        </div>
        <div
          className="sidebar-search-status"
          id="sidebar-search-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        />
      </div>
      {categories.map((category, categoryIndex) => (
        <details
          className="sidebar-group"
          data-category-slug={category.slug}
          data-category-label={category.label}
          open={categoryIndex === 0}
          key={category.slug}
        >
          <summary>
            {category.label}{' '}
            <span className="sidebar-group-count">
              ({category.items.length})
            </span>
          </summary>
          <ol className="sidebar-list" start={category.items[0]?.displayNum}>
            {category.items.map((item) => (
              <li key={item.index}>
                <a href={`#sample-${item.index}`}>
                  <span className="sidebar-num">{item.displayNum}.</span>{' '}
                  {item.title}
                </a>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </nav>
  )
}

/**
 * The Hero sample: its raw source (left/top) transforming into the live,
 * theme-reactive rendered diagram (right/bottom) — no header or ASCII panel,
 * since this is a showcase, not a browsable sample.
 */
export function HeroSample({ card }: { card: HeroCard }) {
  const gradientId = `hero-arrow-grad-${card.index}`
  return (
    <section className="sample sample-hero" id={`sample-${card.index}`}>
      <div className="hero-transform">
        <div className="hero-code-panel">
          <div className="hero-code-titlebar">
            <span className="hero-code-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </span>
            <span className="hero-code-title">pipeline.mmd</span>
          </div>
          <div
            className="hero-code-body"
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- shiki output for a build-time sample in samples-data.ts, never user input
            dangerouslySetInnerHTML={{ __html: card.codeHtml }}
          />
        </div>
        <div className="hero-arrow" aria-hidden="true">
          <span className="hero-arrow-caption">renders as</span>
          <svg className="hero-arrow-icon" viewBox="0 0 56 56" fill="none">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#9570BE" />
                <stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <line
              x1="4"
              y1="28"
              x2="44"
              y2="28"
              stroke={`url(#${gradientId})`}
              strokeWidth="2.5"
              strokeLinecap="round"
              className="hero-arrow-dash"
            />
            <path
              d="M36 16 L52 28 L36 40"
              stroke={`url(#${gradientId})`}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        <div
          className="hero-diagram-panel"
          id={`svg-panel-${card.index}`}
          data-sample-bg={card.bg}
        >
          <div className="svg-container" id={`svg-${card.index}`}>
            <div className="loading-spinner" />
          </div>
          <div className="hero-tag-row">
            <span className="hero-tag">SVG</span>
            <span className="hero-tag">ASCII</span>
            <span className="hero-tag hero-tag-brand">16 Themes</span>
            <span className="hero-tag">Animated Edges</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * The source panel's inner markup.
 *
 * shiki's highlighted `<pre>` is a raw HTML string and has siblings, and
 * `dangerouslySetInnerHTML` can't be combined with JSX children — so the
 * siblings are rendered to markup here and concatenated, rather than
 * wrapping either half in an extra element the CSS doesn't expect.
 */
function sourcePanelInnerHtml(card: SampleCard): string {
  const siblings = renderToStaticMarkup(
    <>
      {card.optionsJson === null ? null : (
        <div className="options">
          <strong>Options:</strong> <code>{card.optionsJson}</code>
        </div>
      )}
      <button className="edit-btn" data-sample={card.index}>
        Edit
      </button>
    </>,
  )
  return `${card.highlightedSourceHtml}${siblings}`
}

/** One regular sample: source on one side, SVG/ASCII output on the other. */
export function SampleSection({ card }: { card: SampleCard }) {
  return (
    <section className="sample" id={`sample-${card.index}`}>
      <div className="sample-header">
        <h2>{card.title}</h2>
        <p
          className="description"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- formatDescription output for build-time prose in samples-data.ts, never user input
          dangerouslySetInnerHTML={{ __html: card.descriptionHtml }}
        />
      </div>
      <div className="sample-content">
        <div
          className="source-panel"
          id={`source-panel-${card.index}`}
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- shiki output plus this file's own rendered markup; see sourcePanelInnerHtml
          dangerouslySetInnerHTML={{ __html: sourcePanelInnerHtml(card) }}
        />
        <div className="output-panel">
          <div className="output-head">
            <div className="seg" role="tablist" aria-label="Output format">
              <button
                type="button"
                className="seg-btn"
                data-view="svg"
                role="tab"
                aria-selected="true"
              >
                SVG
              </button>
              <button
                type="button"
                className="seg-btn"
                data-view="ascii"
                role="tab"
                aria-selected="false"
              >
                ASCII
              </button>
            </div>
          </div>
          <div className="output-stage">
            <div
              className="svg-panel is-active"
              id={`svg-panel-${card.index}`}
              data-sample-bg={card.bg}
            >
              <div className="svg-container" id={`svg-${card.index}`}>
                <div className="loading-spinner" />
              </div>
            </div>
            <div className="ascii-panel" id={`ascii-panel-${card.index}`}>
              <div className="terminal-window">
                <div className="terminal-titlebar">
                  <span className="terminal-dots" aria-hidden="true">
                    <span className="terminal-dot terminal-dot-red" />
                    <span className="terminal-dot terminal-dot-yellow" />
                    <span className="terminal-dot terminal-dot-green" />
                  </span>
                  <span className="terminal-title">ascii</span>
                </div>
                <pre className="ascii-output">
                  <code id={`ascii-${card.index}`}>Rendering…</code>
                  <span className="terminal-cursor" aria-hidden="true">
                    &nbsp;
                  </span>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** The gallery's own footer — a single GitHub mark rather than a link row. */
export function GalleryFooter() {
  return (
    <footer className="site-footer">
      <span>&copy; 2026 zombie-mermaid</span>
      <div className="footer-links">
        <a href={FORK_URL} target="_blank" rel="noopener noreferrer">
          <GitHubMarkIcon />
        </a>
      </div>
    </footer>
  )
}

function HeroButtonIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

/** The page header: title, tagline, the row of entry-point buttons, meta. */
export function HeroHeader() {
  return (
    <header className="hero-header">
      <h1 className="hero-title">Zombie Mermaid</h1>
      <p className="hero-tagline">Mermaid Rendering, made beautiful.</p>
      <p className="hero-description">
        An open source library for rendering diagrams, designed for the age of
        AI:{' '}
        <a href={NPM_URL} target="_blank" rel="noopener">
          <code>zombie-mermaid</code>
        </a>
        . Ultra-fast, fully themeable, and outputs to both SVG and ASCII.
      </p>
      <div className="hero-buttons">
        <a href="editor" id="editor-link" className="hero-btn hero-btn-primary">
          <HeroButtonIcon>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </HeroButtonIcon>
          {' Editor '}
        </a>
        <a
          href={FORK_URL}
          target="_blank"
          rel="noopener"
          className="hero-btn hero-btn-secondary"
        >
          <GitHubMarkIcon />
          {' GitHub '}
        </a>
        <a href="fork-fixes.html" className="hero-btn hero-btn-secondary">
          <HeroButtonIcon>
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </HeroButtonIcon>
          {' What this fork fixes '}
        </a>
        <a href="diagrams/" className="hero-btn hero-btn-secondary">
          <HeroButtonIcon>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </HeroButtonIcon>
          {' Browse every diagram type '}
        </a>
        <a href="blog/" className="hero-btn hero-btn-secondary">
          <HeroButtonIcon>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="16" y2="17" />
          </HeroButtonIcon>
          {' Blog '}
        </a>
        <a href="dashboard.html" className="hero-btn hero-btn-secondary">
          <HeroButtonIcon>
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </HeroButtonIcon>
          {' Maintenance dashboard '}
        </a>
      </div>
      <div className="hero-meta">
        <p className="meta" id="total-timing">
          Rendering samples…
        </p>
        <div className="meta">
          ASCII rendering based on{' '}
          <a href={MERMAID_ASCII_URL} target="_blank" rel="noopener">
            Mermaid-ASCII
          </a>
        </div>
        <div className="meta">Early preview — actively evolving</div>
      </div>
    </header>
  )
}

/** The navigation + theme bar pinned to the top of the gallery. */
export function GalleryThemeBar() {
  return (
    <div className="theme-bar" id="theme-bar">
      <button
        className="sidebar-toggle shadow-minimal"
        id="sidebar-toggle"
        aria-label="Toggle sample navigation"
        aria-controls="sidebar"
        aria-expanded="false"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <line x1="2" y1="4" x2="14" y2="4" />
          <line x1="2" y1="8" x2="14" y2="8" />
          <line x1="2" y1="12" x2="14" y2="12" />
        </svg>
      </button>
      <a
        className="brand-badge shadow-minimal"
        href={FORK_URL}
        target="_blank"
        rel="noopener"
      >
        <span>
          <strong>Zombie Mermaid</strong>
        </span>
      </a>
      <div className="theme-bar-right">
        <button
          type="button"
          className="theme-pill shadow-minimal"
          id="random-theme-btn"
          aria-label="Random theme"
          title="Random theme"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="14"
            height="14"
          >
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
          {' Random '}
        </button>
        <div className="theme-pills" id="theme-pills">
          <ThemePicker includeDefault />
        </div>
      </div>
    </div>
  )
}

/** The shared, single-instance "edit this diagram" dialog. */
export function EditDialog() {
  return (
    <div className="edit-overlay" id="edit-overlay">
      <div
        className="edit-dialog shadow-modal-small"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-dialog-title"
      >
        <div className="edit-dialog-header">
          <span className="edit-dialog-title" id="edit-dialog-title">
            Edit Diagram
          </span>
          <button
            className="edit-dialog-close"
            id="edit-dialog-close"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <textarea
          className="edit-dialog-textarea"
          id="edit-dialog-textarea"
          aria-label="Mermaid source"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          defaultValue=""
        />
        <div className="edit-dialog-footer">
          <button
            className="edit-dialog-btn edit-dialog-cancel"
            id="edit-dialog-cancel"
          >
            Cancel
          </button>
          <button
            className="edit-dialog-btn edit-dialog-save"
            id="edit-dialog-save"
          >
            Save &amp; Render
          </button>
        </div>
      </div>
    </div>
  )
}

export interface IndexPageProps {
  /** demo/styles.css, re-indented for inlining (see index.ts's loadStyles). */
  css: string
  /** The SoftwareApplication JSON-LD block, indented and script-escaped. */
  jsonLd: string
  /** The sample definitions the client script reads out of the DOM. */
  samplesJson: string
  /** The bundled renderer plus demo/client.ts, one inline module script. */
  moduleScript: string
  /** Sample count shown in the category banner (Hero samples excluded). */
  totalSampleCount: number
  heroCards: HeroCard[]
  categories: CategorySection[]
}

/** The whole index.html document. */
export function IndexPage({
  css,
  jsonLd,
  samplesJson,
  moduleScript,
  totalSampleCount,
  heroCards,
  categories,
}: IndexPageProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" id="theme-color-meta" content="#f9f9fa" />
        <title>Zombie Mermaid — Mermaid Rendering, Made Beautiful</title>
        <meta
          name="description"
          content="Open source diagram rendering library built for the AI era. Ultra-fast, fully themeable, outputs to SVG and ASCII. Supports Flowchart, State, Sequence, Class, and ER diagrams."
        />
        <link rel="icon" type="image/svg+xml" href="favicon.svg" />
        <link rel="icon" type="image/x-icon" href="favicon.ico" />
        <link rel="apple-touch-icon" href="apple-touch-icon.png" />
        <meta property="og:title" content="Zombie Mermaid" />
        <meta
          property="og:description"
          content="Open source diagram rendering library built for the AI era. Ultra-fast, fully themeable, outputs to SVG and ASCII."
        />
        <meta
          property="og:image"
          content="https://agents.craft.do/mermaid/og-image.png"
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://agents.craft.do/mermaid" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Zombie Mermaid" />
        <meta
          name="twitter:description"
          content="Mermaid rendering, made beautiful. Ultra-fast, fully themeable, outputs to SVG and ASCII."
        />
        <meta
          name="twitter:image"
          content="https://agents.craft.do/mermaid/og-image.png"
        />
        <script
          type="application/ld+json"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- JSON-LD built from package.json at build time and escaped with escapeJsonForScriptTag
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
        {/* Plausible Analytics */}
        <script
          defer
          data-domain="agents.craft.do/mermaid"
          src="https://plausible.io/js/script.js"
        />
        <FontLinks />
        <style>{css}</style>
      </head>
      <body>
        <a className="skip-link" href="#samples-heading">
          Skip to samples
        </a>

        {/* Safari 26+ reads title bar color from the topmost fixed element's
            background. This invisible 1px div provides a real DOM element for
            Safari to detect. */}
        <div
          id="safari-theme-color"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'var(--theme-bar-bg)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        />

        {/* Scroll progress bar — filled client-side as the page scrolls */}
        <div
          className="scroll-progress"
          id="scroll-progress"
          aria-hidden="true"
        >
          <div className="scroll-progress-bar" id="scroll-progress-bar" />
        </div>

        <GalleryThemeBar />

        <div className="sidebar-backdrop" id="sidebar-backdrop" />

        {/* Persistent mobile/tablet nav: the sidebar (with its category list
            and active-category state) is hidden behind the hamburger below
            1024px, so this stays pinned to the bottom of the viewport the
            whole time a visitor scrolls a category's samples — not just once
            they reach the end — as the one place that always says what
            they're viewing and how to reach the rest. Sits above the
            scroll-progress line (see demo/styles.css) rather than replacing
            it — that line tracks raw page-scroll position, this tracks
            category identity; both answer a different half of "is there more,
            and where." */}
        <div className="category-tabbar" id="category-tabbar">
          <span className="category-tabbar-label">
            Viewing <strong id="tabbar-category-name" />
          </span>
          <button
            type="button"
            className="category-banner-btn"
            id="tabbar-browse-btn"
          >
            {' Browse types '}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="page-shell">
          <Sidebar categories={categories} />
          <div className="page-main">
            <HeroHeader />

            <div className="content-wrapper">
              {heroCards.map((card) => (
                <HeroSample card={card} key={card.index} />
              ))}

              <div className="samples-heading">
                <h2
                  className="section-title"
                  id="samples-heading"
                  tabIndex={-1}
                >
                  Samples
                </h2>
                <div className="category-banner" id="category-banner">
                  <span>
                    Showing <strong id="active-category-name" /> —{' '}
                    <span id="active-category-count" /> of {totalSampleCount}{' '}
                    samples
                  </span>
                  <button
                    type="button"
                    className="category-banner-btn"
                    id="browse-categories-btn"
                  >
                    Browse diagram types
                  </button>
                </div>
              </div>

              {/* Only the first category ships visible — the rest carry
                  `hidden` so a first-time visitor's initial payload isn't
                  "render everything at once": the other categories' diagrams
                  are rendered client-side on demand, when a sidebar category
                  is opened (see demo/client.ts's category switching). */}
              {categories.map((category, categoryIndex) => (
                <section
                  className="category-view"
                  id={`category-${category.slug}`}
                  data-category={category.slug}
                  hidden={categoryIndex !== 0}
                  key={category.slug}
                >
                  {category.cards.map((card) => (
                    <SampleSection card={card} key={card.index} />
                  ))}
                </section>
              ))}

              {/* Shown in place of the (all-hidden) category views when a
                  search matches no samples — see the "Sample search / filter"
                  section of demo/client.ts. */}
              <p className="search-empty" id="search-empty" hidden>
                No samples match your search.
              </p>

              {/* Sample definitions, read by the client script. Passed through
                  the DOM rather than interpolated into demo/client.ts so that
                  file stays plain, type-checkable code with no build-time
                  substitution. */}
              <script
                type="application/json"
                id="demo-samples"
                // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from samples-data.ts, escaped with escapeJsonForScriptTag
                dangerouslySetInnerHTML={{ __html: samplesJson }}
              />

              {/* Bundled mermaid renderer — exposes window.__mermaid */}
              <script
                type="module"
                // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own src/browser.ts and demo/client.ts, bundled at build time
                dangerouslySetInnerHTML={{ __html: moduleScript }}
              />

              <EditDialog />
            </div>
          </div>
        </div>

        <GalleryFooter />
      </body>
    </html>
  )
}
