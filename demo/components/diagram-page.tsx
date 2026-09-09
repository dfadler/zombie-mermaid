/** @jsxRuntime automatic */
/**
 * The per-diagram-type SEO pages and their hub page (pages.ts →
 * diagrams/*.html) as React components.
 *
 * As of zombie-mermaid#805, this file holds only the page *shells*
 * (`<html>`/`<head>`, the `NavIsland`/`ThemePickerIsland`-or-
 * `ThemePickerSection`/`Footer` sibling islands, the hydration
 * containers/script wiring) — the hydrated body content lives in
 * `diagram-type-app.tsx`'s `DiagramTypeApp` and `diagram-hub-app.tsx`'s
 * `DiagramHubApp`, split out specifically so `demo/diagram-type-
 * client.tsx`/`demo/diagram-hub-client.tsx` (the browser bundles) never
 * need to import this file, and therefore never pull in `react-dom/
 * server` (used below for `renderToString`) into either client bundle —
 * see those two app files' own header comments, and `dashboard-app.tsx`'s
 * (the pattern this mirrors) for the full rationale.
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
 * footer.tsx's `footerCss`, not in a second markup path).
 *
 * `DiagramHubPage` (diagrams/index.html) applies the same redesign, sourced
 * from the canvas's `DiagramGallery` artboard (confirmed byte-identical to
 * `DiagramGalleryMobile`, same as `FlowchartDetail` above) — see
 * `diagram-hub-app.tsx`'s `DiagramHubApp` doc comment for what's the
 * canvas's and what's this file's addition (#600, part of #599, part of
 * the #590 redesign).
 *
 * Pure functions of already-computed data: pages.ts still owns the I/O and
 * the rendering work (renderMermaidSVG, shiki, esbuild), and hands the
 * results here.
 *
 * The re-theming behavior beyond the theme picker itself — swapping the
 * rendered `<svg>`'s CSS custom properties, the page chrome's `--t-*`
 * variables, and the "Open in the live editor" link's encoded theme — is
 * deliberately **not** rewritten as React state by #805: `demo/diagram-
 * page-client.ts`'s own header comment documents this as a perf-motivated
 * design choice ("no re-render... since renderMermaidSVG's output is
 * already parameterized entirely by --bg/--fg"), and converting it to
 * state-driven re-rendering would regress that deliberately, for a page
 * whose own issue text calls out bundle-size sensitivity as a real
 * concern. `demo/diagram-type-client.tsx` (replacing `demo/diagram-page-
 * client.ts`) keeps that same imperative CSS-variable-swap code verbatim,
 * now living alongside the new `hydrateRoot()` calls in one bundle rather
 * than a second, separate one — see that file's own header comment.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { escapeJsonForScriptTag } from '../format.ts'
import { Footer, type FooterColumn } from './footer.tsx'
import { NavMobileMenuScript } from './nav.tsx'
import { NavIsland } from './nav-island.tsx'
import { SharedPageStyles } from './shared-page-css.tsx'
import { ThemePickerSection } from './theme-picker-section.tsx'
import { ThemePickerStyle } from './theme-picker.tsx'
import { ThemePickerIsland } from './theme-picker-island.tsx'
import { SectionEyebrow, type Accent } from './primitives.tsx'
import {
  DesignFontLinks,
  FONT_SIZE,
  LAYOUT,
  LETTER_SPACING,
  MEDIA,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'
import {
  DiagramTypeApp,
  DIAGRAM_TYPE_PROPS_ELEMENT_ID,
  DIAGRAM_TYPE_ROOT_ID,
  HOME_HREF,
  NAV_HREFS,
  type DiagramCrosslink,
  type DiagramTypeAppProps,
  type DiagramTypeLink,
  type GalleryItem,
  type OrientationVariants,
} from './diagram-type-app.tsx'
import {
  DiagramHubApp,
  DIAGRAM_HUB_PROPS_ELEMENT_ID,
  DIAGRAM_HUB_ROOT_ID,
  type DiagramHubAppProps,
} from './diagram-hub-app.tsx'

// Re-exported for existing callers/tests that import these from
// diagram-page.tsx rather than diagram-type-app.tsx/diagram-hub-app.tsx
// directly (this file was the sole home for all of them before the #805
// split).
export {
  DiagramTypeApp,
  DIAGRAM_TYPE_PROPS_ELEMENT_ID,
  DIAGRAM_TYPE_ROOT_ID,
  HOME_HREF,
  NAV_HREFS,
  OtherTypesGrid,
  type DiagramCrosslink,
  type DiagramTypeAppProps,
  type DiagramTypeLink,
  type GalleryItem,
  type OrientationVariants,
} from './diagram-type-app.tsx'
export {
  DiagramHubApp,
  DIAGRAM_HUB_PROPS_ELEMENT_ID,
  DIAGRAM_HUB_ROOT_ID,
  type DiagramHubAppProps,
} from './diagram-hub-app.tsx'

/**
 * The site's npm package listing, linked from the footer's Resources
 * column. Duplicated from demo/components/index-page.tsx's own
 * module-private `NPM_URL` rather than importing it — that module doesn't
 * export it, and this page owns its own footer link destinations.
 */
