/**
 * Client-side behavior for the homepage's live theme showcase (#759,
 * index.ts → index.html): makes `demo/components/index-page.tsx`'s
 * `ThemeShowcase` section genuinely interactive, and relocates its picker
 * into the sticky nav once that section scrolls out of view.
 *
 * Three concerns, each mirroring an existing pattern elsewhere on the site
 * rather than inventing a new one:
 *
 * 1. **Pill wiring + persistence** — `initThemeBar()`
 *    (`demo/components/theme-bar-client.ts`), the same call every other
 *    page's `demo/theme-bar-only-client.ts` makes.
 * 2. **Re-theming** — every `demo/theme-state.ts` change (this page's own
 *    pill click, or one made on another page/tab) re-themes the showcase's
 *    live `<svg>` (`applyThemeToShowcaseDiagram`, the same "swap CSS custom
 *    properties in place, no re-render" technique
 *    `demo/diagram-page-client.ts`'s `applyThemeToDiagram` uses for the
 *    per-diagram-type SEO pages) and the surrounding site chrome
 *    (`demo/chrome-theme-client.ts`'s `initChromeTheme()`, #772/#783).
 *    `initChromeTheme(THEMES)` passes `@zombie-mermaid/core`'s own THEMES
 *    table directly rather than reading a `window.__themeColors` embed the
 *    way `demo/theme-bar-only-client.ts` does — this page already imports
 *    THEMES for {@link applyThemeToShowcaseDiagram} below, and
 *    `ChromeThemeColors` only needs `bg`/`fg`, which every `DiagramColors`
 *    entry already has (structurally compatible, extra fields ignored —
 *    see `chrome-theme-client.ts`'s own doc comment), so there is no
 *    Default-page-generator embed to duplicate here.
 * 3. **One-way picker relocation** — an `IntersectionObserver` on
 *    `#theme-showcase` reparents the *same* `#theme-pills` DOM node
 *    (`element.appendChild`, not a clone — one live instance, no duplicate
 *    ids or doubled listeners) into the sticky nav's `#nav-theme-slot`
 *    (`demo/components/nav.tsx`'s `installSlot`) once the section scrolls
 *    above the viewport, then disconnects — per #759's locked-in decision,
 *    this never reverses on scrolling back up. A no-JS visitor simply never
 *    sees this relocation; the picker stays in its original, still-usable
 *    position in that case.
 */
import { getTheme, subscribe } from './theme-state.ts'
import { initThemeBar } from './components/theme-bar-client.ts'
import { initChromeTheme } from './chrome-theme-client.ts'
import { THEMES } from '@zombie-mermaid/core'

/**
 * Must match `demo/components/index-page.tsx`'s own
 * `THEME_SHOWCASE_DEFAULT_THEME` — duplicated rather than imported (that
 * module is a `.tsx` React component file with no reason to end up in this
 * bundle) so a themeKey with no real THEMES entry (the `''` Default
 * pseudo-theme, or a corrupted stored value) has something concrete to
 * fall back to instead of leaving the diagram's colors stale or unset.
 */
const SHOWCASE_DEFAULT_THEME = 'dracula'

const ENRICHMENT_KEYS = ['line', 'accent', 'muted', 'surface', 'border'] as const

/**
 * Restyles the showcase's rendered `<svg>` in place — no re-render, exactly
 * `demo/diagram-page-client.ts`'s `applyThemeToDiagram` minus the
 * orientation-variant handling this single-diagram section doesn't need.
 * Falls back to {@link SHOWCASE_DEFAULT_THEME}'s colors for `''`/an
 * unrecognized key rather than leaving `--bg`/`--fg` unset, which would
 * otherwise break the diagram's own `<style>` block (its derived variables
 * have no fallback for a wholly-missing `--bg`).
 */
function applyThemeToShowcaseDiagram(themeKey: string): void {
  const theme = THEMES[themeKey] ?? THEMES[SHOWCASE_DEFAULT_THEME]
  if (!theme) return

  const svg = document.querySelector('.theme-showcase-diagram svg')
  if (!(svg instanceof SVGSVGElement)) return

  svg.style.setProperty('--bg', theme.bg)
  svg.style.setProperty('--fg', theme.fg)
  for (const prop of ENRICHMENT_KEYS) {
    const value = theme[prop]
    if (value) svg.style.setProperty('--' + prop, value)
    else svg.style.removeProperty('--' + prop)
  }
}

// -- Pill selection, "More" dropdown, ARIA/keyboard support, and
//    persistence: demo/components/theme-bar-client.ts's job (see this
//    file's header comment) -- wires the #theme-pills markup ThemeShowcase
//    already renders to demo/theme-state.ts.
initThemeBar()

// Site chrome (Nav/Footer/cards): demo/chrome-theme-client.ts's job.
// initChromeTheme() applies whatever theme is already stored immediately
// (a returning visitor's choice) and keeps re-applying on every future
// theme-state change on its own -- no separate initial-apply/subscribe
// call needed here for the chrome half.
initChromeTheme(THEMES)

// This page's own diagram re-theming runs on every theme-state change,
// same-tab or cross-tab, whether it came from this page's own picker or one
// picked on another page entirely (see subscribe()'s doc comment in
// theme-state.ts).
subscribe(applyThemeToShowcaseDiagram)

// -- Restore a previously picked theme for the diagram, if it differs from
//    this page's build-time default (SHOWCASE_DEFAULT_THEME). An empty
//    string (getTheme()'s "no preference stored" value) needs no restore
//    call: the showcase's own build-time render already matches
//    SHOWCASE_DEFAULT_THEME.
const initial = getTheme()
if (initial && THEMES[initial]) applyThemeToShowcaseDiagram(initial)

/**
 * Reparents `#theme-pills` into `#nav-theme-slot` the first time
 * `#theme-showcase` scrolls above the viewport (a non-intersecting entry
 * whose `boundingClientRect.top < 0` — scrolled past, not merely not-yet-
 * reached below), then disconnects. Silently does nothing if any of the
 * three elements is missing, which no page this script ships on should
 * ever hit, but keeps this script safe to run unconditionally.
 */
function relocateThemePickerOnScroll(): void {
  const showcase = document.getElementById('theme-showcase')
  const pills = document.getElementById('theme-pills')
  const slot = document.getElementById('nav-theme-slot')
  if (!showcase || !pills || !slot) return

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) continue
        if (entry.boundingClientRect.top >= 0) continue
        slot.appendChild(pills)
        observer.disconnect()
        return
      }
    },
    { threshold: 0 },
  )
  observer.observe(showcase)
}
relocateThemePickerOnScroll()
