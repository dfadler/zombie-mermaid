/** @jsxRuntime automatic */
/**
 * The per-sample diagram detail page's *hydrated* content
 * (`/diagrams/<type>/<sample>.html`, zombie-mermaid#989, implementing the
 * design drafted on
 * <https://claude.ai/code/artifact/5f6f7f34-15a9-45c1-8ede-ecde2d214367>):
 * breadcrumb, header, the "Source → render" split panel with a real
 * SVG/ASCII output toggle, and a "More `<type>` examples" cross-link grid
 * back into the type directory.
 *
 * Reuses `diagram-type-app.tsx`'s established visual vocabulary (the
 * traffic-light file tab, `Card tone="glow"` render panel, breadcrumb
 * styling, `MEDIA`/`SPACE`/`FONT_SIZE` tokens) rather than inventing a
 * second one — this page is one level deeper in the same `diagrams/`
 * hierarchy, not a different product area.
 *
 * The SVG/ASCII toggle ({@link DetailOutputPanel}) is the same interaction
 * `hero-output-panel.tsx`'s `HeroOutputPanel` already ships on the home
 * page — a segmented `.output-segment`/`.output-segment.active` button
 * pair driven by local `useState`, not a new pattern. This is a separate
 * component rather than a direct reuse of `HeroOutputPanel`: that one
 * hardcodes the fixed hero diagram (`HeroFlowchartSvg`) and its own plain
 * bordered panel chrome, where this page needs an arbitrary per-sample
 * `svgHtml` and the accent-tinted `Card tone="glow"` treatment
 * `diagram-type-app.tsx`'s "Source → render" panel already established for
 * this page family — so the *toggle bar and class names* are reused
 * (`.output-segment` is defined identically in `diagram-page.tsx`'s
 * `pageCss`), but the outer chrome and props are this page's own.
 *
 * Feature-tag pills (e.g. "Subgraph", "Decision Diamond") under the intro
 * paragraph link to that construct's single-tag search page
 * (`diagrams/tag/<slug>.html`, zombie-mermaid#991) — `demo/diagram-
 * tags.ts`'s `TAG_RULES`, computed per sample at build time
 * (`pages.ts`), not the five illustrative labels the design canvas drew
 * for one Flowchart example. Renders nothing when a sample matches no
 * rule (most don't need to — see that file's own doc comment on why the
 * taxonomy stays modest).
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronRightIcon } from './icons.tsx'
import { Card, CTA, type Accent, accentVar } from './primitives.tsx'
import {
  FONT_SIZE,
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'
import { FORK_URL, HOME_HREF } from './site-chrome.tsx'
import type { OrientationVariants } from './diagram-type-app.tsx'
import {
  useOutputPanelViewport,
  viewportTransform,
} from './output-panel-viewport.ts'

export { HOME_HREF }

/**
 * Real destinations for nav.tsx's `NAV_ITEMS`/footer.tsx's
 * `FOOTER_COLUMNS`, relative to a page under `diagrams/<type>/` — one level
 * deeper than `diagram-type-app.tsx`'s own `NAV_HREFS`, which is scoped to
 * `diagrams/<type>.html`. Deliberately a separate constant, not that one
 * reused: reusing it here would silently point every link on this page one
 * directory too shallow (`../editor` instead of `../../editor`, etc.) —
 * exactly the class of bug `site-chrome.tsx`'s own header comment says
 * `HOME_HREF`/`ROOT_NAV_HREFS` exist to stop happening again.
 */
export const NAV_HREFS = {
  diagrams: '../',
  editor: '../../editor',
  forkFixes: '../../fork-fixes.html',
  blog: '../../blog/',
  github: FORK_URL,
} as const

function DetailBreadcrumb({
  typeLabel,
  typeHref,
  sampleTitle,
  accent,
}: {
  typeLabel: string
  typeHref: string
  sampleTitle: string
  accent: Accent
}) {
  return (
    <div className="breadcrumb mono">
      <a href={HOME_HREF}>Home</a>
      <ChevronRightIcon size={12} strokeWidth={2.4} />
      <a href={NAV_HREFS.diagrams}>Diagrams</a>
      <ChevronRightIcon size={12} strokeWidth={2.4} />
      <a href={typeHref}>{typeLabel}</a>
      <ChevronRightIcon size={12} strokeWidth={2.4} />
      <span style={{ color: accentVar(accent) }}>{sampleTitle}</span>
    </div>
  )
}

