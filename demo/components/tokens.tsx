/** @jsxRuntime automatic */
/**
 * Design tokens for the site redesign (#590) — the single source of truth
 * for the UI component library #591 is building.
 *
 * Every value here was lifted verbatim from the design canvas linked in
 * #590's body (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`),
 * whose sixteen "Diagram-Native Showcase" artboards — eight pages, each in a
 * 1440px desktop and a 390px mobile variant — carry an identical
 * `<helmet><style>` preamble. The colour block below is a character-for-character
 * copy of that preamble's `:root`; the type, spacing, radius, and layout scales
 * are the distinct values those artboards actually use, named here so a
 * component can reference `RADIUS.card` instead of re-typing `20px`.
 *
 * Nothing on the site consumes these yet. This module exists so the shared
 * Nav (#593), Footer (#594), primitives (#595), and icons (#596, #597) all
 * pull from one place instead of each re-deriving the palette. The current
 * pages keep rendering through demo/styles.css's `--t-*` theming and the
 * Geist + JetBrains Mono pair in site-head.tsx's `GOOGLE_FONTS_HREF`; the
 * two systems are deliberately disjoint (no token name overlaps) so the
 * redesign can land page by page rather than in one cutover.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */

/* -----------------------------------------------------------------
 * Colour
 * ----------------------------------------------------------------- */

/**
 * The palette, keyed by the CSS custom property each value is published as.
 *
 * Surfaces run darkest to lightest (`--bg` → `--bg-soft` → `--panel` →
 * `--panel-2`), ink runs brightest to faintest (`--text` → `--text-dim` →
 * `--text-faint`), and the six accents are the hues the diagram-type icons,
 * theme swatches, and section eyebrows key off.
 */
export const COLORS = {
  /** Page background — the darkest surface. */
  '--bg': '#0a0d16',
  /** A lifted page background, used for alternating full-bleed sections. */
  '--bg-soft': '#10152a',
  /** Default card/panel fill. */
  '--panel': '#141a2e',
  /** A panel nested inside another panel, or a hovered panel. */
  '--panel-2': '#181f38',
  /** Hairline between surfaces; the canvas always uses it at 1px. */
  '--border': '#2a3252',
  /** Primary body and heading ink. */
  '--text': '#eef1fb',
  /** Secondary ink: sub-heads, descriptions, nav links at rest. */
  '--text-dim': '#9aa3c4',
  /** Tertiary ink: captions, timestamps, disabled states. */
  '--text-faint': '#6b7398',
  /** Accent — flowchart. */
  '--blue': '#4d8dff',
  /** Accent — state. */
  '--violet': '#a374e8',
  /** Accent — the link colour, and section eyebrows. */
  '--cyan': '#38e0d0',
  /** Accent — the link hover colour. */
  '--pink': '#ff5fa8',
  /** Accent — warnings, XY chart. */
  '--amber': '#ffb84d',
  /** Accent — success, ER. */
  '--green': '#3ee08a',
} as const

/** A CSS custom-property name from {@link COLORS}, e.g. `'--panel-2'`. */
export type ColorToken = keyof typeof COLORS

/** `var(--panel-2)` for a token name — the way components reference a colour. */
export function colorVar(token: ColorToken): string {
  return `var(${token})`
}

/**
 * The six named accents, in the order the canvas cycles them across
 * diagram-type cards and theme swatches.
 */
export const ACCENTS = [
  '--blue',
  '--violet',
  '--cyan',
  '--pink',
  '--amber',
  '--green',
] as const satisfies readonly ColorToken[]

/* -----------------------------------------------------------------
 * Type
 * ----------------------------------------------------------------- */

/**
 * The Google Fonts stylesheet for the redesign's pair: Space Grotesk for
 * display/headings, Plus Jakarta Sans for body — both at 400/500/600/700,
 * the weights the artboards use.
 *
 * The canvas pulls this in with `@import url(…)` inside its style block.
 * The site loads fonts with `<link>` instead (see site-chrome.tsx's
 * `FontLinks`), which avoids the render-blocking sequential fetch an
 * `@import` inside an inline `<style>` costs, so `DesignFontLinks` below
 * emits the same stylesheet the `<link>` way.
 */
export const DESIGN_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'

/** The three font stacks, each with the canvas's own fallbacks. */
export const FONTS = {
  /** Headings and anything marked `.display`. */
  display: "'Space Grotesk', 'Plus Jakarta Sans', sans-serif",
  /** Body copy — the default for the whole page. */
  body: "'Plus Jakarta Sans', -apple-system, sans-serif",
  /** Code, CLI transcripts, and diagram source. */
  mono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
} as const

