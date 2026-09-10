/**
 * Client-side behavior for the homepage's live theme showcase (index.ts →
 * index.html): auto-cycles `demo/components/index-page.tsx`'s
 * `ThemeShowcase` section through all six pre-rendered diagrams and every
 * real theme in `THEMES`, live, plus (as of this PR) wires up
 * `ThemeShowcasePicker`'s click-to-jump theme selector — see that
 * component's own doc comment, and `ThemeShowcase`'s, for how the two
 * reconcile with #759's original "nothing on the page controls it"
 * rationale for the ambient cycle.
 *
 * Three concerns:
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
 *       {@link applyThemeToSlot} (CSS custom properties, "swap variables,
 *       no re-render" — the same technique
 *       `demo/diagram-page-client.ts`'s `applyThemeToDiagram` uses for the
 *       per-diagram-type SEO pages) and animate the card's own background
 *       to match ({@link THEME_COLOR_MS}, `demo/components/index-page.tsx`'s
 *       `transition: background`) — nothing diagram-shaped is on screen
 *       while this runs.
 *    3. Once that finishes, fade the (already re-themed) diagram back in
 *       ({@link DIAGRAM_FADE_MS} again).
 *    4. Hold for {@link HOLD_MS}, then repeat from 1.
 *
 *    It also keeps the `--bg`/`--fg`/`--accent` code panel in sync
 *    (updated in step 2, alongside the background). Does nothing under
 *    `prefers-reduced-motion: reduce` — the build-time render is a
 *    complete, correctly themed diagram on its own.
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
 * 3. **Theme picker** — `wireThemePicker()` opens/closes
 *    `ThemeShowcasePicker`'s dropdown and, on a pick, re-themes the
 *    *currently visible* diagram in place via the same
 *    {@link applyThemeToSlot} step the cycle uses (no diagram-type fade —
 *    the diagram on screen doesn't change), fires a brief
 *    `.theme-showcase-burst` ring flash so the click reads as having
 *    *done* something, and re-points the cycle's own position so it
 *    resumes counting forward from the picked theme rather than
 *    overwriting the pick on its next tick. The picker keeps working under
 *    `prefers-reduced-motion: reduce` (a click still re-themes instantly);
 *    only the ambient cycle and the burst flash are motion this file skips
 *    in that mode.
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
 * 1 and stage 3 of the ambient cycle described in this file's header doc
 * comment). Keep in sync by hand with `demo/components/index-page.tsx`'s
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

/** How long `.theme-showcase-burst.active` stays applied — must be >= its own CSS animation duration (650ms) so the animation is never cut off mid-flight. */
const BURST_MS = 700

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
 * only to show a concrete value in the code panel and the picker's swatch
 * dots for those themes (`zinc-light`/`zinc-dark`); the diagrams
 * themselves don't need this — leaving `--accent` unset on the SVG lets
 * its own embedded `<style>` block fall back the same way.
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

/**
 * The DOM refs both the ambient cycle and the picker re-theme against —
 * queried once, shared by reference. Includes `ThemeShowcasePicker`'s own
 * trigger label/chip/options: {@link applyThemeToSlot} keeps *those* in
 * sync too on every re-theme, ambient or manual, so the picker never shows
 * a stale "last picked" theme while the ambient cycle has silently moved
 * the actual diagram on to a different one — a real inconsistency this
 * file shipped with initially, caught in manual verification before this
 * PR (a click always re-synced the picker; the cycle's own ticks never
 * did).
 */
interface ShowcaseEls {
  diagramCard: HTMLElement
  themeName: HTMLElement
  bgVal: HTMLElement
  fgVal: HTMLElement
  accentVal: HTMLElement
  bgSwatch: HTMLElement
  fgSwatch: HTMLElement
  accentSwatch: HTMLElement
  pickerLabel: HTMLElement
  pickerChip: HTMLElement
  pickerOptions: HTMLElement[]
}

/**
 * Re-themes one diagram slot's svg via CSS custom properties, syncs the
 * `--bg`/`--fg`/`--accent` code panel, and syncs
 * `ThemeShowcasePicker`'s own trigger label/chip and each option's
 * `aria-selected` to match. Shared by `startShowcaseCycle()` (re-theming
 * the *incoming* slot mid-fade) and `wireThemePicker()` (re-theming the
 * *currently visible* slot in place, no fade) — see this file's header
 * doc comment.
 */
