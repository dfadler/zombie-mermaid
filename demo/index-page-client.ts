/**
 * Client-side behavior for the homepage's live theme showcase (index.ts →
 * index.html): auto-cycles `demo/components/index-page.tsx`'s
 * `ThemeShowcase` section through all six pre-rendered diagrams and every
 * real theme in `THEMES`, live, with no interactive control on the page —
 * see that component's own doc comment for why this section has no picker.
 *
 * Two concerns:
 *
 * 1. **Site chrome re-theming** — `initChromeTheme(THEMES)`
 *    (`demo/chrome-theme-client.ts`, #772/#783) still applies whatever
 *    theme a returning visitor has stored elsewhere on the site to the
 *    Nav/Footer/cards on this page. This is unrelated to the showcase
 *    below: a visitor's site-wide theme choice (made on some other page's
 *    theme picker) and the showcase's own auto-cycle are two independent
 *    things that happen to both use `THEMES`.
 * 2. **Showcase auto-cycle** — `startShowcaseCycle()` advances one step
 *    roughly every 2.8s: re-theme the *next* diagram's svg in place via CSS
 *    custom properties (`svg.style.setProperty('--bg', …)`, the same "swap
 *    variables, no re-render" technique `demo/diagram-page-client.ts`'s
 *    `applyThemeToDiagram` uses for the per-diagram-type SEO pages) while
 *    it's still invisible, then crossfades it in over the outgoing one by
 *    moving the `.is-active` class between their
 *    `#theme-showcase-diagrams [data-slug]` elements — each slot's own
 *    `opacity 900ms ease` CSS transition (`demo/components/index-page.tsx`)
 *    does the actual fade, matching `.theme-showcase-diagram-card`'s own
 *    `900ms ease` `transition: background` exactly (same duration, same
 *    timing function) so the two move at the same visual rate. It also
 *    keeps the `--bg`/`--fg`/`--accent` code panel and the `N / <count>`
 *    counter in sync. Does nothing under `prefers-reduced-motion: reduce`
 *    — the build-time render is a complete, correctly themed diagram on
 *    its own.
 *
 *    Deliberately a crossfade (two svgs, each always at full contrast,
 *    opacity-blended) rather than interpolating one svg's --bg/--fg
 *    between the two themes' colors: tried first, and for two themes far
 *    apart in lightness (dracula to solarized-light) the interpolated
 *    midpoint is a muddy, low-contrast gray that makes the diagram's own
 *    text and strokes briefly unreadable mid-fade. A plain CSS
 *    `transition: fill 900ms` on the rendered shapes doesn't work anyway —
 *    each shape's fill derives from `--bg`/`--fg` through an intermediate,
 *    unregistered custom property (`var(--_node-fill)`, itself
 *    `color-mix(...)` of `--fg`/`--bg`; see `packages/core/theme.ts`), and
 *    Chromium doesn't detect a transitionable before/after value across
 *    that indirection (verified empirically) — so interpolating would
 *    need its own `requestAnimationFrame` tween regardless, on top of the
 *    readability problem.
 */
import { initChromeTheme } from './chrome-theme-client.ts'
import { THEMES, type DiagramColors } from '@zombie-mermaid/core'

/**
 * Must match `demo/components/index-page.tsx`'s own
 * `THEME_SHOWCASE_DEFAULT_THEME` — duplicated rather than imported (that
 * module is a `.tsx` React component file with no reason to end up in this
 * bundle) so the cycle's first step always starts from the exact theme the
 * build-time SVGs were already rendered in.
 */
const SHOWCASE_DEFAULT_THEME = 'dracula'

/** How long each (diagram, theme) pairing holds before advancing. */
const CYCLE_MS = 2800

const ENRICHMENT_KEYS = [
  'line',
  'accent',
  'muted',
  'surface',
  'border',
] as const satisfies readonly (keyof DiagramColors)[]

/**
 * `Object.keys(THEMES)`, rotated so {@link SHOWCASE_DEFAULT_THEME} is
 * first — step 0 of the cycle then matches the build-time SVGs' colors
 * exactly, so there's no visible jump between the static render and the
 * first live tick.
 */
function buildThemeOrder(): string[] {
  const keys = Object.keys(THEMES)
  const startAt = keys.indexOf(SHOWCASE_DEFAULT_THEME)
  if (startAt <= 0) return keys
  return [...keys.slice(startAt), ...keys.slice(0, startAt)]
}

