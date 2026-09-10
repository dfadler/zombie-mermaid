/** @jsxRuntime automatic */
/**
 * The per-diagram-type SEO page's *hydrated* content (zombie-mermaid#805):
 * breadcrumb, header, the "Source → render" panel pair, the "More
 * examples" gallery, and the "Keep exploring" cross-links grid. Split out
 * of `diagram-page.tsx` (which used to be a full-document owner, like
 * `dashboard-page.tsx` was pre-#799) specifically so this file, and
 * everything it imports, never touches `react-dom/server` — mirroring
 * `dashboard-app.tsx`'s split.
 *
 * `<NavIsland>`/`<Footer>` render as plain siblings of this component's
 * hydration container in `diagram-page.tsx` rather than nested in this
 * file's own tree, for the same reason `dashboard-app.tsx`'s doc comment
 * gives for its own `<Footer>`/`<Nav>` split.
 *
 * `sourcePanelHtml`/`diagramHtml` are shiki/`renderMermaidSVG` output —
 * plain, pre-rendered strings by the time they reach here (build-time
 * only, never re-run in the browser) — so they round-trip through the
 * serialized hydration props exactly like every other page's already-
 * rendered `dangerouslySetInnerHTML` content (`ForkFixesApp`'s
 * `PanelContent`, `BlogPostApp`'s `bodyHtml`).
 *
 * `HOME_HREF`/`NAV_HREFS` live here (not `diagram-page.tsx`) because
 * `DetailBreadcrumb` needs them and this file is the one both `diagram-
 * page.tsx` (for `<NavIsland>`'s own `hrefs`) and `diagram-hub-app.tsx`
 * (`HubBreadcrumb`) import them from.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { CSSProperties, ReactNode } from 'react'
import { FORK_URL, HOME_HREF } from './site-chrome.tsx'
import { ChevronRightIcon } from './icons.tsx'
import {
  Card,
  CTA,
  SectionEyebrow,
  accentVar,
  type Accent,
} from './primitives.tsx'
import {
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'

/**
 * Real destinations for nav.tsx's `NAV_ITEMS`/footer.tsx's
 * `FOOTER_COLUMNS`, relative to a page under `diagrams/`. Every generated
 * type/hub page lives at the same depth, so these are fixed rather than
 * threaded through as props. Exported for `diagram-page.tsx` (`<NavIsland
 * hrefs={NAV_HREFS}>`) and `diagram-hub-app.tsx` (`HubBreadcrumb`).
 *
 * `HOME_HREF` itself is just site-chrome.tsx's shared constant, re-exported
 * here so those two callers don't need a second import -- see that
 * constant's own doc comment for why it's absolute rather than a relative
 * `'../'` (which is what this used to be, independently of every other
 * page's own copy of the same link).
 */
export { HOME_HREF }
export const NAV_HREFS = {
  diagrams: './',
  editor: '../editor',
  forkFixes: '../fork-fixes.html',
  blog: '../blog/',
  github: FORK_URL,
} as const

export type OrientationVariants = { wide: string; narrow: string } | string

