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
 * `IndexMainApp` takes no props: every feature/proof-snapshot/latest-post
 * value is a fixed marketing constant, not per-render data (contrast
 * `DashboardApp`'s `viewModel` or `ForkFixesApp`'s `fixes`). `IndexHeroApp`
 * is the one exception — its {@link IndexHeroAppProps}' `asciiHtml` is real
 * per-build data (the real `renderMermaidASCII()` output for the hero's
 * output-panel toggle), computed by `index-page.tsx` and threaded through
 * hydration via a `<script type="application/json" id={INDEX_HERO_PROPS_ELEMENT_ID}>`
 * element, the same `diagram-type-app.tsx`/`demo/diagram-type-client.tsx`
 * pattern `demo/index-client.tsx`'s `readIndexHeroAppProps()` mirrors. The
 * page's one other piece of real per-build data, the
 * `SoftwareApplication` JSON-LD block, lives entirely in `<head>` (never
 * inside either app's `<body>` hydration boundary — no page's `<head>` is
 * ever part of a `hydrateRoot()` call anywhere in this codebase) and stays
 * untouched, rendered by `index-page.tsx`'s shell exactly as before this
 * split.
 *
 * This file is a thin composition of the sections below, each in its own
 * file (zombie-mermaid#932 split each of ~15 unrelated presentational
 * components with no shared state out of what used to be a single
 * 2,200-line file):
 *
 * - `hero-output-panel.tsx` — {@link HeroCodePanel}/{@link HeroOutputPanel}
 *   (the hero's SVG/ASCII toggle; `hero-visual.tsx`'s `HeroVisual` no
 *   longer renders on the homepage — it stays only as the README's
 *   `hero.svg` source, see that file's own header comment)
 * - `hero-install.tsx` — {@link HeroInstall}
 * - `why-fork-section.tsx` — {@link WhyForkExistsSection}
 * - `feature-pillars.tsx` — {@link FeaturePillars}
 * - `cli-panel.tsx` / `mcp-panel.tsx` / `cli-mcp-section.tsx` — {@link
 *   CliPanel}/{@link McpPanel}, composed by {@link CliMcpSection}
 * - `gallery-tiles.tsx` / `diagram-gallery-teaser.tsx` — the six diagram-
 *   type tile illustrations, composed by {@link DiagramGalleryTeaser}
 * - `slot-digit.tsx` / `slot-number.tsx` — {@link SlotDigit}/{@link
 *   SlotNumber}, the animated stat-count reels
 * - `proof-section.tsx` — {@link ProofSection}
 * - `blog-teaser.tsx` — {@link BlogTeaser}
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { HeroInstall } from './hero-install.tsx'
import { HeroCodePanel, HeroOutputPanel } from './hero-output-panel.tsx'
import { WhyForkExistsSection } from './why-fork-section.tsx'
import { FeaturePillars } from './feature-pillars.tsx'
import { CliMcpSection } from './cli-mcp-section.tsx'
import { DiagramGalleryTeaser } from './diagram-gallery-teaser.tsx'
import { ProofSection } from './proof-section.tsx'
import { BlogTeaser } from './blog-teaser.tsx'
import { CTA, SectionEyebrow } from './primitives.tsx'
import {
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'

/**
 * `index-hero-root`: id of {@link IndexHeroApp}'s hydration container —
 * a plain wrapper `<div>` `index-page.tsx`'s `IndexPage` renders directly,
 * not part of {@link IndexHeroApp}'s own render output. See `dashboard-
 * app.tsx`'s `DASHBOARD_ROOT_ID` doc comment for why this has to be a
 * separate element from the app's own root.
 */
export const INDEX_HERO_ROOT_ID = 'index-hero-root'

/**
 * `index-hero-props`: the `<script type="application/json">` element
 * `demo/index-client.tsx` reads {@link IndexHeroAppProps} out of — the same
 * pattern `diagram-type-app.tsx`'s `DIAGRAM_TYPE_PROPS_ELEMENT_ID` uses.
 */
export const INDEX_HERO_PROPS_ELEMENT_ID = 'index-hero-props'

export interface IndexHeroAppProps {
  /** Real `renderMermaidASCII(HERO_MERMAID_SOURCE, ...)` output, pre-rendered to HTML — see `hero-output-panel.tsx`'s header comment for why this can't be computed in this client-hydrated file. */
  asciiHtml: string
}

/**
 * `index-main-root`: id of {@link IndexMainApp}'s hydration container —
 * see {@link INDEX_HERO_ROOT_ID}'s doc comment for the same reasoning.
 */
export const INDEX_MAIN_ROOT_ID = 'index-main-root'

/** Headline, subhead, the animated terminal→diagram visual, and the CTAs. */
export function IndexHeroApp({ asciiHtml }: IndexHeroAppProps) {
  return (
    <div
      className="hero-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: `${SPACE['7xl']}px`,
        padding: `${SECTION_SPACE.loose}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px`,
        maxWidth: `${LAYOUT.maxWidth}px`,
        margin: '0 auto',
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
          <HeroInstall />
          <CTA href="editor.html" accent="violet">
            View the live demo
          </CTA>
        </div>
      </div>

      <div
        className="hero-visual"
        style={{
          flex: '0 1 700px',
          minWidth: 0,
          maxWidth: '100%',
          display: 'flex',
          gap: `${SPACE['3xl']}px`,
          alignItems: 'flex-start',
        }}
      >
        <HeroCodePanel />
        <HeroOutputPanel asciiHtml={asciiHtml} />
      </div>
    </div>
  )
}

/**
 * Everything inside {@link INDEX_MAIN_ROOT_ID}'s hydration boundary: why
 * this fork exists, the feature pillars, the CLI/MCP section, diagram
 * gallery teaser, proof section, and blog teaser — the same components
 * `index-page.tsx`'s `IndexPage` used to render directly in `<main>`, in
 * the same order (the feature grid became two sections,
 * {@link WhyForkExistsSection} and {@link FeaturePillars}, rather than one
 * flat six-card grid — see their doc comments for why). The exact same
 * function runs on both sides of hydration — see `dashboard-app.tsx`'s
 * {@link DashboardApp} doc comment for the general shape this follows. No
 * props: see this file's header comment for why.
 */
export function IndexMainApp() {
  return (
    <>
      <WhyForkExistsSection />
      <FeaturePillars />
      <CliMcpSection />
      <DiagramGalleryTeaser />
      <ProofSection />
      <BlogTeaser />
    </>
  )
}
