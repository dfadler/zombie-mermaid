/** @jsxRuntime automatic */
/**
 * The per-diagram-type SEO pages and their hub page (pages.ts →
 * diagrams/*.html) as React components.
 *
 * `DiagramTypePage` is the reference instance of the shared per-type detail
 * template (#601, part of #599, part of the #590 redesign): breadcrumb,
 * description, syntax-highlighted source + rendered SVG side by side, a
 * theme picker, and cross-links to the other five diagram types. Every
 * structural choice, colour, and string not called out below was lifted
 * from the design canvas's `FlowchartDetail` artboard
 * (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`,
 * confirmed byte-identical to `FlowchartDetailMobile` — this page's
 * responsive behaviour lives entirely in the `@media` blocks in
 * {@link pageCss}, tokens.tsx's `MEDIA`, nav.tsx's `navCss`, and
 * footer.tsx's `footerCss`, not in a second markup path), the same source
 * nav.tsx/footer.tsx/tokens.tsx/primitives.tsx were built from. #602-606
 * (State, Sequence, Class, ER, XY chart) apply this same template to their
 * own type once this PR merges — see this file's own doc comments on
 * {@link DiagramTypePageProps} and demo/diagram-pages-data.ts's
 * `DiagramTypeProfile` for the seams a follow-on issue passes through.
 *
 * `DiagramHubPage` (diagrams/index.html) applies the same redesign, sourced
 * from the canvas's `DiagramGallery` artboard (confirmed byte-identical to
 * `DiagramGalleryMobile`, same as `FlowchartDetail` above) — see that
 * function's own doc comment for what's the canvas's and what's this file's
 * addition (#600, part of #599, part of the #590 redesign).
 *
 * Pure functions of already-computed data: pages.ts still owns the I/O and
 * the rendering work (renderMermaidSVG, shiki, esbuild), and hands the
 * results here. The two places raw HTML is spliced in — the rendered SVG
 * and shiki's highlighted source — are strings this repo's own renderer
 * produced at build time, never user input; each carries the wrapper
 * element's class itself so no extra layout-breaking `<div>` is introduced.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { CSSProperties, ReactNode } from 'react'
import { FORK_URL } from './site-chrome.tsx'
import { Footer, type FooterColumn } from './footer.tsx'
import { Nav, NavCopyScript, NavMobileMenuScript } from './nav.tsx'
import {
  Card,
  CTA,
  SectionEyebrow,
  accentVar,
  type Accent,
} from './primitives.tsx'
import { SharedPageStyles } from './shared-page-css.tsx'
import {
  ChevronRightIcon,
  ClassIcon,
  ErIcon,
  FlowchartIcon,
  SequenceIcon,
  StateIcon,
  XyChartIcon,
  type DiagramTypeIconProps,
} from './icons.tsx'
import { ThemePickerSection } from './theme-picker-section.tsx'
import { ThemePickerStyle } from './theme-picker.tsx'
import {
  DesignFontLinks,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  LETTER_SPACING,
  MEDIA,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'

/**
 * The site's npm package listing, linked from the footer's Resources
 * column. Duplicated from demo/components/index-page.tsx's own
 * module-private `NPM_URL` rather than importing it — that module doesn't
 * export it, and this page owns its own footer link destinations.
 */
const NPM_URL = 'https://www.npmjs.com/package/zombie-mermaid'

/**
 * Real destinations for nav.tsx's `NAV_ITEMS`/footer.tsx's
 * `FOOTER_COLUMNS`, relative to a page under `diagrams/`. Every generated
 * type page lives at the same depth, so these are fixed rather than
 * threaded through as props.
 */
const HOME_HREF = '../'
const NAV_HREFS = {
  diagrams: './',
  editor: '../editor',
  forkFixes: '../fork-fixes.html',
  blog: '../blog/',
  github: FORK_URL,
} as const

