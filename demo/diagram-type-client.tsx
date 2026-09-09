/** @jsxRuntime automatic */
/**
 * Hydration entry point for every diagrams/<slug>.html page (pages.ts) —
 * zombie-mermaid#805, replacing `demo/diagram-page-client.ts`. Bundled
 * once via `scripts/vite-bundle.ts`'s `bundleForBrowser` (`pages.ts`'s
 * `bundleDiagramTypeClient()`) and loaded as an external `<script
 * type="module" src>` — see `diagram-page.tsx`'s
 * `DiagramTypePageProps.clientScriptSrc` doc comment for why external
 * rather than inlined (this is the most bundle-size-sensitive page in the
 * #797 epic).
 *
 * Two concerns live here, deliberately kept separate:
 *
 * 1. **Hydration** (new in #805): `hydrateRoot()`s {@link DiagramTypeApp}
 *    against {@link DIAGRAM_TYPE_ROOT_ID}, reading its props back from
 *    {@link DIAGRAM_TYPE_PROPS_ELEMENT_ID} — the same pattern
 *    `dashboard-client.tsx` established. Also hydrates `<NavIsland>` (via
 *    {@link hydrateNav}) and the theme picker (via `hydrateThemeBar()`) in
 *    this same bundle, replacing the separate `nav-only-client.tsx` bundle
 *    this page used before.
 * 2. **Re-theming** (unchanged from `demo/diagram-page-client.ts` — moved
 *    here verbatim, not rewritten): swapping the rendered `<svg>`'s CSS
 *    custom properties, the page chrome's `--t-*` variables, and the "Open
 *    in the live editor" link's encoded theme, whenever the theme changes.
 *    Deliberately still plain, imperative DOM mutation rather than React
 *    state — see `diagram-page.tsx`'s own header comment for why
 *    converting this to state-driven re-rendering would regress the
 *    "no re-render" performance property `renderMermaidSVG`'s CSS-
 *    variable-parameterized output exists to provide. Theme color data
 *    stays inline JSON (`window.__diagramPageThemes`, written by
 *    `pages.ts`) rather than importing `packages/core/src/theme.ts` here,
 *    for the same bundle-size reason the original file gave.
 */
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { hydrateRoot } from 'react-dom/client'
import {
  DiagramTypeApp,
  DIAGRAM_TYPE_PROPS_ELEMENT_ID,
  DIAGRAM_TYPE_ROOT_ID,
  type DiagramTypeAppProps,
} from './components/diagram-type-app.tsx'
import { hydrateNav } from './nav-client.tsx'
import { getTheme, setTheme, subscribe } from './theme-state.ts'
import { hydrateThemeBar } from './theme-bar-client.tsx'
import { initChromeTheme } from './chrome-theme-client.ts'

interface DiagramColors {
  bg: string
  fg: string
  line?: string
  accent?: string
  muted?: string
  surface?: string
  border?: string
}

declare global {
  interface Window {
    __diagramPageThemes: Record<string, DiagramColors>
    __diagramPageSource: string
    __diagramPageNarrowSource: string | null
  }
}

const THEMES = window.__diagramPageThemes

/**
 * Mirrors demo/styles.css's `@media (max-width: 640px)` breakpoint, the
 * same one pages.ts's `.orientation-variant` markup (see
 * demo/diagram-orientation.ts) is already picked between by pure CSS. Pure
 * CSS handles which `<svg>`/source panel is *shown* — this is only needed
 * for the one piece of the page CSS can't reach: the "Open in the live
 * editor" link's href, which must encode whichever orientation is
 * currently visible.
 */
const narrowViewportQuery = window.matchMedia('(max-width: 640px)')

/**
 * The Mermaid source matching whatever orientation is currently displayed:
 * the narrow (TD) alternate on a narrow viewport if this page has one,
 * else the page's normal (possibly wide) source.
 */
function sourceForViewport(): string {
  return narrowViewportQuery.matches && window.__diagramPageNarrowSource
    ? window.__diagramPageNarrowSource
    : window.__diagramPageSource
}

/**
 * Same encoding editor/js/sharing.js's `getHashSource` reads: `#` +
 * base64(JSON.stringify({source, theme})). Mirrors pages.ts's own
 * server-side `editorHash` (Buffer-based there, browser APIs here) so the
 * "Open in the live editor" link can track a client-side theme change.
 */
function editorHash(source: string, theme: string): string {
  const payload = JSON.stringify({ source, theme })
  return btoa(unescape(encodeURIComponent(payload)))
}
const ENRICHMENT_KEYS = [
  'line',
  'accent',
  'muted',
  'surface',
  'border',
] as const satisfies ReadonlyArray<keyof DiagramColors>

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let value = hex.trim()
  if (value[0] === '#') value = value.slice(1)
  if (value.length === 3) value = value.replace(/(.)/g, '$1$1')
  // parseInt(value, 16) alone would accept a malformed value like '12zz34'
  // by silently parsing just its valid '12' prefix -- require every
  // character to be a hex digit first so a bad theme color falls back to
  // the caller's default instead of producing a wrong one.
  if (!/^[0-9a-f]{6}$/i.test(value)) return null
  const intValue = parseInt(value, 16)
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  }
}