function OrientationBlock({
  className = '',
  style,
  html,
}: {
  className?: string
  style?: CSSProperties
  html: OrientationVariants
}) {
  if (typeof html === 'string') {
    // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG/shiki output, never user input (see the file header)
    return (
      <div
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }
  return (
    <div className={className} style={style}>
      <div
        className="orientation-variant orientation-wide"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG/shiki output, never user input (see the file header)
        dangerouslySetInnerHTML={{ __html: html.wide }}
      />
      <div
        className="orientation-variant orientation-narrow"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG/shiki output, never user input (see the file header)
        dangerouslySetInnerHTML={{ __html: html.narrow }}
      />
    </div>
  )
}
export interface DiagramTypeLink {
  slug: string
  label: string
}

/* -----------------------------------------------------------------
 * Per-type crosslink glyphs
 *
 * Six small animated SVGs, one per diagram type, transcribed from the
 * FlowchartDetail artboard's "Keep exploring" cards (five of them — State,
 * Sequence, Class, ER, XY chart) plus a sixth built here in the same visual
 * language for Flowchart itself, since the artboard never draws Flowchart's
 * own glyph (it's always the *current* page's type there, never a
 * crosslink target). Each reuses the artboard's own animation classes
 * ({@link pageCss}), so it double-checks against the "Source → render"
 * section's animation on this same page: flowchart's edges there are
 * `edge-anim` (marching ants), which is exactly what this file's
 * `FlowchartGlyph` reuses.
 *
 * `stroke="currentColor"`/`fill="currentColor"` rather than a literal
 * `var(--<accent>)` per shape, unlike the artboard: the containing
 * {@link Card}'s `color` (set from that type's own {@link Accent} by
 * {@link OtherTypesGrid}) already supplies the hue, so one glyph serves
 * every accent instead of needing six colour-coded copies.
 * ----------------------------------------------------------------- */

function FlowchartGlyph() {
  return (
    <svg viewBox="0 0 100 70" width="60" height="42" aria-hidden="true">
      <rect
        x="6"
        y="10"
        width="30"
        height="20"
        rx="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="64"
        y="40"
        width="30"
        height="20"
        rx="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M36 20 L64 50"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        className="edge-anim"
      />
    </svg>
  )
}

function StateGlyph() {
  return (
    <svg viewBox="0 0 100 70" width="60" height="42" aria-hidden="true">
      <circle
        cx="24"
        cy="20"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="radar-ping"
      />
      <circle
        cx="24"
        cy="20"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="76"
        cy="50"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M36 28 L64 42"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  )
}

function SequenceGlyph() {
  return (
    <svg viewBox="0 0 100 70" width="60" height="42" aria-hidden="true">
      <line
        x1="22"
        y1="8"
        x2="22"
        y2="62"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="78"
        y1="8"
        x2="78"
        y2="62"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M22 24 H78"
        stroke="currentColor"
        strokeWidth="2"
        className="msg-flow-right"
      />
      <path
        d="M78 44 H22"
        stroke="currentColor"
        strokeWidth="2"
        className="msg-flow-left"
      />
    </svg>
  )
}

function ClassGlyph() {
  return (
    <svg viewBox="0 0 100 70" width="60" height="42" aria-hidden="true">
      <rect
        x="22"
        y="8"
        width="56"
        height="50"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="22"
        y1="26"
        x2="78"
        y2="26"
        stroke="currentColor"
        strokeWidth="2"
        className="draw-line"
      />
      <line
        x1="22"
        y1="42"
        x2="78"
        y2="42"
        stroke="currentColor"
        strokeWidth="2"
        className="draw-line"
        style={{ animationDelay: '0.5s' }}
      />
    </svg>
  )
}

function ErGlyph() {
  return (
    <svg viewBox="0 0 100 70" width="60" height="42" aria-hidden="true">
      <rect
        x="4"
        y="24"
        width="30"
        height="20"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="66"
        y="24"
        width="30"
        height="20"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <polygon
        points="50,20 60,34 50,48 40,34"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="relation-pulse"
      />
      <path
        d="M34 34 H40 M60 34 H66"
        stroke="currentColor"
        strokeWidth="2"
        className="relation-pulse"
      />
    </svg>
  )
}

function XyChartGlyph() {
  return (
    <svg viewBox="0 0 100 70" width="60" height="42" aria-hidden="true">
      <line
        x1="10"
        y1="8"
        x2="10"
        y2="62"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="10"
        y1="62"
        x2="94"
        y2="62"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="20"
        y="40"
        width="10"
        height="22"
        fill="currentColor"
        className="bar-grow"
      />
      <rect
        x="38"
        y="28"
        width="10"
        height="34"
        fill="currentColor"
        className="bar-grow"
        style={{ animationDelay: '0.2s' }}
      />
      <rect
        x="56"
        y="16"
        width="10"
        height="46"
        fill="currentColor"
        className="bar-grow"
        style={{ animationDelay: '0.4s' }}
      />
      <path
        d="M20 44 L46 30 L82 14"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        className="edge-anim"
      />
    </svg>
  )
}

/**
 * Every diagram type's crosslink glyph, keyed by `DiagramTypeProfile.slug`
 * (demo/diagram-pages-data.ts) — the same six slugs `DIAGRAM_TYPE_PROFILES`
 * uses. A slug with no entry here renders no glyph (see
 * {@link OtherTypesGrid}), rather than the page failing to build.
 */
const DIAGRAM_TYPE_GLYPHS: Record<string, () => ReactNode> = {
  flowchart: FlowchartGlyph,
  state: StateGlyph,
  sequence: SequenceGlyph,
  class: ClassGlyph,
  er: ErGlyph,
  'xy-chart': XyChartGlyph,
}

/** One crosslink target: the other type's own display data. */
export interface DiagramCrosslink extends DiagramTypeLink {
  /** Tints the card border and the glyph (via `color`). */
  accent: Accent
}

/** The "Keep exploring" grid: every *other* diagram type as a glyph card. */
export function OtherTypesGrid({
  types,
  currentSlug,
}: {
  types: readonly DiagramCrosslink[]
  currentSlug: string
}) {
  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: `${SPACE['2xl']}px` }}
    >
      {types
        .filter((type) => type.slug !== currentSlug)
        .map((type) => {
          const Glyph = DIAGRAM_TYPE_GLYPHS[type.slug]
          return (
            <Card
              key={type.slug}
              href={`${type.slug}.html`}
              accent={type.accent}
              className="crosslink-card"
              style={{
                flex: '1 1 160px',
                minWidth: '140px',
                padding: `${SPACE['2xl']}px`,
                color: accentVar(type.accent),
              }}
            >
              {Glyph ? <Glyph /> : null}
              <span
                style={{
                  fontSize: `${FONT_SIZE.bodySm}px`,
                  fontWeight: FONT_WEIGHT.bold,
                  color: colorVar('--text'),
                }}
              >
                {type.label}
              </span>
            </Card>
          )
        })}
    </div>
  )
}
export interface GalleryItem {
  /** `Sample.title`, e.g. "CI/CD Pipeline" — the card's caption. */
  title: string
  /** The rendered SVG, via pages.ts's `renderDiagram(sample.source)`. */
  diagramHtml: string
  /** `../editor#<base64 payload>` for this sample, same shape as the page's own `editorHref`. */
  editorHref: string
}