/**
 * Font sizes in px. The four body steps are what the artboards spend almost
 * all their type on; the heading steps are the distinct display sizes.
 */
export const FONT_SIZE = {
  /** 11px — the smallest label in the canvas (badge counts). */
  micro: 11,
  /** 12px — captions and timestamps. */
  caption: 12,
  /** 13px — nav links, and `.section-eyebrow`. */
  label: 13,
  /** 14px — dense body copy (table cells, list rows). */
  bodySm: 14,
  /** 14.5px — the canvas's default body size, by a wide margin. */
  body: 14.5,
  /** 15px — body copy inside pills and buttons. */
  bodyLg: 15,
  /** 17px — lead paragraphs under a heading. */
  lead: 17,
  /** 20px — card titles. */
  subhead: 20,
  /** 26px — section sub-headings. */
  h3: 26,
  /** 32px — section headings. */
  h2: 32,
  /** 38px — page headings. */
  h1: 38,
  /** 34px — the hero h1 below {@link BREAKPOINTS}.mobile. */
  h1Mobile: 34,
  /** 52px — the home hero. */
  display: 52,
} as const

/** The four weights both families are loaded at. */
export const FONT_WEIGHT = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

/** Line heights, unitless. */
export const LINE_HEIGHT = {
  /** 1.08 — display type, where the default leading is far too loose. */
  display: 1.08,
  /** 1.5 — the default for body copy. */
  body: 1.5,
  /** 1.9 — long-form prose (blog posts). */
  prose: 1.9,
} as const

/** Letter spacing, in em. */
export const LETTER_SPACING = {
  /** -0.02em — display type. */
  display: '-0.02em',
  /** -0.01em — headings. */
  heading: '-0.01em',
  /** 0.14em — `.section-eyebrow`, which is uppercase. */
  eyebrow: '0.14em',
} as const

/* -----------------------------------------------------------------
 * Space, radius, layout
 * ----------------------------------------------------------------- */

/**
 * The spacing scale in px, covering every gap and inner padding the
 * artboards use. Component-level rhythm; page sections use
 * {@link SECTION_SPACE} instead.
 */
export const SPACE = {
  /** 6px */
  xxs: 6,
  /** 8px */
  xs: 8,
  /** 10px — the gap between a pill's icon and its label. */
  sm: 10,
  /** 12px — the most common gap in the canvas. */
  md: 12,
  /** 14px */
  lg: 14,
  /** 16px */
  xl: 16,
  /** 20px */
  '2xl': 20,
  /** 24px */
  '3xl': 24,
  /** 28px — a card's interior padding. */
  '4xl': 28,
  /** 32px */
  '5xl': 32,
  /** 40px */
  '6xl': 40,
  /** 48px */
  '7xl': 48,
  /** 64px — the gap between two page sections. */
  '8xl': 64,
} as const

/**
 * Vertical padding for a full-bleed page section, in px. The canvas varies
 * these per section for rhythm, so these are the anchors rather than an
 * exhaustive list.
 */
export const SECTION_SPACE = {
  /** 48px — a tight section, or the bottom half of one. */
  tight: 48,
  /** 64px */
  snug: 64,
  /** 96px — the default section's top and bottom padding. */
  default: 96,
  /** 120px — the hero's top padding. */
  loose: 120,
  /** 140px — the hero's bottom padding, where the next section overlaps. */
  hero: 140,
} as const

/** Corner radii in px. Use {@link RADIUS_CIRCLE} for a true circle. */
export const RADIUS = {
  /** 8px */
  sm: 8,
  /** 10px */
  md: 10,
  /** 12px */
  lg: 12,
  /** 16px */
  xl: 16,
  /** 20px — `.card`. */
  card: 20,
  /** 24px — an oversized feature card. */
  '2xl': 24,
  /** 999px — `.pill`, and anything else fully rounded. */
  pill: 999,
} as const

/** `border-radius` for a circle — a percentage, so not part of {@link RADIUS}. */
export const RADIUS_CIRCLE = '50%'

/** Page-level measurements in px. */
export const LAYOUT = {
  /** 1280px — the content column every page centres. */
  maxWidth: 1280,
  /** 680px — long-form prose, so a line stays readable. */
  proseMaxWidth: 680,
  /** Horizontal page gutter, one per breakpoint band. */
  gutter: {
    /** 80px — above {@link BREAKPOINTS}.tablet. */
    desktop: 80,
    /** 32px — at or below {@link BREAKPOINTS}.tablet. */
    tablet: 32,
    /** 20px — at or below {@link BREAKPOINTS}.mobile. */
    mobile: 20,
  },
} as const