/**
 * Restyle the page chrome itself (background, text, borders, CTA gradient,
 * pill shadows) to match the selected theme, not just the diagram SVG.
 * Mirrors demo/client.ts's applyTheme steps 1 + setShadowVars: this page's
 * CSS (demo/diagram-page.css) already derives everything from --t-bg/--t-fg/
 * --t-accent plus the shadow-* variables, so setting them on <body> is
 * enough to repaint the whole page — no per-element JS needed.
 */
function applyThemeToPage(theme: DiagramColors): void {
  const body = document.body
  const accent = theme.accent || '#3b82f6'
  body.style.setProperty('--t-bg', theme.bg)
  body.style.setProperty('--t-fg', theme.fg)
  body.style.setProperty('--t-accent', accent)

  const fgRgb = hexToRgb(theme.fg) || { r: 39, g: 39, b: 42 }
  const bgRgb = hexToRgb(theme.bg) || { r: 255, g: 255, b: 255 }
  const brightness = (bgRgb.r * 299 + bgRgb.g * 587 + bgRgb.b * 114) / 1000
  const darkMode = brightness < 140

  body.style.setProperty(
    '--foreground-rgb',
    `${fgRgb.r}, ${fgRgb.g}, ${fgRgb.b}`,
  )
  body.style.setProperty('--shadow-border-opacity', darkMode ? '0.15' : '0.08')
  body.style.setProperty('--shadow-blur-opacity', darkMode ? '0.12' : '0.06')
}

// A page with an orientation alternate (see demo/diagram-orientation.ts)
// renders two `<svg>`s, one per `.orientation-variant` — only one is ever
// shown, but both need theming kept in sync so switching themes doesn't
// leave the hidden one stale for whenever a viewport resize reveals it.
// `.gallery-thumb svg` (the "More examples" section's thumbnails, #714/#715)
// is included here too: pages.ts renders those with the same
// renderMermaidSVG/--bg/--fg-driven markup as the primary diagram, just at
// the page's build-time default theme, so without this they'd stay stuck on
// that default forever regardless of what a visitor picks.
function applyThemeToDiagram(themeKey: string): void {
  const theme = THEMES[themeKey]
  if (!theme) return

  document
    .querySelectorAll('.diagram-frame svg, .gallery-thumb svg')
    .forEach((svg) => {
      if (!(svg instanceof SVGSVGElement)) return
      svg.style.setProperty('--bg', theme.bg)
      svg.style.setProperty('--fg', theme.fg)
      for (const prop of ENRICHMENT_KEYS) {
        const value = theme[prop]
        if (value) svg.style.setProperty('--' + prop, value)
        else svg.style.removeProperty('--' + prop)
      }
    })
}