/**
 * The footer's Product/Resources/Project columns, shared by every page this
 * file renders — `DiagramTypePage` and `DiagramHubPage` alike sit at
 * `diagrams/*.html`, so both point at the same three destinations relative
 * to that depth.
 */
const DETAIL_FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Diagrams', href: NAV_HREFS.diagrams },
      { label: 'Editor', href: NAV_HREFS.editor },
      { label: 'Fork fixes', href: NAV_HREFS.forkFixes },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: NAV_HREFS.blog },
      { label: 'GitHub', href: NAV_HREFS.github },
      { label: 'npm package', href: NPM_URL },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'MIT Licensed' },
      { label: 'dfadler/zombie-mermaid', href: NAV_HREFS.github },
    ],
  },
]

/**
 * A block that either has one rendering, or a wide/narrow pair swapped by
 * demo/styles.css's `.orientation-variant` media query (see
 * demo/diagram-orientation.ts).
 */
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

/* -----------------------------------------------------------------
 * Page-specific CSS
 * ----------------------------------------------------------------- */

/**
 * This template's own rules: the animated crosslink/render-panel glyphs
 * (transcribed from the FlowchartDetail artboard's shared animation block —
 * see this file's header), the breadcrumb, the crosslink card's hover/flex
 * shape, and the two responsive overrides the artboard's own preamble
 * declares for this page (`.detail-row`, `.page-h1`) that don't belong in
 * any shared component's own CSS function.
 *
 * Also forces shiki's own inline `background-color` transparent: shiki
 * paints that per-`<pre>`, at the highest specificity short of `!important`
 * in an external rule, and the highlighter runs in the `github-dark` theme
 * (see pages.ts's `highlightSource`) specifically so its own text-token
 * colours already read correctly against this page's dark `.card` — only
 * the opaque light-chip background it also paints needs suppressing.
 *
 * Emit once per page, after shared-page-css.tsx's `sharedPageCss()` (via
 * `SharedPageStyles`) — this reuses `.card`, `.pill`, and `.section-eyebrow`,
 * and `.section-px`'s responsive gutter (declared once, generically, by
 * `footerCss()`) rather than redeclaring them.
 */
