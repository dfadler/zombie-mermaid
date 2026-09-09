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
 * 2. **Showcase auto-cycle** — `startShowcaseCycle()` runs a strict, staged
 *    sequence rather than changing the diagram and the theme at once:
 *
 *    1. Fade the visible diagram out ({@link DIAGRAM_FADE_MS}, a plain CSS
 *       `opacity` transition on `.theme-showcase-diagram-slot` — toggling
 *       which slot carries `.is-active`).
 *    2. Once it's fully transparent, re-theme the *next* diagram's svg via
 *       CSS custom properties (`svg.style.setProperty('--bg', …)`, the
 *       same "swap variables, no re-render" technique
 *       `demo/diagram-page-client.ts`'s `applyThemeToDiagram` uses for the
 *       per-diagram-type SEO pages) and animate the card's own background
 *       to match ({@link THEME_COLOR_MS}, `demo/components/index-page.tsx`'s
 *       `transition: background`) — nothing diagram-shaped is on screen
 *       while this runs.
 *    3. Once that finishes, fade the (already re-themed) diagram back in
 *       ({@link DIAGRAM_FADE_MS} again).
 *    4. Hold for {@link HOLD_MS}, then repeat from 1.
 *
 *    It also keeps the `--bg`/`--fg`/`--accent` code panel and the
 *    `N / <count>` counter in sync (updated in step 2, alongside the
 *    background). Does nothing under `prefers-reduced-motion: reduce` —
 *    the build-time render is a complete, correctly themed diagram on its
 *    own.
 *
 *    Deliberately staged, not simultaneous: an earlier version crossfaded
 *    the outgoing/incoming diagrams *while* the card's background
 *    animated underneath, which technically worked but asked a viewer to
 *    track two overlapping motions moving independently. Staging them —
 *    diagram out, then color, then diagram in — reads as one clear
 *    sequence instead. It also sidesteps interpolating one svg's --bg/--fg
 *    between two themes' colors, which was tried even earlier: for two
 *    themes far apart in lightness (dracula to solarized-light) the
 *    interpolated midpoint is a muddy, low-contrast gray that makes the
 *    diagram's own text and strokes briefly unreadable mid-fade. Here,
 *    each diagram is always either fully hidden or fully themed, never
 *    mid-blend. (A plain CSS `transition: fill` on the rendered shapes
 *    wouldn't animate anyway — each shape's fill derives from `--bg`/
 *    `--fg` through an intermediate, unregistered custom property
 *    (`var(--_node-fill)`, itself `color-mix(...)` of `--fg`/`--bg`; see
 *    `packages/core/theme.ts`), and Chromium doesn't detect a
 *    transitionable before/after value across that indirection — verified
 *    empirically.)
 */
import { initChromeTheme } from './chrome-theme-client.ts'
import { THEMES, type DiagramColors } from '@zombie-mermaid/core'
import { THEME_LABELS } from './theme-labels.ts'

/**
 * Must match `demo/components/index-page.tsx`'s own
 * `THEME_SHOWCASE_DEFAULT_THEME` — duplicated rather than imported (that
 * module is a `.tsx` React component file with no reason to end up in this
 * bundle) so the cycle's first step always starts from the exact theme the
 * build-time SVGs were already rendered in.
 */
const SHOWCASE_DEFAULT_THEME = 'dracula'

/**
 * How long the outgoing/incoming diagram's own opacity fade takes (stage
 * 1 and stage 3 of the sequence in this file's header doc comment). Keep
 * in sync by hand with `demo/components/index-page.tsx`'s
 * `.theme-showcase-diagram-slot { transition: opacity 350ms ease; }` —
 * there's no shared constant between the two files (that module is a
 * `.tsx` React component file with no reason to end up in this bundle).
 * Quicker than {@link THEME_COLOR_MS}: this stage only has to clear the
 * diagram off-screen or bring it back, not carry a color change too.
 */
const DIAGRAM_FADE_MS = 350

/**
 * How long the card's background color takes to animate to the next
 * theme (stage 2). Keep in sync by hand with
 * `demo/components/index-page.tsx`'s `.theme-showcase-diagram-card`'s own
 * `transition: background 900ms ease` — same reasoning as
 * {@link DIAGRAM_FADE_MS} above.
 */
const THEME_COLOR_MS = 900

/** How long the fully-revealed diagram holds before the next cycle starts. */
const HOLD_MS = 2000

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
  const themeName = document.getElementById('theme-showcase-theme-name')
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
    !themeName ||
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

  /**
   * Runs one full staged cycle (see this file's header doc comment for
   * the four steps), then schedules the next one after {@link HOLD_MS}.
   * A chain of `setTimeout`s, not `setInterval`, because the steps have
   * different, non-uniform durations that must run in strict sequence.
   *
   * An arrow function assigned to a `const`, not a `function` declaration
   * -- TypeScript only carries the null-narrowing on `diagramCard` etc.
   * from the guard above into a closure it can analyze in place; a
   * hoisted `function` declaration loses it.
   */
  const runCycle = (): void => {
    i += 1
    const themeKey = themeOrder[i % themeOrder.length]
    const theme = themeKey ? THEMES[themeKey] : undefined
    const nextIndex = i % slots.length
    const nextSlot = slots[nextIndex]
    if (!themeKey || !theme || !nextSlot) {
      window.setTimeout(runCycle, HOLD_MS)
      return
    }

    // Step 1: fade the currently-visible diagram out.
    slots[activeIndex]?.classList.remove('is-active')

    window.setTimeout(() => {
      // Step 2: it's fully transparent now -- re-theme the incoming
      // diagram (crisp and correct before it's ever shown, no
      // interpolation involved) and animate the card's background to
      // match, with nothing diagram-shaped on screen to blend against.
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

      diagramCard.style.background = theme.bg
      themeName.textContent =
        '/* ' + (THEME_LABELS[themeKey] ?? themeKey) + ' */'
      counter.textContent = String((i % themeOrder.length) + 1)
      bgVal.textContent = theme.bg
      fgVal.textContent = theme.fg
      bgSwatch.style.background = theme.bg
      fgSwatch.style.background = theme.fg
      const accent = theme.accent ?? mixHex(theme.fg, theme.bg, 85)
      accentVal.textContent = accent
      accentSwatch.style.background = accent

      window.setTimeout(() => {
        // Step 3: the background has finished animating -- fade the
        // (already re-themed) diagram back in.
        nextSlot.classList.add('is-active')
        activeIndex = nextIndex

        // Step 4: hold, then repeat from step 1.
        window.setTimeout(runCycle, HOLD_MS)
      }, THEME_COLOR_MS)
    }, DIAGRAM_FADE_MS)
  }

  window.setTimeout(runCycle, HOLD_MS)
}

// Site chrome (Nav/Footer/cards): demo/chrome-theme-client.ts's job,
// unrelated to the showcase's own auto-cycle below.
initChromeTheme(THEMES)

startShowcaseCycle()