/** The traffic-light file tab above the source panel — lifted verbatim
 * from `diagram-type-app.tsx`'s inline markup (not exported there), since
 * every page under `diagrams/` draws its own copy rather than sharing a
 * component across files that share nothing at runtime. */
function FileTab({ filename }: { filename: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: `${SPACE.xs}px`,
        padding: `${SPACE.xl}px ${SPACE['2xl']}px`,
        borderBottom: `1px solid ${colorVar('--border')}`,
        background: colorVar('--panel-2'),
        flexShrink: 0,
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
          marginLeft: `${SPACE.sm}px`,
          fontSize: `${FONT_SIZE.caption}px`,
          color: colorVar('--text-faint'),
        }}
      >
        {filename}
      </span>
    </div>
  )
}

/**
 * The real ASCII output's style. Unlike `hero-output-panel.tsx`'s
 * `HERO_ASCII_STYLE` (a single flat `--text-dim` color, because the home
 * hero renders its ASCII with `colorMode: 'none'` on the dark page chrome
 * directly), this page's `asciiHtml` prop is rendered with `colorMode:
 * 'html'` + `diagramColorsToAsciiTheme(DEFAULT_SWATCH)` (pages.ts) — the
 * same per-role-colored technique `index-page.tsx`'s theme showcase uses —
 * so every character already carries its own color span. Those spans are
 * derived from `DEFAULT_SWATCH`'s light theme (`#FFFFFF`/`#27272A`), the
 * same colors `renderMermaidSVG` paints into its own `<svg
 * style="background:...">` for this page's SVG state, so the ASCII panel
 * gets an explicit matching white background here — without it, that
 * light-theme text would sit unreadable on this page's dark `--panel`
 * chrome, and the two toggle states would look like different products
 * instead of two views of the same diagram. `color` is only a fallback for
 * stray unspanned whitespace text nodes, not the real text color.
 */
const ASCII_OUTPUT_STYLE = {
  margin: 0,
  width: '100%',
  overflowX: 'auto' as const,
  whiteSpace: 'pre' as const,
  fontVariantLigatures: 'none' as const,
  fontSize: `${FONT_SIZE.bodySm}px`,
  lineHeight: 1.5,
  color: '#27272A',
  background: '#FFFFFF',
  borderRadius: '12px',
  padding: `${SPACE.xl}px ${SPACE['2xl']}px`,
  minWidth: 0,
}

/**
 * The toggle's SVG branch — a plain string renders as one `.diagram-frame`
 * (every specific-diagram detail page); an `OrientationVariants` object
 * renders both the wide and narrow markup as `diagram-type-app.tsx`'s own
 * `OrientationBlock` does, letting the same `.orientation-variant` media
 * query (bundled into every `diagrams/` page's stylesheet) pick the right
 * one — reused rather than reimplemented, since the type page's hero
 * diagram needs the identical wide/narrow behavior this component's SVG
 * state already has today, just wrapped in the toggle.
 */
function SvgOutput({ svgHtml }: { svgHtml: OrientationVariants }) {
  if (typeof svgHtml === 'string') {
    return (
      <div
        className="diagram-frame"
        style={{ width: '100%' }}
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG output, never user input (see the file header)
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
    )
  }
  return (
    <div className="diagram-frame" style={{ width: '100%' }}>
      <div
        className="orientation-variant orientation-wide"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG output, never user input (see the file header)
        dangerouslySetInnerHTML={{ __html: svgHtml.wide }}
      />
      <div
        className="orientation-variant orientation-narrow"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG output, never user input (see the file header)
        dangerouslySetInnerHTML={{ __html: svgHtml.narrow }}
      />
    </div>
  )
}

/**
 * The fullscreen toggle's icon pair — four corner brackets, pointing
 * outward to enter and inward to exit. Not canvas-sourced (unlike
 * icons.tsx's set, see that module's header comment): these paths are
 * reused verbatim from `editor-fullscreen.ts`'s own toggle (#980), which
 * shipped an initial diagonal-arrows pair and replaced it (commit
 * b3f10d0) after finding that pair too similar at small sizes to read as
 * two distinct states — this component reuses the already-corrected,
 * already-shipped pair rather than repeating that mistake or inventing a
 * third design. Defined locally, not added to the shared icon set, for the
 * same reason `FileTab` above is: a page under `diagrams/` draws its own
 * copy rather than sharing a component across files that share nothing at
 * runtime.
 */
function FullscreenIcon({ isFullscreen }: { isFullscreen: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {isFullscreen ? (
        <>
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </>
      ) : (
        <>
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </>
      )}
    </svg>
  )
}