function applyThemeToSlot(
  slot: HTMLElement,
  themeKey: string,
  theme: DiagramColors,
  els: ShowcaseEls,
): void {
  const svg = slot.querySelector('svg')
  if (svg instanceof SVGSVGElement) {
    svg.style.setProperty('--bg', theme.bg)
    svg.style.setProperty('--fg', theme.fg)
    for (const prop of ENRICHMENT_KEYS) {
      const value = theme[prop]
      if (value) svg.style.setProperty('--' + prop, value)
      else svg.style.removeProperty('--' + prop)
    }
  }

  const label = THEME_LABELS[themeKey] ?? themeKey
  const accent = theme.accent ?? mixHex(theme.fg, theme.bg, 85)

  els.diagramCard.style.background = theme.bg
  els.themeName.textContent = '/* ' + label + ' */'
  els.bgVal.textContent = theme.bg
  els.fgVal.textContent = theme.fg
  els.bgSwatch.style.background = theme.bg
  els.fgSwatch.style.background = theme.fg
  els.accentVal.textContent = accent
  els.accentSwatch.style.background = accent

  els.pickerLabel.textContent = label
  els.pickerChip.style.background = accent
  for (const opt of els.pickerOptions) {
    opt.setAttribute('aria-selected', String(opt.dataset.theme === themeKey))
  }
}

/** Mutable position the ambient cycle and the picker both read/write, so a manual pick doesn't get immediately overwritten by (or fight) the next tick. */
interface ShowcaseState {
  themeOrder: string[]
  /** Index into {@link ShowcaseState.themeOrder} of the currently-applied theme. */
  themeIndex: number
  /** Index into `slots` of whichever one currently carries `.is-active`. */
  activeSlotIndex: number
  /**
   * The one pending `window.setTimeout` id in the cycle's chain, if any —
   * cleared and replaced on every reschedule, including by a manual pick,
   * so there's never more than one in flight. Typed as the DOM's `number`
   * (not `ReturnType<typeof window.setTimeout>`): this file only ever
   * runs in a browser, but `demo/tsconfig.json` extends the repo-root
   * config, whose ambient `@types/node` globals shadow `setTimeout`'s
   * return type with `NodeJS.Timeout` even under this project's own
   * `types: []` — a real `tsc -p demo/tsconfig.json` mismatch, not a
   * hypothetical one.
   */
  pendingTimeout: number | undefined
  /**
   * The cycle's own recursive step function, set once by
   * {@link startShowcaseCycle} and reused by a manual pick to reschedule
   * the *same* chain after exactly one {@link HOLD_MS} — rather than
   * calling `startShowcaseCycle()` again, which would stack an extra
   * `HOLD_MS` on top of its own initial delay. `undefined` until the
   * cycle actually starts (never, under reduced motion).
   */
  runCycle: (() => void) | undefined
}

function initThemeShowcase(): void {
  const slots = Array.from(
    document.querySelectorAll<HTMLElement>(
      '#theme-showcase-diagrams [data-slug]',
    ),
  )
  const diagramCard = document.getElementById('theme-showcase-diagram-card')
  const themeName = document.getElementById('theme-showcase-theme-name')
  const bgVal = document.getElementById('theme-showcase-bg-val')
  const fgVal = document.getElementById('theme-showcase-fg-val')
  const accentVal = document.getElementById('theme-showcase-accent-val')
  const bgSwatch = document.getElementById('theme-showcase-bg-swatch')
  const fgSwatch = document.getElementById('theme-showcase-fg-swatch')
  const accentSwatch = document.getElementById('theme-showcase-accent-swatch')
  const burst = document.getElementById('theme-showcase-burst')
  const pickerWrapper = document.getElementById('theme-showcase-picker')
  const pickerTrigger = document.getElementById('theme-showcase-picker-trigger')
  const pickerPanel = document.getElementById('theme-showcase-picker-panel')
  const pickerLabel = document.getElementById('theme-showcase-picker-label')
  const pickerChip = document.getElementById('theme-showcase-picker-chip')
  if (
    slots.length === 0 ||
    !diagramCard ||
    !themeName ||
    !bgVal ||
    !fgVal ||
    !accentVal ||
    !bgSwatch ||
    !fgSwatch ||
    !accentSwatch ||
    !burst ||
    !pickerWrapper ||
    !pickerTrigger ||
    !pickerPanel ||
    !pickerLabel ||
    !pickerChip
  ) {
    return
  }
  const pickerOptions = Array.from(
    pickerPanel.querySelectorAll<HTMLElement>('[data-theme]'),
  )
  const els: ShowcaseEls = {
    diagramCard,
    themeName,
    bgVal,
    fgVal,
    accentVal,
    bgSwatch,
    fgSwatch,
    accentSwatch,
    pickerLabel,
    pickerChip,
    pickerOptions,
  }

  const state: ShowcaseState = {
    themeOrder: buildThemeOrder(),
    themeIndex: 0,
    activeSlotIndex: 0,
    pendingTimeout: undefined,
    runCycle: undefined,
  }

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!reduced) startShowcaseCycle(slots, els, state)
  wireThemePicker(slots, els, state, {
    reduced,
    burst,
    wrapper: pickerWrapper,
    trigger: pickerTrigger,
    panel: pickerPanel,
  })
}

/**
 * Runs the ambient staged cycle (see this file's header doc comment for
 * the four steps) for as long as the page is open, rescheduling itself
 * via {@link ShowcaseState.pendingTimeout} so a manual pick from the
 * picker can always cancel whatever's currently pending and restart
 * cleanly from a fresh {@link HOLD_MS} delay instead of fighting it.
 */