const NPM_URL = 'https://www.npmjs.com/package/zombie-mermaid'

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

/*
 * "More examples" (#714/#715). .gallery-grid is a 3-column CSS grid,
 * dropping to 2 (tablet) then 1 (mobile) below. .gallery-thumb is the
 * fixed-aspect frame that fixes #708's card-sizing bug: a rendered SVG's
 * own width/height attributes only set its *initial* CSS size, so the
 * plain-specificity ".gallery-thumb svg" rule below overrides them to
 * 100%/100% -- combined with the SVG's default preserveAspectRatio
 * ("xMidYMid meet"), that letterboxes any intrinsic aspect ratio inside
 * the frame instead of the frame growing to the diagram's natural size.
 * .gallery-more is a plain <details> disclosure (no client script) for
 * the "Show N more" affordance -- see MoreExamplesSection's doc comment.
 */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${SPACE['2xl']}px;
}
.gallery-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  text-decoration: none;
  transition: border-color 0.15s ease;
}
.gallery-thumb {
  aspect-ratio: 4 / 3;
  width: 100%;
  background: ${colorVar('--bg-soft')};
  border-bottom: 1px solid ${colorVar('--border')};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: ${SPACE.md}px;
}
.gallery-thumb svg { width: 100%; height: 100%; display: block; }
.gallery-label {
  padding: ${SPACE.xl}px ${SPACE['2xl']}px;
}
.gallery-title {
  font-size: ${FONT_SIZE.bodySm}px;
  font-weight: 600;
  color: ${colorVar('--text')};
}
.gallery-more summary {
  list-style: none;
  cursor: pointer;
  width: fit-content;
}
.gallery-more summary::-webkit-details-marker { display: none; }
.gallery-more[open] summary { margin-bottom: ${SPACE['2xl']}px; }