/**
 * The "Source → render" panel's render half: a segmented SVG/ASCII toggle
 * (`.output-segment`/`.output-segment.active`, defined identically in
 * `diagram-page.tsx`'s `pageCss` — same classes `hero-output-panel.tsx`'s
 * `HeroOutputPanel` uses on the home page, see this file's header comment)
 * over the two pre-rendered outputs. `useState` plus plain click handlers,
 * the same shape `HeroOutputPanel` already proves safe in a hydrated demo
 * page — not a new interactivity pattern for this codebase.
 *
 * `svgHtml` accepts `OrientationVariants` (not just a plain string) so
 * `diagram-type-app.tsx`'s type-page hero can reuse this component
 * unchanged for its own wide/narrow orientation-swapping "Source → render"
 * diagram — see {@link SvgOutput} below. Every specific-diagram detail
 * page (this file's own `DiagramDetailApp`) only ever passes a plain
 * string; a single sample has no orientation alternate to swap between.
 */
export function DetailOutputPanel({
  svgHtml,
  asciiHtml,
}: {
  svgHtml: OrientationVariants
  asciiHtml: string
}) {
  const [mode, setMode] = useState<'svg' | 'ascii'>('svg')
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Anchors `.closest('.output-card')` below -- the header is that Card's
  // own direct child (see the two call sites' `<Card className="output-
  // card">` markup), not a ref threaded down from either page shell.
  const headerRef = useRef<HTMLDivElement | null>(null)
  // The pan/zoom gesture surface -- output-panel-viewport.ts's listeners
  // attach here, and only while isFullscreen (that hook's own `active`
  // flag): the small inline panel stays a static centered preview.
  const renderAreaRef = useRef<HTMLDivElement | null>(null)
  const {
    viewport,
    isPanning,
    zoomIn,
    zoomOut,
    reset: resetViewport,
  } = useOutputPanelViewport({
    active: isFullscreen,
    containerRef: renderAreaRef,
  })

  // state.isFullscreen is never set optimistically from the click handler
  // below -- only from this fullscreenchange listener reading
  // document.fullscreenElement -- so it always reflects what the browser
  // actually did, including cases the click handler doesn't control at
  // all: Esc, the browser exiting on its own, or requestFullscreen()
  // rejecting. Mirrors editor-fullscreen.ts's useEditorFullscreen (#980).
  useEffect(() => {
    const card = headerRef.current?.closest('.output-card')
    if (!card) return
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === card)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  function toggleFullscreen() {
    const card = headerRef.current?.closest('.output-card')
    if (!card) return
    if (document.fullscreenElement === card) {
      document.exitFullscreen().catch(() => {
        // Rejected exit (e.g. already left some other way) -- the next
        // fullscreenchange, if any, is still what isFullscreen syncs from.
      })
    } else {
      card.requestFullscreen().catch(() => {
        // Rejected entry (no user-activation, a permissions-policy block,
        // ...) -- isFullscreen simply never flips, since no
        // fullscreenchange fires for a request that never took effect.
      })
    }
  }

  return (
    <>
      <div
        ref={headerRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${SPACE.md}px ${SPACE.xl}px`,
          background: colorVar('--panel-2'),
          borderBottom: `1px solid ${colorVar('--border')}`,
          flexShrink: 0,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: `${FONT_SIZE.micro}px`,
            letterSpacing: LETTER_SPACING.eyebrow,
            textTransform: 'uppercase',
            color: colorVar('--text-faint'),
          }}
        >
          Output
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${SPACE.sm}px`,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '2px',
              background: colorVar('--panel'),
              borderRadius: '999px',
              padding: '2px',
            }}
          >
            <button
              type="button"
              className={`output-segment${mode === 'svg' ? ' active' : ''}`}
              aria-pressed={mode === 'svg'}
              onClick={() => setMode('svg')}
            >
              SVG
            </button>
            <button
              type="button"
              className={`output-segment${mode === 'ascii' ? ' active' : ''}`}
              aria-pressed={mode === 'ascii'}
              onClick={() => setMode('ascii')}
            >
              ASCII
            </button>
          </div>
          {isFullscreen && (
            <div
              className="output-zoom-controls"
              role="group"
              aria-label="Zoom"
            >
              <button
                type="button"
                className="output-zoom-btn"
                title="Zoom out"
                onClick={zoomOut}
              >
                −
              </button>
              <button
                type="button"
                className="output-zoom-btn output-zoom-reset"
                title="Reset zoom"
                onClick={resetViewport}
              >
                {Math.round(viewport.scale * 100)}%
              </button>
              <button
                type="button"
                className="output-zoom-btn"
                title="Zoom in"
                onClick={zoomIn}
              >
                +
              </button>
            </div>
          )}
          <button
            type="button"
            className="output-fullscreen-btn"
            title={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
            aria-pressed={isFullscreen}
            onClick={toggleFullscreen}
          >
            <FullscreenIcon isFullscreen={isFullscreen} />
          </button>
        </div>
      </div>
      <div
        ref={renderAreaRef}
        className={
          isFullscreen
            ? `output-render-area pannable${isPanning ? ' panning' : ''}`
            : 'output-render-area'
        }
        style={{
          flex: '1 1 auto',
          display: 'flex',
          padding: `${SPACE['5xl']}px`,
          overflow: isFullscreen ? 'hidden' : 'auto',
        }}
      >
        {/*
         * `margin: auto` on the scrollable flex item, not `alignItems`/
         * `justifyContent: center` on this container -- centering via
         * align/justify content clips unreachably as soon as the content
         * overflows the container in the centered axis: the browser has
         * nowhere to scroll *to* for the portion pushed off the leading
         * edge, since align/justify-content never generates negative
         * scroll offset. Surfaced by #1015's fullscreen toggle (a large
         * diagram's top/left edge was clipped with no way to scroll to
         * it once .output-card's height was clamped to the viewport),
         * but the bug was already latent here before that change -- the
         * normal (non-fullscreen) case just never constrained this
         * container's height enough to trigger it. `margin: auto` still
         * centers when the content fits (an auto margin absorbs
         * available space same as center alignment) but degrades to 0,
         * not negative, once it doesn't -- leaving the item at its
         * natural start position and fully reachable by scrolling.
         */}
        <div
          style={{
            margin: 'auto',
            transform: viewportTransform(viewport, isFullscreen),
          }}
        >
          {mode === 'svg' ? (
            <SvgOutput svgHtml={svgHtml} />
          ) : (
            <pre
              className="mono"
              style={ASCII_OUTPUT_STYLE}
              // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidASCII({colorMode:'html'}) output, entity-escaped by the renderer itself, never user input (see the file header)
              dangerouslySetInnerHTML={{ __html: asciiHtml }}
            />
          )}
        </div>
      </div>
    </>
  )
}

export interface DiagramDetailCrosslink {
  title: string
  href: string
  diagramHtml: string
}

/**
 * `diagram-detail-root`: id of the *hydration container*
 * `demo/diagram-detail-client.tsx`'s `hydrateRoot()` call mounts onto —
 * see `diagram-hub-app.tsx`'s `DIAGRAM_HUB_ROOT_ID` doc comment for the
 * same reasoning.
 */
export const DIAGRAM_DETAIL_ROOT_ID = 'diagram-detail-root'

/**
 * `diagram-detail-props`: the `<script type="application/json">` element
 * `demo/diagram-detail-client.tsx` reads {@link DiagramDetailAppProps} out
 * of.
 */
export const DIAGRAM_DETAIL_PROPS_ELEMENT_ID = 'diagram-detail-props'

export interface DiagramDetailAppProps {
  typeLabel: string
  typeHref: string
  accent: Accent
  sampleTitle: string
  sampleDescription: string
  sourceFilename: string
  /** shiki-highlighted Mermaid source (github-dark theme, matching the type page's source panel). */
  sourceHtml: string
  /** `renderMermaidSVG` output for this sample. */
  svgHtml: string
  /** `renderMermaidASCII({ colorMode: 'html' })` output for this sample — already HTML-escaped and colored by the renderer itself. */
  asciiHtml: string
  /** `../../editor#<base64 payload>` — see pages.ts's `editorHash`. */
  editorHref: string
  /** Other real samples for the same type (excluding this one), each already rendered — see `demo/diagram-pages-data.ts`'s `allExamplesFor`. */
  moreFromType: readonly DiagramDetailCrosslink[]
  /** Every `demo/diagram-tags.ts` construct this sample's real source matches, each linking to its tag page (`../../tag/<slug>.html`) — see `pages.ts`'s generator. Empty when the sample matches no rule. */
  tags: readonly { label: string; href: string }[]
}

/**
 * Everything inside {@link DIAGRAM_DETAIL_ROOT_ID}'s hydration boundary.
 */
export function DiagramDetailApp({
  typeLabel,
  typeHref,
  accent,
  sampleTitle,
  sampleDescription,
  sourceFilename,
  sourceHtml,
  svgHtml,
  asciiHtml,
  editorHref,
  moreFromType,
  tags,
}: DiagramDetailAppProps) {
  return (
    <>
      {/* ============ BREADCRUMB + HEADER ============ */}
      <div
        className="section-px"
        style={{
          padding: `${SECTION_SPACE.snug}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.default - 16}px ${LAYOUT.gutter.desktop}px`,
          position: 'relative',
          zIndex: 1,
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
          <DetailBreadcrumb
            typeLabel={typeLabel}
            typeHref={typeHref}
            sampleTitle={sampleTitle}
            accent={accent}
          />
          <h1
            className="page-h1"
            style={{
              fontSize: `${FONT_SIZE.display}px`,
              lineHeight: 1.08,
              letterSpacing: LETTER_SPACING.display,
              maxWidth: '820px',
            }}
          >
            {sampleTitle}
          </h1>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.65,
              color: colorVar('--text-dim'),
              maxWidth: '680px',
            }}
          >
            {sampleDescription}
          </p>
          {tags.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: `${SPACE.sm}px`,
                flexWrap: 'wrap',
              }}
            >
              {tags.map((tag) => (
                <a
                  key={tag.href}
                  href={tag.href}
                  className="pill mono"
                  style={{
                    background: colorVar('--panel'),
                    border: `1px solid ${colorVar('--border')}`,
                    color: colorVar('--text-dim'),
                    padding: '7px 14px',
                    fontSize: `${FONT_SIZE.caption}px`,
                  }}
                >
                  {tag.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ============ SOURCE + RENDER ============ */}
      <div
        className="section-px"
        style={{
          padding: `${SECTION_SPACE.default - 16}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.default}px ${LAYOUT.gutter.desktop}px`,
          background: colorVar('--bg-soft'),
          borderTop: `1px solid ${colorVar('--border')}`,
          borderBottom: `1px solid ${colorVar('--border')}`,
        }}
      >
        <div
          style={{
            maxWidth: `${LAYOUT.maxWidth}px`,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE['5xl']}px`,
          }}
        >
          <div
            className="detail-row"
            style={{
              display: 'flex',
              gap: `${SPACE['6xl']}px`,
              alignItems: 'stretch',
            }}
          >
            <Card
              accent={accent}
              className="code-card"
              style={{ flex: '1 1 0', minWidth: 0 }}
            >
              <FileTab filename={sourceFilename} />
              <div
                className="source-panel"
                style={{
                  padding: `${SPACE['4xl']}px ${SPACE['3xl']}px`,
                  fontSize: `${FONT_SIZE.bodySm}px`,
                  overflowX: 'auto',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 0,
                }}
                // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time shiki output, never user input (see the file header)
                dangerouslySetInnerHTML={{ __html: sourceHtml }}
              />
            </Card>

            <Card
              accent={accent}
              tone="glow"
              className="output-card"
              style={{
                flex: '1 1 0',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <DetailOutputPanel svgHtml={svgHtml} asciiHtml={asciiHtml} />
            </Card>
          </div>

          <div
            style={{
              display: 'flex',
              gap: `${SPACE.xl}px`,
              flexWrap: 'wrap',
            }}
          >
            <CTA href={editorHref} accent={accent} className="cta-btn primary">
              Open in the live editor
            </CTA>
            <CTA href={typeHref} accent={accent} variant="ghost" arrow={false}>
              {`← Back to ${typeLabel} examples`}
            </CTA>
          </div>
        </div>
      </div>

      {/* ============ MORE FROM THIS TYPE ============ */}
      {moreFromType.length > 0 && (
        <div
          className="section-px"
          style={{
            padding: `${SECTION_SPACE.default}px ${LAYOUT.gutter.desktop}px`,
          }}
        >
          <div
            style={{
              maxWidth: `${LAYOUT.maxWidth}px`,
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: `${SPACE['4xl']}px`,
            }}
          >
            <h2
              style={{
                fontSize: '26px',
                letterSpacing: LETTER_SPACING.heading,
              }}
            >
              {`More ${typeLabel} examples`}
            </h2>
            <div className="gallery-grid">
              {moreFromType.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  className="card gallery-card"
                  style={{ borderColor: colorVar('--border') }}
                >
                  <div
                    className="gallery-thumb"
                    // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG output, never user input (see the file header)
                    dangerouslySetInnerHTML={{ __html: item.diagramHtml }}
                  />
                  <div className="gallery-label">
                    <span className="gallery-title">{item.title}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