function DetailBreadcrumb({
  label,
  accent,
}: {
  label: string
  accent: Accent
}) {
  return (
    <div className="breadcrumb mono">
      <a href={HOME_HREF}>Home</a>
      <ChevronRightIcon size={12} strokeWidth={2.4} />
      <a href={NAV_HREFS.diagrams}>Diagrams</a>
      <ChevronRightIcon size={12} strokeWidth={2.4} />
      <span style={{ color: accentVar(accent) }}>{label}</span>
    </div>
  )
}
const GALLERY_VISIBLE_COUNT = 6

/** One `MoreExamplesSection` card: a fixed-aspect thumbnail plus the sample's title, linking to the live editor. */
function GalleryCard({ item, accent }: { item: GalleryItem; accent: Accent }) {
  return (
    <Card href={item.editorHref} accent={accent} className="gallery-card">
      <div
        className="gallery-thumb"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG output, never user input (see the file header)
        dangerouslySetInnerHTML={{ __html: item.diagramHtml }}
      />
      <div className="gallery-label">
        <span className="gallery-title">{item.title}</span>
      </div>
    </Card>
  )
}

/**
 * The "More examples" section (#714/#715 — Direction A of
 * docs/decisions/diagram-gallery-layout.md, drafted on the design canvas
 * at https://claude.ai/code/artifact/d82d53c8-9678-4013-aa72-5859560b211f):
 * the samples-data.ts#713 curated set for this type
 * (`demo/diagram-pages-data.ts`'s `moreExamplesFor`), in a fixed-aspect
 * card grid. Renders nothing when `items` is empty.
 *
 * Bounds the section's height regardless of how many samples a type
 * curates (3-14 per docs/decisions/diagram-gallery-scope.md) — the direct
 * fix for #708's ~18,000px pages: everything past
 * {@link GALLERY_VISIBLE_COUNT} sits inside a native `<details>`
 * disclosure, so revealing the rest needs no client script at all. That
 * matches docs/decisions/no-script-interactivity.md's "demo-site chrome
 * only" allowance for this kind of interaction — `<details>` is simply the
 * zero-script way to build it, one step further than a hand-rolled toggle
 * script would have been. The artboard shows a 6-desktop/4-mobile split;
 * shipping one fixed cap for both keeps this a single static render (no
 * client-side re-splitting), which still fully solves #708's actual bug
 * (unbounded height) — see the design decision doc for that tradeoff.
 *
 * Each thumbnail (`pageCss`'s `.gallery-thumb`) fixes #708's card-sizing
 * bug directly: the rendered SVG's own `viewBox` letterboxes into the
 * frame via `width:100%;height:100%` plus the SVG default
 * `preserveAspectRatio="xMidYMid meet"`, so a tall/narrow diagram is
 * contained instead of blowing out the card.
 */