${MEDIA.tablet} {
  .gallery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

${MEDIA.mobile} {
  .gallery-grid { grid-template-columns: repeat(1, minmax(0, 1fr)); }
  .gallery-more summary { width: 100%; justify-content: center; }
}

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
   * swap, and `.diagram-frame svg`/`.gallery-thumb svg`, all of which
   * demo/diagram-type-client.tsx's selectors depend on. This template's own
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
  /**
   * The samples-data.ts#713 curation for this type (`sample.gallery ===
   * true`), each already rendered — see `demo/diagram-pages-data.ts`'s
   * `moreExamplesFor`. Renders as {@link MoreExamplesSection}, or not at
   * all when empty (no type currently has zero, but the section degrades
   * gracefully rather than assuming a non-empty array).
   */
  galleryItems: readonly GalleryItem[]
  /** Every diagram type (including this page's own), for the crosslink grid. */
  types: readonly DiagramCrosslink[]
  /** The inline `<script>` seeding `window.__diagramPage*`, already escaped. */
  themeDataScript: string
  /**
   * The bundled `demo/diagram-type-client.tsx` entry (zombie-mermaid#805,
   * replacing `demo/diagram-page-client.ts`) that hydrates {@link
   * DiagramTypeApp}, `<NavIsland>` (via `hydrateNav()`), and the theme
   * picker (via `hydrateThemeBar()`) — one bundle for all three, mirroring
   * `dashboard-client.tsx`/`fork-fixes-client.tsx`'s exact pattern, and
   * replacing the separate `nav-only-client.tsx` bundle this page used
   * before. Loaded as an external `<script type="module" src>` rather
   * than inlined, unlike smaller pages' `clientScript` — this bundle is
   * the most bundle-size-sensitive one in the #797 epic (see this file's
   * header comment), and an external, cacheable, parallel-loadable asset
   * is strictly better for that than inlining regardless.
   */
  clientScriptSrc: string
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
  galleryItems,
  types,
  themeDataScript,
  clientScriptSrc,
}: DiagramTypePageProps) {
  const appProps: DiagramTypeAppProps = {
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
  }
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
            // No maxWidth/margin cap here, unlike the artboard's own 1440px
            // outer frame: every other page's header (index-page.tsx,
            // blog-page.tsx, fork-fixes-page.tsx) spans the full viewport
            // width, with only each section's own inner content column
            // (LAYOUT.maxWidth, centred) bounded — capping this wrapper
            // instead left the diagrams pages' header floating with visible
            // side gaps on wide viewports while every other page's header
            // ran edge to edge.
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
          <NavIsland active="diagrams" homeHref={HOME_HREF} hrefs={NAV_HREFS} />

          {/*
            Plain, inert hydration container -- see dashboard-app.tsx's
            DASHBOARD_ROOT_ID doc comment for why DiagramTypeApp's own root
            can't carry this id itself, and dashboard-page.tsx's own, more
            detailed version of this comment for why renderToString (not
            renderToStaticMarkup) is needed here.
          */}
          <div
            id={DIAGRAM_TYPE_ROOT_ID}
            dangerouslySetInnerHTML={{
              // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this page's own DiagramTypeApp component tree rendered via renderToString (see the comment above); never user input
              __html: renderToString(<DiagramTypeApp {...appProps} />),
            }}
          />
          <script
            type="application/json"
            id={DIAGRAM_TYPE_PROPS_ELEMENT_ID}
            dangerouslySetInnerHTML={{
              // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from this page's own DiagramTypeAppProps, escaped with escapeJsonForScriptTag; never user input
              __html: escapeJsonForScriptTag(JSON.stringify(appProps)),
            }}
          />

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
              {/*
                Plain sibling JSX, not part of DiagramTypeApp's hydrated
                tree -- see diagram-type-app.tsx's header comment for why
                (the same reasoning dashboard-page.tsx/fork-fixes-
                page.tsx/blog-page.tsx/index-page.tsx follow).
              */}
              <ThemePickerIsland
                includeDefault
                activeThemeKey=""
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: `${SPACE.md}px`,
                  alignItems: 'flex-start',
                }}
              />
            </div>
          </div>

          <Footer columns={DETAIL_FOOTER_COLUMNS} />
        </div>

        <script
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from DIAGRAM_TYPE_PROFILES, escaped with escapeJsonForScriptTag; never user input
          dangerouslySetInnerHTML={{ __html: themeDataScript }}
        />
        <script type="module" src={clientScriptSrc} />
        <NavMobileMenuScript />
      </body>
    </html>
  )
}
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
   * that section. Unchanged by #805: the hub has no live diagram of its
   * own to re-theme, so it keeps its own small, separate theme-bar-only
   * bundle rather than sharing `demo/diagram-type-client.tsx`'s heavier
   * one.
   */
  themeBarScript: string
  /**
   * The bundled `demo/diagram-hub-client.tsx` entry (zombie-mermaid#805)
   * that hydrates {@link DiagramHubApp} and `<NavIsland>` (via
   * `hydrateNav()`) — one bundle for both, mirroring `dashboard-
   * client.tsx`'s exact pattern, and replacing the separate `nav-only-
   * client.tsx` bundle this page used before. Defaults to `''` (no
   * hydration script at all — SSR-only), matching every other page's
   * `clientScript` default.
   */
  clientScript?: string
}

/** diagrams/index.html — the hub listing every generated type page, one row
 * per type: its animated icon, name, description, and a real "View
 * examples" link to that type's own detail page (#600, part of #599). */
export function DiagramHubPage({
  title,
  description,
  canonical,
  cssHref,
  faviconHref,
  themeCount,
  types,
  themeBarScript,
  clientScript = '',
}: DiagramHubPageProps) {
  const appProps: DiagramHubAppProps = { themeCount, types }
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
            // No maxWidth/margin cap -- see DiagramTypePage's identical
            // wrapper for why (keeps this page's header full-width, matching
            // every other page, instead of floating with side gaps).
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
          <NavIsland active="diagrams" homeHref={HOME_HREF} hrefs={NAV_HREFS} />

          {/*
            Plain, inert hydration container -- see DiagramTypePage's
            identical comment above.
          */}
          <div
            id={DIAGRAM_HUB_ROOT_ID}
            dangerouslySetInnerHTML={{
              // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this page's own DiagramHubApp component tree rendered via renderToString (see the comment above); never user input
              __html: renderToString(<DiagramHubApp {...appProps} />),
            }}
          />
          <script
            type="application/json"
            id={DIAGRAM_HUB_PROPS_ELEMENT_ID}
            dangerouslySetInnerHTML={{
              // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from this page's own DiagramHubAppProps, escaped with escapeJsonForScriptTag; never user input
              __html: escapeJsonForScriptTag(JSON.stringify(appProps)),
            }}
          />

          <ThemePickerSection tinted />

          <Footer columns={DETAIL_FOOTER_COLUMNS} />
        </div>
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/theme-bar-only-client.ts bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: themeBarScript }}
        />
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/diagram-hub-client.tsx bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: clientScript }}
        />
        <NavMobileMenuScript />
      </body>
    </html>
  )
}
