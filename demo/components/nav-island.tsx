/** @jsxRuntime automatic */
/**
 * `<Nav>`'s hydration island (zombie-mermaid#800): a page-level generator
 * renders {@link NavIsland} in place of a bare `<Nav .../>`, and gets back
 * both the pre-rendered markup React needs a stable container for, and the
 * `<script type="application/json">` `demo/nav-client.tsx`'s `hydrateNav()`
 * reads on the client to re-render the *same* `<Nav>` tree via
 * `hydrateRoot()`.
 *
 * Server-only: this file imports `react-dom/server`, so — exactly like
 * `dashboard-page.tsx` importing it for the same reason (see that file's
 * header comment) — nothing that ends up in a browser bundle may import
 * *this* file. `demo/nav-client.tsx` imports `Nav` and the id constants
 * directly from `nav.tsx` instead, never from here.
 *
 * The `renderToString`-into-`dangerouslySetInnerHTML` splice (not plain
 * JSX nesting) is the same technique `dashboard-page.tsx` uses for
 * `DASHBOARD_ROOT_ID`, for the same reason: every page's outer document
 * still goes through `render-html.ts`'s `renderToStaticMarkup`, which never
 * emits the `<!-- -->` text-boundary comments `hydrateRoot()` needs to
 * match adjacent text-node siblings. `renderToString`, called here just for
 * this island, produces them.
 */
import { renderToString } from 'react-dom/server'
import { escapeJsonForScriptTag } from '../format.ts'
import {
  NAV_PROPS_ELEMENT_ID,
  NAV_ROOT_ID,
  NAV_THEME_SLOT_ID,
  Nav,
  type NavProps,
} from './nav.tsx'

/**
 * The two non-default `installSlot` contents a page can ask for — a `kind`
 * rather than a real `ReactNode` prop, since neither actually varies
 * per-page: `'theme'` is the homepage's old `#nav-theme-slot` placeholder
 * (currently unused by any page's `<NavIsland>` call — see `nav.tsx`'s
 * `NavProps.installSlot` doc comment for its history), and `'empty'` is the
 * homepage hero's own package-manager selector (zombie-mermaid#902): the
 * install pill moved into `index-app.tsx`'s `HeroInstall`, so the header
 * slot renders nothing at all rather than falling back to the default
 * `NavInstall` pill. Encoding this as a `kind` string, not a `ReactNode`,
 * is what lets it round-trip through `JSON.stringify`/`JSON.parse`
 * unchanged — a real element loses the `$$typeof` symbol React needs to
 * recognize it — so `demo/nav-client.tsx` can reconstruct the exact same
 * content on the client with no serialization workaround.
 */
export type NavInstallSlotKind = 'theme' | 'empty'

/** Resolves a {@link NavInstallSlotKind} to the actual `installSlot` node. */
export function resolveInstallSlotKind(
  kind: NavInstallSlotKind | undefined,
): NavProps['installSlot'] {
  if (kind === 'theme') return <div id={NAV_THEME_SLOT_ID} />
  if (kind === 'empty') return <></>
  return undefined
}

/** The JSON-safe subset of {@link NavProps} actually embedded for hydration. */
export interface NavHydrationProps {
  active?: NavProps['active']
  hrefs?: NavProps['hrefs']
  homeHref?: NavProps['homeHref']
  installCommand?: NavProps['installCommand']
  sticky?: NavProps['sticky']
  label?: NavProps['label']
  className?: NavProps['className']
  /** Which non-default `installSlot` the page wants — see {@link NavInstallSlotKind}. Omit for the default `NavInstall` pill. */
  installSlotKind?: NavInstallSlotKind
}

export type NavIslandProps = NavHydrationProps

/**
 * Renders `<Nav>` as a hydratable island: the pre-rendered markup inside
 * {@link NAV_ROOT_ID}, plus the {@link NAV_PROPS_ELEMENT_ID} JSON blob
 * `hydrateNav()` reads to hydrate it. Use this everywhere a page component
 * used to render `<Nav .../>` directly.
 */
export function NavIsland({ installSlotKind, ...navProps }: NavIslandProps) {
  const resolvedInstallSlot = resolveInstallSlotKind(installSlotKind)
  const hydrationPayload: NavHydrationProps = {
    ...navProps,
    installSlotKind,
  }
  return (
    <>
      <div
        id={NAV_ROOT_ID}
        // `display: contents` drops this div's own box from the render
        // tree (it carries no visual styling of its own — no page sets one,
        // see NavHydrationProps's own doc comment) without removing it from
        // the DOM, which `hydrateNav()` still needs as a stable hydration
        // target. Without this, the div's box becomes `<header>`'s sticky
        // *containing block* (CSS resolves a sticky element's containing
        // block the same way as a relatively positioned one: the nearest
        // block-container ancestor, i.e. this div, not a farther one) — and
        // since this div's own height only ever matches `<header>`'s (it
        // wraps nothing else), that containing block has no scrollable
        // room of its own for `<header>` to stay "stuck" within, so
        // `position: sticky` silently behaves like `position: relative`
        // instead. `display: contents` removes this div as a containing
        // block candidate entirely, so `<header>`'s containing block
        // resolves to *its* parent instead (every page's own wrapper,
        // which spans the page's real scrollable height).
        style={{ display: 'contents' }}
        dangerouslySetInnerHTML={{
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this page's own Nav component tree rendered via renderToString (see the module doc comment); never user input
          __html: renderToString(
            <Nav {...navProps} installSlot={resolvedInstallSlot} />,
          ),
        }}
      />
      <script
        type="application/json"
        id={NAV_PROPS_ELEMENT_ID}
        dangerouslySetInnerHTML={{
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from this page's own NavHydrationProps, escaped with escapeJsonForScriptTag; never user input
          __html: escapeJsonForScriptTag(JSON.stringify(hydrationPayload)),
        }}
      />
    </>
  )
}