function pageCss(): string {
  return `@keyframes marchingAnts { to { stroke-dashoffset: -24; } }
.edge-anim { stroke-dasharray: 6 6; animation: marchingAnts 0.9s linear infinite; }

@keyframes radarPing {
  0% { r: 14; opacity: 0.55; stroke-width: 2; }
  100% { r: 27; opacity: 0; stroke-width: 0.5; }
}
.radar-ping { transform-origin: center; animation: radarPing 1.8s ease-out infinite; }

@keyframes msgFlowRight { to { stroke-dashoffset: -16; } }
@keyframes msgFlowLeft { to { stroke-dashoffset: 16; } }
.msg-flow-right { stroke-dasharray: 4 4; animation: msgFlowRight 1.1s linear infinite; }
.msg-flow-left { stroke-dasharray: 4 4; animation: msgFlowLeft 1.1s linear 0.55s infinite; }

@keyframes drawLine {
  0% { stroke-dashoffset: 56; }
  55%, 100% { stroke-dashoffset: 0; }
}
.draw-line { stroke-dasharray: 56; animation: drawLine 2.8s ease-in-out infinite; }

@keyframes relationPulse {
  0%, 100% { opacity: 0.45; stroke-width: 2; }
  50% { opacity: 1; stroke-width: 3; }
}
.relation-pulse { transform-origin: center; animation: relationPulse 1.8s ease-in-out infinite; }

@keyframes barGrow {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.4); }
}
.bar-grow { transform-box: fill-box; transform-origin: bottom; animation: barGrow 1.6s ease-in-out infinite; }

${MEDIA.reducedMotion} {
  .edge-anim { animation: none; }
  .radar-ping { animation: none; opacity: 0; }
  .msg-flow-right { animation: none; }
  .msg-flow-left { animation: none; }
  .draw-line { animation: none; stroke-dashoffset: 0; }
  .relation-pulse { animation: none; }
  .bar-grow { animation: none; transform: scaleY(1); }
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: ${SPACE.sm}px;
  font-size: ${FONT_SIZE.bodySm}px;
  color: ${colorVar('--text-faint')};
}

.code-card { overflow: hidden; display: flex; flex-direction: column; }

.crosslink-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${SPACE.md}px;
  text-decoration: none;
}
.crosslink-card:hover { color: ${colorVar('--text')}; }

.shiki { background: transparent !important; }

${MEDIA.tablet} {
  .detail-row { flex-direction: column !important; }
  /*
   * .code-card and .diagram-frame both get an inline flex: '1 1 0' (see
   * the DiagramTypePage markup below) to split .detail-row's width evenly
   * side-by-side above this breakpoint. Once .detail-row flips to a
   * column here, that flex-basis: 0 combines with .code-card's
   * overflow: hidden to collapse it to ~0 height: a flex item's
   * automatic min-height (min-height: auto, letting it grow to fit
   * content) is spec'd to resolve to 0 whenever overflow isn't visible
   * (https://www.w3.org/TR/css-flexbox-1/#min-size-auto), so with no
   * explicit height on .detail-row to grow into, the item shrinks to
   * nothing instead of sizing to its content. overflow: hidden stays on
   * .code-card (it clips the file-tab header's square corners to the
   * card's own rounded ones) rather than being removed, and .diagram-frame
   * doesn't set overflow so it never hit this; only .code-card needs the
   * override. Switching to flex-basis: auto sizes both from their content
   * instead of 0, which sidesteps the automatic-minimum substitution
   * entirely rather than fighting it with a magic-number min-height.
   */
  .code-card, .diagram-frame { flex: 1 1 auto !important; }
}

${MEDIA.mobile} {
  .page-h1 { font-size: ${FONT_SIZE.h1Mobile}px !important; }
}`
}

/** {@link pageCss} in a `<style>` element, for this page's `<head>`. */
function PageStyle() {
  return <style>{pageCss()}</style>
}

/* -----------------------------------------------------------------
 * DiagramTypePage
 * ----------------------------------------------------------------- */

export interface DiagramTypePageProps {
  label: string
  slug: string
  /** The type's one-paragraph description, under the page `h1`. */
  intro: string
  /**
   * Which of primitives.tsx's six accents this type owns — see
   * demo/diagram-pages-data.ts's `DiagramTypeProfile.accent`. Colours the
   * breadcrumb's current crumb, the "Source → render" cards' border/glow,
   * and this type's own eyebrow.
   */
  accent: Accent
  /** The "Source → render" section's h2 — see `DiagramTypeProfile.exampleHeading`. */
  exampleHeading: string
  /** The source panel's file-tab label — see `DiagramTypeProfile.sourceFilename`. */
  sourceFilename: string
  title: string
  description: string
  canonical: string
  faviconHref: string
  /**
   * The combined stylesheet pages.ts already writes to
   * `diagrams/assets/diagram-page.css` (demo/styles.css + this page's own
   * legacy demo/diagram-page.css) — still needed here for the theme
   * picker's pill/dropdown styling, `.orientation-variant`'s responsive
   * swap, and `.diagram-frame svg`, all of which
   * demo/diagram-page-client.ts's selectors depend on. This template's own
   * redesigned chrome (Nav, Footer, the section layout) is emitted inline
   * instead — see {@link PageStyle} and the *Style components this
   * function renders — so no second external stylesheet is needed.
   */
  cssHref: string
  /** shiki-highlighted Mermaid source, one or two orientation variants. */
  sourcePanelHtml: OrientationVariants
  /** The rendered SVG, one or two orientation variants. */
  diagramHtml: OrientationVariants
  /** `../editor#<base64 payload>` — see pages.ts's `editorHash`. */
  editorHref: string
  /** Every diagram type (including this page's own), for the crosslink grid. */
  types: readonly DiagramCrosslink[]
  themePills: ReactNode
  /** The inline `<script>` seeding `window.__diagramPage*`, already escaped. */
  themeDataScript: string
  clientScriptSrc: string
}