function updateEditorLink(themeKey: string): void {
  const editorLink = document.querySelector('.cta-btn.primary')
  if (!(editorLink instanceof HTMLAnchorElement)) return
  // Read/write the attribute, not the `.href` property -- the property
  // getter always returns a resolved absolute URL, which would silently
  // turn the original relative `../editor` markup into an absolute one.
  const base = (editorLink.getAttribute('href') ?? '').replace(/#.*$/, '')
  const hash = editorHash(sourceForViewport(), themeKey)
  editorLink.setAttribute('href', `${base}#${hash}`)
}

/**
 * As of #801, `getTheme()` directly rather than reading `.theme-pill.active`
 * from the DOM: `ThemePicker` is now a hydrated React component whose
 * `active` class only reflects `getTheme()` once its post-hydration
 * `useEffect` has actually run (an unavoidable one-tick-later property of
 * hydration itself, not something this file can wait on synchronously) --
 * so a DOM read here, executed synchronously right after `hydrateThemeBar()`
 * below, could observe the stale server-rendered default instead of a
 * returning visitor's real stored theme. `getTheme()` is exactly the value
 * that effect converges to anyway, with no such timing dependency, and
 * (like the old DOM read) never actually returns null/undefined -- so
 * unlike the old code's defensive `?? Object.keys(THEMES)[0]!` (guarding a
 * "no .active pill found" case a DOM read could theoretically hit but a
 * direct `getTheme()` call cannot), no fallback is needed here. '' (Default)
 * is returned as-is, exactly as before.
 */
function activeThemeKey(): string {
  return getTheme()
}

/**
 * Re-themes this page's own concerns for `themeKey` -- the rendered
 * `<svg>`(s), the page chrome's `--t-*`/shadow variables, and the "Open in
 * the live editor" link. Pill active-state and persistence are `demo/
 * theme-bar-client.tsx`'s `hydrateThemeBar()`/`demo/theme-state.ts`'s job
 * -- this function is registered as a `subscribe()` listener below, so it
 * still runs on every pill click (via `hydrateThemeBar()`'s own
 * `setTheme()` call) without duplicating that click handling here.
 */
function applyTheme(themeKey: string): void {
  const theme = THEMES[themeKey]
  if (!theme) return

  applyThemeToPage(theme)
  applyThemeToDiagram(themeKey)
  updateEditorLink(themeKey)
}

// The editor link's encoded source must track the orientation actually on
// screen, not just the theme — a visitor can land directly on a narrow
// viewport, resize into/out of one, or rotate a phone, none of which
// change the theme. `.matches` is already correct in all of those; only
// the 'change' event is what's not guaranteed to fire in every
// environment (see the resize fallback below).
function applyViewportOrientation(): void {
  updateEditorLink(activeThemeKey())
}
narrowViewportQuery.addEventListener('change', applyViewportOrientation)

// Fallback for environments where a viewport change doesn't reliably fire
// MediaQueryList's own 'change' event even though `.matches` itself is
// correct (observed with devtools/CDP-driven viewport emulation — some
// don't dispatch it the way an actual window resize does). Gated on an
// actual matches flip, not every resize tick, so this stays cheap. Mirrors
// demo/client.ts's identical fallback for the main gallery.
let lastNarrowMatch = narrowViewportQuery.matches
window.addEventListener('resize', () => {
  if (narrowViewportQuery.matches === lastNarrowMatch) return
  lastNarrowMatch = narrowViewportQuery.matches
  applyViewportOrientation()
})

function readDiagramTypeAppProps(): DiagramTypeAppProps {
  const propsEl = document.getElementById(DIAGRAM_TYPE_PROPS_ELEMENT_ID)
  if (!propsEl?.textContent) {
    throw new Error(
      `diagram-type-client: no #${DIAGRAM_TYPE_PROPS_ELEMENT_ID} element with JSON content found`,
    )
  }
  return JSON.parse(propsEl.textContent) as DiagramTypeAppProps
}

function hydrateDiagramTypeApp(): void {
  const container = document.getElementById(DIAGRAM_TYPE_ROOT_ID)
  if (!container) {
    throw new Error(
      `diagram-type-client: no #${DIAGRAM_TYPE_ROOT_ID} element found to hydrate`,
    )
  }
  hydrateRoot(
    container,
    createElement(DiagramTypeApp, readDiagramTypeAppProps()),
  )
}

// -- Hydration (#805): DiagramTypeApp's own content, Nav, and the theme
//    picker. `#theme-pills` is `ThemePickerIsland`, embedded in the "Pick a
//    look" section -- one call hydrates it against `demo/theme-state.ts`.
//
// Wrapped in flushSync(): react-dom/client's hydrateRoot() schedules its
// own hydration-match verification asynchronously rather than fully
// synchronously (confirmed via this exact page: without this, code
// further down that synchronously mutates the same DOM nodes -- the svg,
// <body>, the editor-link <a> -- raced ahead of that deferred check and
// produced a spurious "attributes didn't match" console warning in
// testing, even though the server-rendered markup and the hydrated props
// were identical; the warning was entirely an artifact of this file's own
// later mutation, not a real mismatch). flushSync() forces React to
// finish hydrating before returning, so every mutation below always runs
// after hydration has actually settled.
flushSync(() => {
  hydrateDiagramTypeApp()
  hydrateNav()
})
hydrateThemeBar()
initChromeTheme(THEMES)

// This page's own re-theming (svg + chrome + editor link) runs on every
// theme-state change, same-tab or cross-tab, whether it came from a click
// this page's own hydrated ThemePicker handled or a theme picked on another
// page entirely (see subscribe()'s doc comment in theme-state.ts).
subscribe(applyTheme)

// -- One-time migration: a visitor who picked a theme on a diagrams page
//    before this file switched keys (see #438) has it stored under the
//    old, diagrams-page-only 'zm-diagram-page-theme' key, which theme-
//    state.ts (the shared 'mermaid-theme' key) has never read. Migrate it
//    by calling setTheme() -- that both persists it under the shared key
//    and notifies the subscribe() listener above, so applyTheme() runs
//    exactly as it would for a live pill click -- then discard the stale
//    key either way. Safe to run synchronously here, after the
//    flushSync()-wrapped hydration above: hydrateDiagramTypeApp()/
//    hydrateNav() have already fully settled by this point (see that
//    block's own comment), so the DOM mutations setTheme()/applyTheme()
//    below trigger can't race React's own hydration verification.
const LEGACY_THEME_KEY = 'zm-diagram-page-theme'
if (getTheme() === '') {
  const legacy = localStorage.getItem(LEGACY_THEME_KEY)
  if (legacy && THEMES[legacy]) setTheme(legacy)
}
localStorage.removeItem(LEGACY_THEME_KEY)

// -- Restore a previously picked theme, if it differs from this page's
//    build-time default. An empty string (getTheme()'s "no preference
//    stored" / explicit-Default value) already matches this page's
//    build-time default, so there's nothing to apply in that case.
const initial = getTheme()
if (initial && THEMES[initial]) applyTheme(initial)

// Reconcile the editor-link href with the current viewport right away — a
// visitor can land directly on a narrow viewport, not just resize into
// one, and the build-time href above always encodes the wide source.
// Mirrors demo/client.ts's identical reconciliation for the main
// gallery's source panels. Harmless if applyTheme already ran: this just
// recomputes from the (unchanged) active theme and current viewport.
applyViewportOrientation()
