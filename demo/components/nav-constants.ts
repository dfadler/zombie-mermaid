/**
 * A handful of measurement/id constants both nav.tsx's own rendering and
 * nav-css.ts's {@link navCss} need — pulled into their own leaf module
 * (zombie-mermaid#933) rather than defined in either of those files and
 * imported by the other.
 *
 * That avoids exactly the circular-import hazard shared-page-css.tsx's own
 * doc comment already documents for tokens.tsx vs. primitives.tsx/nav.tsx/
 * footer.tsx: nav.tsx needs `navCss()` (from nav-css.ts) inside its
 * `NavStyle()` component, and `navCss()` needs these same values — a leaf
 * module with no dependency on either keeps that a one-way graph instead of
 * a cycle that (per that same comment) breaks at runtime with a
 * `ReferenceError` from a `const` accessed before its owning module
 * finishes initializing.
 */
import { LAYOUT, SPACE } from './tokens.tsx'

/**
 * The bar's vertical padding at each breakpoint band, in px.
 *
 * 22 is off tokens.tsx's spacing scale and nothing else in the artboards
 * uses it, so it stays a literal here; the two narrower values are
 * `SPACE.xl` and `SPACE.lg`.
 */
export const NAV_PAD_Y = {
  desktop: 22,
  tablet: SPACE.xl,
  mobile: SPACE.lg,
} as const

/**
 * The bar's horizontal padding at each breakpoint band, in px.
 *
 * Desktop and mobile match the page gutter; the tablet band does not — the
 * canvas tightens the bar to 24px where the page body still sits at 32.
 */
export const NAV_PAD_X = {
  desktop: LAYOUT.gutter.desktop,
  tablet: SPACE['3xl'],
  mobile: LAYOUT.gutter.mobile,
} as const

/**
 * `z-index` on the bar, so the hero's artwork passes beneath it — also the
 * base {@link navCss}'s mobile-panel z-index and nav-install-popover.tsx's
 * popover z-index are each pinned one layer above/below.
 */
export const NAV_Z_INDEX = 10

/** The oversized watermark brand mark's rendered size, in px — used both by
 * `MobileNavPanel`'s `<LogoMark>` (nav.tsx) and {@link navCss}'s
 * `.mobile-watermark` offset math (nav-css.ts). */
export const MOBILE_WATERMARK_SIZE = 220

/**
 * `nav-root`: id of the *hydration container* every page's Nav-hydration
 * client script (`demo/nav-client.tsx`'s `hydrateNav()`) mounts onto — see
 * `demo/components/nav-island.tsx`'s `NavIsland`, which every page-level
 * generator now renders in place of a bare `<Nav .../>`.
 *
 * A separate wrapper element from `Nav`'s own rendered root, for the same
 * reason `dashboard-app.tsx`'s `DASHBOARD_ROOT_ID` is (see that constant's
 * doc comment): `Nav` itself returns a fragment — the bar, then a mobile
 * panel as its sibling — and `hydrateRoot(container, node)` requires a
 * single container whose *children* match what `node` renders, not a
 * container that is itself part of that render output.
 */
export const NAV_ROOT_ID = 'nav-root'