function startShowcaseCycle(
  slots: HTMLElement[],
  els: ShowcaseEls,
  state: ShowcaseState,
): void {
  const runCycle = (): void => {
    state.themeIndex = (state.themeIndex + 1) % state.themeOrder.length
    const themeKey = state.themeOrder[state.themeIndex]
    const theme = themeKey ? THEMES[themeKey] : undefined
    const nextSlotIndex = (state.activeSlotIndex + 1) % slots.length
    const nextSlot = slots[nextSlotIndex]
    if (!themeKey || !theme || !nextSlot) {
      state.pendingTimeout = window.setTimeout(runCycle, HOLD_MS)
      return
    }

    // Step 1: fade the currently-visible diagram out.
    slots[state.activeSlotIndex]?.classList.remove('is-active')

    state.pendingTimeout = window.setTimeout(() => {
      // Step 2: it's fully transparent now -- re-theme the incoming
      // diagram (crisp and correct before it's ever shown, no
      // interpolation involved) with nothing diagram-shaped on screen to
      // blend against.
      applyThemeToSlot(nextSlot, themeKey, theme, els)

      state.pendingTimeout = window.setTimeout(() => {
        // Step 3: the background has finished animating -- fade the
        // (already re-themed) diagram back in.
        nextSlot.classList.add('is-active')
        state.activeSlotIndex = nextSlotIndex

        // Step 4: hold, then repeat from step 1.
        state.pendingTimeout = window.setTimeout(runCycle, HOLD_MS)
      }, THEME_COLOR_MS)
    }, DIAGRAM_FADE_MS)
  }

  state.runCycle = runCycle
  state.pendingTimeout = window.setTimeout(runCycle, HOLD_MS)
}

/**
 * Wires `ThemeShowcasePicker`'s trigger/panel/options: open/close (click,
 * Escape, outside-click — mirroring `theme-picker.tsx`'s `ThemePicker`
 * conventions for a visitor already familiar with that control elsewhere
 * on the site) and, on a pick, an instant in-place re-theme of the
 * currently-visible diagram plus a `.theme-showcase-burst` flash.
 */
function wireThemePicker(
  slots: HTMLElement[],
  els: ShowcaseEls,
  state: ShowcaseState,
  opts: {
    reduced: boolean
    burst: HTMLElement
    wrapper: HTMLElement
    trigger: HTMLElement
    panel: HTMLElement
  },
): void {
  const { wrapper, trigger, panel } = opts

  function setOpen(open: boolean): void {
    panel.hidden = !open
    trigger.setAttribute('aria-expanded', String(open))
    wrapper.classList.toggle('open', open)
  }

  trigger.addEventListener('click', () => {
    setOpen(panel.hidden)
  })

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || panel.hidden) return
    setOpen(false)
    trigger.focus()
  })
  document.addEventListener('click', (e) => {
    if (panel.hidden) return
    const target = e.target
    if (target instanceof Element && wrapper.contains(target)) return
    setOpen(false)
  })

  for (const option of els.pickerOptions) {
    option.addEventListener('click', () => {
      const themeKey = option.dataset.theme
      const theme = themeKey ? THEMES[themeKey] : undefined
      if (!themeKey || !theme) return

      // Re-themes the currently visible diagram in place, and (via
      // applyThemeToSlot's own els.pickerLabel/pickerChip/pickerOptions
      // sync) this trigger's label/chip and every option's
      // aria-selected -- no separate update needed here.
      const activeSlot = slots[state.activeSlotIndex]
      if (activeSlot) applyThemeToSlot(activeSlot, themeKey, theme, els)

      // Keep the ambient cycle's own position in sync so it resumes
      // forward from here instead of overwriting this pick next tick.
      const orderIndex = state.themeOrder.indexOf(themeKey)
      if (orderIndex >= 0) state.themeIndex = orderIndex

      if (!opts.reduced) {
        opts.burst.classList.remove('active')
        // Force a reflow so re-adding the class restarts the CSS
        // animation even if a previous burst is still finishing.
        void opts.burst.offsetWidth
        opts.burst.classList.add('active')
        window.setTimeout(() => opts.burst.classList.remove('active'), BURST_MS)
      }

      // A manual pick shouldn't be immediately clobbered by (or race) the
      // cycle's own next step -- cancel whatever's pending and reschedule
      // the *same* runCycle chain after exactly one HOLD_MS. No-op when
      // reduced motion means the cycle was never started (runCycle stays
      // undefined).
      if (state.runCycle) {
        if (state.pendingTimeout !== undefined) {
          window.clearTimeout(state.pendingTimeout)
        }
        state.pendingTimeout = window.setTimeout(state.runCycle, HOLD_MS)
      }

      setOpen(false)
      trigger.focus()
    })
  }
}

// Site chrome (Nav/Footer/cards): demo/chrome-theme-client.ts's job,
// unrelated to the showcase below.
initChromeTheme(THEMES)

initThemeShowcase()