/**
 * Blends `fgHex` into `bgHex` at `pctFg`% — the same derivation
 * `packages/core/src/theme.ts`'s `MIX.arrow` (85) uses internally to
 * derive an arrow color when a theme has no explicit `accent`. Used here
 * only to show a concrete value in the code panel for those themes
 * (`zinc-light`/`zinc-dark`); the diagrams themselves don't need this —
 * leaving `--accent` unset on the SVG lets its own embedded `<style>`
 * block fall back the same way.
 */
function mixHex(fgHex: string, bgHex: string, pctFg: number): string {
  const f = parseInt(fgHex.slice(1), 16)
  const b = parseInt(bgHex.slice(1), 16)
  const fr = (f >> 16) & 255
  const fg = (f >> 8) & 255
  const fb = f & 255
  const br = (b >> 16) & 255
  const bgc = (b >> 8) & 255
  const bb = b & 255
  const t = pctFg / 100
  const r = Math.round(fr * t + br * (1 - t))
  const g = Math.round(fg * t + bgc * (1 - t))
  const bl = Math.round(fb * t + bb * (1 - t))
  const hex = (v: number) => v.toString(16).padStart(2, '0')
  return '#' + hex(r) + hex(g) + hex(bl)
}

function startShowcaseCycle(): void {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) return

  const slots = Array.from(
    document.querySelectorAll<HTMLElement>(
      '#theme-showcase-diagrams [data-slug]',
    ),
  )
  const diagramCard = document.getElementById('theme-showcase-diagram-card')
  const counter = document.getElementById('theme-showcase-counter')
  const bgVal = document.getElementById('theme-showcase-bg-val')
  const fgVal = document.getElementById('theme-showcase-fg-val')
  const accentVal = document.getElementById('theme-showcase-accent-val')
  const bgSwatch = document.getElementById('theme-showcase-bg-swatch')
  const fgSwatch = document.getElementById('theme-showcase-fg-swatch')
  const accentSwatch = document.getElementById('theme-showcase-accent-swatch')
  if (
    slots.length === 0 ||
    !diagramCard ||
    !counter ||
    !bgVal ||
    !fgVal ||
    !accentVal ||
    !bgSwatch ||
    !fgSwatch ||
    !accentSwatch
  ) {
    return
  }

  const themeOrder = buildThemeOrder()
  let i = 0
  // Index into `slots` of whichever one currently carries .is-active --
  // starts at 0, matching the class the server-rendered markup already
  // put there. Tracked as an index, not an element reference, so the
  // reassignment below doesn't defeat TypeScript's null-narrowing on a
  // `let` captured by this closure.
  let activeIndex = 0

  window.setInterval(() => {
    i += 1
    const themeKey = themeOrder[i % themeOrder.length]
    const theme = themeKey ? THEMES[themeKey] : undefined
    if (!themeKey || !theme) return
    const nextIndex = i % slots.length
    const nextSlot = slots[nextIndex]
    if (!nextSlot) return

    // Re-theme the incoming slot's svg to the new theme's colors while
    // it's still invisible (opacity 0) -- crisp and correct from the
    // first frame it's crossfaded in, no interpolation involved.
    const svg = nextSlot.querySelector('svg')
    if (svg instanceof SVGSVGElement) {
      svg.style.setProperty('--bg', theme.bg)
      svg.style.setProperty('--fg', theme.fg)
      for (const prop of ENRICHMENT_KEYS) {
        const value = theme[prop]
        if (value) svg.style.setProperty('--' + prop, value)
        else svg.style.removeProperty('--' + prop)
      }
    }

    if (nextIndex !== activeIndex) {
      slots[activeIndex]?.classList.remove('is-active')
      nextSlot.classList.add('is-active')
      activeIndex = nextIndex
    }

    diagramCard.style.background = theme.bg
    counter.textContent = String((i % themeOrder.length) + 1)
    bgVal.textContent = theme.bg
    fgVal.textContent = theme.fg
    bgSwatch.style.background = theme.bg
    fgSwatch.style.background = theme.fg
    const accent = theme.accent ?? mixHex(theme.fg, theme.bg, 85)
    accentVal.textContent = accent
    accentSwatch.style.background = accent
  }, CYCLE_MS)
}

// Site chrome (Nav/Footer/cards): demo/chrome-theme-client.ts's job,
// unrelated to the showcase's own auto-cycle below.
initChromeTheme(THEMES)

startShowcaseCycle()