/** The page's `<head>` — StaticPage's metadata shape, but with the redesign's own fonts and inline CSS instead of site-chrome.tsx's `FontLinks`/external stylesheet. */
function DetailHead({
  title,
  description,
  canonical,
  faviconHref,
  cssHref,
  extraStyle = <PageStyle />,
}: Pick<
  DiagramTypePageProps,
  'title' | 'description' | 'canonical' | 'faviconHref' | 'cssHref'
> & {
  /**
   * The page-specific `<style>` beyond the shared design/primitives/nav/
   * footer CSS every page under `diagrams/` emits. Defaults to
   * {@link PageStyle} (`DiagramTypePage`'s own rules); `DiagramHubPage`
   * passes {@link HubPageStyle} instead, since it shares this head shape but
   * needs a different small set of page-specific rules.
   */
  extraStyle?: ReactNode
}) {
  return (
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonical} />
      <meta name="twitter:card" content="summary" />
      <link rel="icon" type="image/svg+xml" href={faviconHref} />
      <DesignFontLinks />
      <link rel="stylesheet" href={cssHref} />
      <SharedPageStyles />
      {extraStyle}
    </head>
  )
}

/** The `Home / Diagrams / <Label>` crumb trail, the current type tinted with its accent. */
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

/** One diagram-type landing page, e.g. diagrams/flowchart.html. */
export function DiagramTypePage({
  label,
  slug,
  intro,
  accent,
  exampleHeading,
  sourceFilename,
  title,
  description,
  canonical,
  faviconHref,
  cssHref,
  sourcePanelHtml,
  diagramHtml,
  editorHref,
  types,
  themePills,
  themeDataScript,
  clientScriptSrc,
}: DiagramTypePageProps) {
  return (
    <html lang="en">
      <DetailHead
        title={title}
        description={description}
        canonical={canonical}
        faviconHref={faviconHref}
        cssHref={cssHref}
      />
      <body>
        <div
          className="dc-root"
          style={{
            fontFamily: 'var(--font-body)',
            color: colorVar('--text'),
            width: '100%',
            // 1440px in the artboard: LAYOUT.maxWidth (1280, the inner
            // content column every section below centres) plus its own
            // 80px gutter on each side -- the outer frame the artboard
            // itself renders at, one level up from the content column.
            maxWidth: `${LAYOUT.maxWidth + 2 * LAYOUT.gutter.desktop}px`,
            margin: '0 auto',
            background:
              'linear-gradient(180deg, #0a0d16 0%, #0d1120 40%, #0a0d16 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Nav active="diagrams" homeHref={HOME_HREF} hrefs={NAV_HREFS} />

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
                <CTA
                  href={editorHref}
                  accent={accent}
                  className="cta-btn primary"
                >
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

          {/* ============ THEME PICKER ============ */}
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
              <SectionEyebrow>Pick a look</SectionEyebrow>
              <h2
                style={{
                  fontSize: '30px',
                  letterSpacing: LETTER_SPACING.heading,
                }}
              >
                Live in every built-in theme.
              </h2>
              <div
                className="theme-pills"
                id="theme-pills"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: `${SPACE.md}px`,
                  alignItems: 'flex-start',
                }}
              >
                {themePills}
              </div>
            </div>
          </div>

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

          <Footer columns={DETAIL_FOOTER_COLUMNS} />
        </div>

        <script
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from DIAGRAM_TYPE_PROFILES, escaped with escapeJsonForScriptTag; never user input
          dangerouslySetInnerHTML={{ __html: themeDataScript }}
        />
        <script type="module" src={clientScriptSrc} />
        <NavCopyScript />
        <NavMobileMenuScript />
      </body>
    </html>
  )
}