/* -----------------------------------------------------------------
 * Breakpoints
 * ----------------------------------------------------------------- */

/**
 * The two widths the canvas breaks at, in px. Both artboard variants are
 * max-width (desktop-first): a rule applies at the breakpoint and below.
 */
export const BREAKPOINTS = {
  /** 900px — nav links collapse, multi-column grids halve. */
  tablet: 900,
  /** 600px — grids drop to one or two columns, the hero h1 shrinks. */
  mobile: 600,
} as const

/** Ready-made `@media` prelude strings, so a component never retypes a width. */
export const MEDIA = {
  /** `@media (max-width: 900px)` */
  tablet: `@media (max-width: ${BREAKPOINTS.tablet}px)`,
  /** `@media (max-width: 600px)` */
  mobile: `@media (max-width: ${BREAKPOINTS.mobile}px)`,
  /**
   * `@media (prefers-reduced-motion: reduce)` — every artboard ships one,
   * because the redesign leans on animated diagram icons and marching-ants
   * edges that must be suppressible.
   */
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
} as const

/* -----------------------------------------------------------------
 * CSS emission
 * ----------------------------------------------------------------- */

/**
 * The `:root` block publishing {@link COLORS} and {@link FONTS} as CSS
 * custom properties.
 *
 * The site's generators are static: there is no CSS-in-JS runtime, so a
 * component that needs styling emits a CSS string into a `<style>` element
 * (site-head.tsx's `css` prop is the established shape). This is that
 * string for the tokens.
 *
 * The colour half matches the design canvas's own `:root` exactly. The
 * `--font-*` half is this module's addition — the canvas repeats each stack
 * inline on `.dc-root` and `h1, h2, h3`; naming them changes no value.
 */
export function designTokensCss(): string {
  const colors = Object.entries(COLORS)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')
  return `:root {
${colors}
  --font-display: ${FONTS.display};
  --font-body: ${FONTS.body};
  --font-mono: ${FONTS.mono};
}`
}

/**
 * `designTokensCss()` plus the base element rules the canvas applies on top
 * of it: a zeroed `body` margin (the canvas artboards are edge-to-edge, and
 * every redesigned page's `<Nav>` is meant to sit flush against the
 * viewport's top/left — without this, the browser's default 8px `body`
 * margin nudges the nav bar and everything below it away from the edge),
 * {@link LINE_HEIGHT}'s `body` step (1.5) as the actual inherited
 * `line-height` — previously this constant existed but was never applied as
 * real CSS anywhere, so any text that didn't set its own `line-height`
 * (most of `<Nav>`'s: the links, the install pill's command text) rendered
 * at the browser's default `normal` instead — the body font and ink, the
 * display font on headings, and the cyan/pink link pair.
 *
 * A page wanting only the custom properties (because it inherits its
 * element styling from elsewhere) can emit `designTokensCss()` alone — but
 * then owes the `body` margin/`line-height` resets itself. Before those
 * reset here, index-page.tsx was the one page with neither from any source
 * (every other generator picks up *some* value incidentally, e.g.
 * diagram-page.tsx's linked `assets/diagram-page.css` sets `body {
 * line-height: 1.6 }` for its own old UI, blog-page.tsx's `assets/blog.css`
 * sets its own value, editor-page.tsx's bundled `editor/css/variables.css`
 * resets margin but not line-height, …) — which meant `<Nav>` rendered at a
 * different height depending on which page's incidental value (or lack of
 * one) it happened to inherit, on top of index-page.tsx's own 8px `body`
 * margin offset — both visible as the nav bar jumping on every navigation,
 * not just to/from the home page.
 */
export function designBaseCss(): string {
  return `${designTokensCss()}

body {
  margin: 0;
  font-family: var(--font-body);
  line-height: ${LINE_HEIGHT.body};
  color: var(--text);
  background: var(--bg);
}

h1,
h2,
h3,
.display {
  font-family: var(--font-display);
  font-weight: ${FONT_WEIGHT.bold};
}

a {
  color: var(--cyan);
  text-decoration: none;
}

a:hover {
  color: var(--pink);
}`
}

/**
 * Google Fonts preconnects plus the redesign's stylesheet — one `<link>`
 * set per document, mirroring site-chrome.tsx's `FontLinks`.
 *
 * `crossOrigin=""` renders as the bare `crossorigin` attribute, matching
 * what the rest of the site emits.
 */
export function DesignFontLinks() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={DESIGN_FONTS_HREF} rel="stylesheet" />
    </>
  )
}

/** {@link designBaseCss} in a `<style>` element, for a page's `<head>`. */
export function DesignTokensStyle() {
  return <style>{designBaseCss()}</style>
}
