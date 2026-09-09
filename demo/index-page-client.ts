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
 *    roughly every 2.8s: swap which of the six `#theme-showcase-diagrams
 *    [data-slug]` SVGs is visible, re-theme all six in place via CSS
 *    custom properties (`svg.style.setProperty('--bg', …)`, the same
 *    "swap variables, no re-render" technique
 *    `demo/diagram-page-client.ts`'s `applyThemeToDiagram` uses for the
 *    per-diagram-type SEO pages), and keep the `--bg`/`--fg`/`--accent`
 *    code panel and the `N / <count>` counter in sync. Does nothing under
 *    `prefers-reduced-motion: reduce` — the build-time render is a
 *    complete, correctly themed diagram on its own.
 *
 *    The color change itself is hand-tweened in JS (`animateThemeChange`),
 *    not a plain CSS `transition` — a bare `transition: fill 900ms` on the
 *    rendered shapes does *not* animate here, because each shape's fill
 *    derives from `--bg`/`--fg` through an intermediate, unregistered
 *    custom property (`var(--_node-fill)`, itself `color-mix(...)` of
 *    `--fg`/`--bg`; see `packages/core/theme.ts`), and Chromium doesn't
 *    detect a transitionable before/after value across that indirection
 *    (verified empirically). Registering `--bg`/`--fg` via `@property`
 *    would fix it but would apply site-wide, since those same two names
 *    are also the page's own root theme tokens — too broad for a fix
 *    scoped to this section. `animateThemeChange` instead steps
 *    `--bg`/`--fg`/… across the fade window via `requestAnimationFrame`,
 *    matching `demo/components/index-page.tsx`'s own `900ms ease`
 *    `transition: background` on the surrounding card.
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

/** Linearly interpolates between two `#rrggbb` hex colors at `t` (0..1). */
function lerpHex(fromHex: string, toHex: string, t: number): string {
  const from = parseInt(fromHex.slice(1), 16)
  const to = parseInt(toHex.slice(1), 16)
  const fr = (from >> 16) & 255
  const fg = (from >> 8) & 255
  const fb = from & 255
  const tr = (to >> 16) & 255
  const tg = (to >> 8) & 255
  const tb = to & 255
  const r = Math.round(fr + (tr - fr) * t)
  const g = Math.round(fg + (tg - fg) * t)
  const b = Math.round(fb + (tb - fb) * t)
  const hex = (v: number) => v.toString(16).padStart(2, '0')
  return '#' + hex(r) + hex(g) + hex(b)
}

/** Rough visual match for CSS's `ease` timing function (easeOutQuad). */
function ease(t: number): number {
  return t * (2 - t)
}

/**
 * How long each theme-color fade takes — kept in sync by hand with
 * `demo/components/index-page.tsx`'s `900ms ease` `transition: background`
 * on `.theme-showcase-diagram-card` (there's no shared constant between
 * the two files; see this file's own header doc comment for why).
 */
const THEME_FADE_MS = 900

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

  const initialTheme = THEMES[SHOWCASE_DEFAULT_THEME]
  if (!initialTheme) return
  // The colors currently applied to every slot's svg -- the fade's "from"
  // state each tick. Starts at the theme the build-time SVGs were already
  // rendered in, so the first tick fades from what's actually on screen.
  let currentTheme: DiagramColors = initialTheme
  let fadeRafId: number | null = null

  /**
   * Steps every slot's svg --bg/--fg/... from `fromTheme` to `toTheme` over
   * `durationMs` via requestAnimationFrame -- see this file's header doc
   * comment for why a plain CSS `transition` doesn't work here.
   */
  function animateThemeChange(
    fromTheme: DiagramColors,
    toTheme: DiagramColors,
    durationMs: number,
  ): void {
    if (fadeRafId !== null) cancelAnimationFrame(fadeRafId)
    const start = performance.now()

    function tick(now: number): void {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = ease(t)
      for (const el of slots) {
        const svg = el.querySelector('svg')
        if (!(svg instanceof SVGSVGElement)) continue
        svg.style.setProperty('--bg', lerpHex(fromTheme.bg, toTheme.bg, eased))
        svg.style.setProperty('--fg', lerpHex(fromTheme.fg, toTheme.fg, eased))
        for (const prop of ENRICHMENT_KEYS) {
          const fromValue = fromTheme[prop]
          const toValue = toTheme[prop]
          if (fromValue && toValue) {
            svg.style.setProperty('--' + prop, lerpHex(fromValue, toValue, eased))
          } else if (toValue) {
            // The outgoing theme left this channel unset -- nothing to
            // fade from, so just set the target directly.
            svg.style.setProperty('--' + prop, toValue)
          } else {
            svg.style.removeProperty('--' + prop)
          }
        }
      }
      fadeRafId = t < 1 ? requestAnimationFrame(tick) : null
    }

    fadeRafId = requestAnimationFrame(tick)
  }

  window.setInterval(() => {
    i += 1
    const themeKey = themeOrder[i % themeOrder.length]
    const theme = themeKey ? THEMES[themeKey] : undefined
    if (!themeKey || !theme) return
    const slot = slots[i % slots.length]

    for (const el of slots) {
      el.style.display = el === slot ? 'flex' : 'none'
    }
    animateThemeChange(currentTheme, theme, THEME_FADE_MS)
    currentTheme = theme

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