/* -----------------------------------------------------------------
 * DiagramHubPage
 * ----------------------------------------------------------------- */

/**
 * Every diagram type's large hero icon on the hub, keyed by
 * `DiagramTypeProfile.slug` — the animated components icons.tsx (#597)
 * ships but nothing yet consumes (see that file's own doc comment on
 * `DIAGRAM_TYPE_ICONS`). Each already carries its own accent-scoped
 * `<style>`/keyframes and `prefers-reduced-motion` guard, so this page emits
 * no extra animation CSS of its own — unlike {@link DIAGRAM_TYPE_GLYPHS}
 * above, which are the small hand-drawn crosslink glyphs `pageCss` styles.
 *
 * `color` is passed explicitly at each render site rather than relying on
 * an icon's own default accent: icons.tsx's per-icon `defaultColor` and this
 * page's own per-type {@link Accent} (from `DIAGRAM_TYPE_PROFILES`, matching
 * the `DiagramGallery` canvas artboard exactly) disagree for Class/ER/XY
 * chart — icons.tsx and tokens.tsx's `--amber`/`--green` doc comments assign
 * Class→pink/ER→green/XY chart→amber, while the canvas's own gallery and
 * `FlowchartDetail`'s crosslink cards (and so `DIAGRAM_TYPE_PROFILES.accent`)
 * assign Class→amber/ER→pink/XY chart→green. Passing `color` keeps this
 * page's icon, card border, and CTA in agreement regardless of that
 * upstream mismatch, which is icons.tsx's to resolve, not this page's.
 */
const HUB_TYPE_ICONS: Record<
  string,
  (props: DiagramTypeIconProps) => ReactNode
> = {
  flowchart: FlowchartIcon,
  state: StateIcon,
  sequence: SequenceIcon,
  class: ClassIcon,
  er: ErIcon,
  'xy-chart': XyChartIcon,
}

/** A hero icon's rendered size in px — large enough to anchor a 460×360 icon panel. */
const HUB_ICON_SIZE = 200

/**
 * Ink for a solid-accent CTA that needs to darken into the accent's own hue
 * instead of primitives.tsx's default `--bg`. Amber is the one accent the
 * `DiagramGallery` canvas overrides this way (`color:#241703`); see
 * primitives.tsx's `SOLID_INK` doc comment, which names this exact value.
 */
const AMBER_CTA_INK = '#241703'

/**
 * This page's own rules, beyond the shared design/primitives/nav/footer CSS
 * every page under `diagrams/` emits (see {@link DetailHead}). The
 * breadcrumb rule is duplicated from {@link pageCss} rather than shared,
 * same as that function's own relationship to primitives.tsx's `.card`/
 * `.pill` — small enough that one definition per page reads better than a
 * new shared export two call sites would use.
 *
 * The two responsive rules are this page's own transcription of the
 * `DiagramGallery` canvas artboard's `@media` blocks: a type row collapses
 * to a single column, and its icon panel drops from a fixed 460×360 to a
 * full-width strip (280px tall, then 220px at the narrower breakpoint) —
 * `.page-h1` shrinking at the same 600px breakpoint is shared with
 * {@link DiagramTypePage}. `navCss`/`footerCss` already carry the nav-bar
 * and footer-grid rules the canvas's own preamble bundles alongside these.
 */
function hubPageCss(): string {
  return `.breadcrumb {
  display: flex;
  align-items: center;
  gap: ${SPACE.sm}px;
  font-size: ${FONT_SIZE.bodySm}px;
  color: ${colorVar('--text-faint')};
}

${MEDIA.tablet} {
  .type-row { flex-direction: column !important; }
  .icon-panel-fixed { flex: 1 1 auto !important; width: 100% !important; height: 280px !important; }
}

${MEDIA.mobile} {
  .page-h1 { font-size: ${FONT_SIZE.h1Mobile}px !important; }
  .icon-panel-fixed { height: 220px !important; }
}`
}