function MoreExamplesSection({
  items,
  accent,
}: {
  items: readonly GalleryItem[]
  accent: Accent
}) {
  if (items.length === 0) return null

  const visible = items.slice(0, GALLERY_VISIBLE_COUNT)
  const hidden = items.slice(GALLERY_VISIBLE_COUNT)

  return (
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
        <SectionEyebrow accent={accent}>More examples</SectionEyebrow>
        <h2 style={{ fontSize: '30px', letterSpacing: LETTER_SPACING.heading }}>
          More real-world examples.
        </h2>
        <div className="gallery-grid">
          {visible.map((item) => (
            <GalleryCard key={item.title} item={item} accent={accent} />
          ))}
        </div>
        {hidden.length > 0 && (
          <details className="gallery-more">
            <summary
              className="pill"
              style={{
                background: 'transparent',
                border: `1px solid ${accentVar(accent)}`,
                color: accentVar(accent),
              }}
            >
              Show {hidden.length} more example{hidden.length === 1 ? '' : 's'}
            </summary>
            <div className="gallery-grid">
              {hidden.map((item) => (
                <GalleryCard key={item.title} item={item} accent={accent} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

/**
 * `diagram-type-root`: id of the *hydration container*
 * `demo/diagram-type-client.tsx`'s `hydrateRoot()` call mounts onto — a
 * plain wrapper `<div>` `diagram-page.tsx`'s `DiagramTypePage` renders
 * directly, not part of {@link DiagramTypeApp}'s own render output. See
 * `dashboard-app.tsx`'s `DASHBOARD_ROOT_ID` doc comment for why this has
 * to be a separate element from the app's own root.
 */
export const DIAGRAM_TYPE_ROOT_ID = 'diagram-type-root'

/**
 * `diagram-type-props`: the `<script type="application/json">` element
 * `demo/diagram-type-client.tsx` reads {@link DiagramTypeAppProps} out of.
 */
export const DIAGRAM_TYPE_PROPS_ELEMENT_ID = 'diagram-type-props'

export interface DiagramTypeAppProps {
  label: string
  slug: string
  intro: string
  accent: Accent
  exampleHeading: string
  sourceFilename: string
  sourcePanelHtml: OrientationVariants
  diagramHtml: OrientationVariants
  editorHref: string
  galleryItems: readonly GalleryItem[]
  types: readonly DiagramCrosslink[]
}

/**
 * Everything inside {@link DIAGRAM_TYPE_ROOT_ID}'s hydration boundary:
 * breadcrumb + header, the "Source → render" panel pair, the "More
 * examples" gallery, and the "Keep exploring" cross-links grid — the same
 * sections `diagram-page.tsx`'s `DiagramTypePage` used to render directly,
 * in the same order (minus the "Pick a look" theme-picker section, which
 * stays a sibling — see this file's header comment). The exact same
 * function runs on both sides of hydration.
 */
export function DiagramTypeApp({
  label,
  slug,
  intro,
  accent,
  exampleHeading,
  sourceFilename,
  sourcePanelHtml,
  diagramHtml,
  editorHref,
  galleryItems,
  types,
}: DiagramTypeAppProps) {
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
          <DetailBreadcrumb label={label} accent={accent} />
          <h1
            className="page-h1"
            style={{
              fontSize: `${FONT_SIZE.display}px`,
              lineHeight: 1.08,
              letterSpacing: LETTER_SPACING.display,
              maxWidth: '820px',
            }}
          >
            {label}
          </h1>
          <p
            // 18px is off tokens.tsx's FONT_SIZE scale (17 lead / 20
            // subhead are the neighbours) -- the artboard's own lede
            // size, kept literal rather than rounded to either step.
            style={{
              fontSize: '18px',
              lineHeight: 1.65,
              color: colorVar('--text-dim'),
              maxWidth: '720px',
            }}
          >
            {intro}
          </p>
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
          <SectionEyebrow accent={accent}>Source → render</SectionEyebrow>
          <h2
            style={{
              fontSize: '30px',
              letterSpacing: LETTER_SPACING.heading,
            }}
          >
            {exampleHeading}
          </h2>

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
                  {sourceFilename}
                </span>
              </div>
              <OrientationBlock
                className="source-panel"
                // Cancels the old, still-loaded demo/styles.css's
                // `.source-panel` rules (built for index.ts's own
                // gallery cards, which this page's `cssHref` also
                // carries -- see that prop's doc comment): a
                // near-white `background` meant to sit under
                // github-light Shiki output, and a border/radius that
                // would otherwise nest a second, mismatched box inside
                // this card's own.
                style={{
                  padding: `${SPACE['4xl']}px ${SPACE['3xl']}px`,
                  fontSize: `${FONT_SIZE.bodySm}px`,
                  overflowX: 'auto',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 0,
                }}
                html={sourcePanelHtml}
              />
            </Card>

            <Card
              accent={accent}
              tone="glow"
              className="diagram-frame"
              style={{
                flex: '1 1 0',
                minWidth: 0,
                padding: `${SPACE['5xl']}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <OrientationBlock html={diagramHtml} />
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
            <CTA
              href={NAV_HREFS.diagrams}
              accent={accent}
              variant="ghost"
              arrow={false}
            >
              See all samples
            </CTA>
          </div>
        </div>
      </div>

      <MoreExamplesSection items={galleryItems} accent={accent} />
      {/* ============ CROSS-LINKS ============ */}
      <div
        className="section-px"
        style={{
          padding: `${SECTION_SPACE.default}px ${LAYOUT.gutter.desktop}px`,
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
          <SectionEyebrow>Keep exploring</SectionEyebrow>
          <h2
            style={{
              fontSize: '30px',
              letterSpacing: LETTER_SPACING.heading,
            }}
          >
            Explore the other diagram types.
          </h2>
          <OtherTypesGrid types={types} currentSlug={slug} />
        </div>
      </div>
    </>
  )
}