/** {@link hubPageCss} in a `<style>` element, for `DiagramHubPage`'s `<head>`. */
function HubPageStyle() {
  return <style>{hubPageCss()}</style>
}

/** The `Home / Diagrams` crumb trail — this page's own last crumb is never a link, since it's the current page. */
function HubBreadcrumb() {
  return (
    <div className="breadcrumb mono">
      <a href={HOME_HREF}>Home</a>
      <ChevronRightIcon size={12} strokeWidth={2.4} />
      <span style={{ color: colorVar('--text-dim') }}>Diagrams</span>
    </div>
  )
}

export interface DiagramHubPageProps {
  title: string
  description: string
  canonical: string
  cssHref: string
  faviconHref: string
  themeCount: number
  /**
   * Every diagram type, in display order — `pages.ts` builds this from
   * `DIAGRAM_TYPE_PROFILES`, so `label`/`slug`/`intro`/`accent` all come from
   * that single source of truth rather than being retyped here.
   */
  types: ReadonlyArray<DiagramTypeLink & { intro: string; accent: Accent }>
  /**
   * The bundled `demo/theme-bar-only-client.ts` script (via `demo/build-
   * theme-bar-client.ts`'s `bundleThemeBarClient()`), inlined so the hub's
   * `ThemePickerSection` (#687) is interactive — pill selection persists
   * through `demo/theme-state.ts`, same as every other page that mounts
   * that section.
   */
  themeBarScript: string
}

/** One diagram type's row: hero icon panel, index/label/intro, and a "View examples" CTA to its real detail page. */
function DiagramTypeRow({
  type,
  index,
  total,
}: {
  type: DiagramTypeLink & { intro: string; accent: Accent }
  index: number
  total: number
}) {
  // The canvas bands every other row with `--bg-soft` + hairline borders and
  // reverses the icon/text order on the ones in between (see
  // `DiagramGallery.dc.html`'s six `<div id="…">` sections) — one boolean
  // drives both, since a banded row is always the "normal" direction and an
  // unbanded one always "reverse".
  const isBanded = index % 2 === 0
  const isReversed = !isBanded
  const isLast = index === total - 1
  const Icon = HUB_TYPE_ICONS[type.slug]
  const accent = accentVar(type.accent)
  const ctaStyle: CSSProperties | undefined =
    type.accent === 'amber' ? { color: AMBER_CTA_INK } : undefined

  return (
    <div
      id={type.slug}
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.default}px ${LAYOUT.gutter.desktop}px ${
          isLast ? SECTION_SPACE.hero : SECTION_SPACE.default
        }px ${LAYOUT.gutter.desktop}px`,
        background: isBanded ? colorVar('--bg-soft') : undefined,
        borderTop: isBanded ? `1px solid ${colorVar('--border')}` : undefined,
        borderBottom: isBanded
          ? `1px solid ${colorVar('--border')}`
          : undefined,
      }}
    >
      <div
        className={isReversed ? 'type-row reverse' : 'type-row'}
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'flex',
          flexDirection: isReversed ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: `${SPACE['8xl']}px`,
        }}
      >
        <Card
          accent={type.accent}
          tone="glow"
          className="icon-panel icon-panel-fixed"
          style={{
            flex: '0 0 460px',
            height: '360px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {Icon ? <Icon size={HUB_ICON_SIZE} color={accent} /> : null}
        </Card>
        <div
          style={{
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE['2xl']}px`,
          }}
        >
          <span
            className="type-index mono"
            style={{
              color: accent,
              fontSize: `${FONT_SIZE.bodySm}px`,
              fontWeight: FONT_WEIGHT.bold,
              letterSpacing: '0.1em',
            }}
          >
            {String(index + 1).padStart(2, '0')} /{' '}
            {String(total).padStart(2, '0')}
          </span>
          {/* 34px is off tokens.tsx's FONT_SIZE scale (h3/h2 are the
              neighbours, 26/32) -- the canvas's own literal for this
              heading, kept as-is rather than rounded to either step. */}
          <h2
            style={{ fontSize: '34px', letterSpacing: LETTER_SPACING.heading }}
          >
            {type.label}
          </h2>
          <p
            style={{
              fontSize: `${FONT_SIZE.lead}px`,
              lineHeight: 1.65,
              color: colorVar('--text-dim'),
              maxWidth: '640px',
            }}
          >
            {type.intro}
          </p>
          <CTA
            href={`${type.slug}.html`}
            accent={type.accent}
            style={{
              width: 'fit-content',
              marginTop: `${SPACE.xs}px`,
              ...ctaStyle,
            }}
          >
            View examples
          </CTA>
        </div>
      </div>
    </div>
  )
}

/**
 * diagrams/index.html — the hub listing every generated type page, one row
 * per type: its animated icon, name, description, and a real "View
 * examples" link to that type's own detail page (#600, part of #599). Every
 * structural choice here is the `DiagramGallery` canvas artboard's own
 * (confirmed byte-identical to `DiagramGalleryMobile` — see the file
 * header); `types`' content is `pages.ts`'s, sourced from
 * `DIAGRAM_TYPE_PROFILES` rather than duplicated here (see that prop's doc
 * comment) — so a Class/ER/XY-chart `intro` that doesn't yet match the
 * canvas's own gallery copy for those three types (#602-606 own bringing it
 * in line) shows up here exactly as `DIAGRAM_TYPE_PROFILES` has it today,
 * and updates automatically once that lands.
 */
export function DiagramHubPage({
  title,
  description,
  canonical,
  cssHref,
  faviconHref,
  themeCount,
  types,
  themeBarScript,
}: DiagramHubPageProps) {
  return (
    <html lang="en">
      <DetailHead
        title={title}
        description={description}
        canonical={canonical}
        faviconHref={faviconHref}
        cssHref={cssHref}
        extraStyle={
          <>
            <HubPageStyle />
            <ThemePickerStyle />
          </>
        }
      />
      <body>
        <div
          className="dc-root"
          style={{
            fontFamily: 'var(--font-body)',
            color: colorVar('--text'),
            width: '100%',
            maxWidth: `${LAYOUT.maxWidth + 2 * LAYOUT.gutter.desktop}px`,
            margin: '0 auto',
            background:
              'linear-gradient(180deg, #0a0d16 0%, #0d1120 40%, #0a0d16 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Nav active="diagrams" homeHref={HOME_HREF} hrefs={NAV_HREFS} />

          {/* ============ PAGE HEADER ============ */}
          <div
            className="section-px"
            style={{
              padding: `${SECTION_SPACE.snug}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.default}px ${LAYOUT.gutter.desktop}px`,
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
              <HubBreadcrumb />
              <h1
                className="page-h1"
                style={{
                  fontSize: `${FONT_SIZE.display}px`,
                  lineHeight: 1.08,
                  letterSpacing: LETTER_SPACING.display,
                  maxWidth: '820px',
                }}
              >
                Every diagram type.
              </h1>
              <p
                style={{
                  fontSize: '18px',
                  lineHeight: 1.6,
                  color: colorVar('--text-dim'),
                  maxWidth: '680px',
                }}
              >
                zombie-mermaid renders {types.length} Mermaid diagram types,
                each with a live picker across every one of its {themeCount}{' '}
                built-in themes.
              </p>
            </div>
          </div>

          {/* ============ TYPE ROWS ============ */}
          {types.map((type, index) => (
            <DiagramTypeRow
              key={type.slug}
              type={type}
              index={index}
              total={types.length}
            />
          ))}

          <ThemePickerSection tinted />

          <Footer columns={DETAIL_FOOTER_COLUMNS} />
        </div>
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/theme-bar-only-client.ts bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: themeBarScript }}
        />
        <NavCopyScript />
        <NavMobileMenuScript />
      </body>
    </html>
  )
}
