/**
 * Client-side behavior for the homepage's live theme showcase (index.ts →
 * index.html): wires up `demo/components/index-page.tsx`'s
 * `ThemeShowcasePicker` — a "movie ticket stub" listbox that re-themes the
 * section's single decorative flowchart svg in place on a click. Matches
 * the design canvas ("1e — Flow + Burst") pixel-for-pixel: no ambient
 * auto-cycle, the diagram only ever changes on a manual pick.
 *
 * Three concerns:
 *
 * 1. **Site chrome re-theming** — `initChromeTheme(THEMES)`
 *    (`demo/chrome-theme-client.ts`, #772/#783) still applies whatever
 *    theme a returning visitor has stored elsewhere on the site to the
 *    Nav/Footer/cards on this page. This is unrelated to the showcase
 *    below: a visitor's site-wide theme choice (made on some other page's
 *    theme picker) and the showcase's own picker are two independent
 *    things that happen to both use `THEMES`.
 * 2. **Theme picker** — `wireThemePicker()` opens/closes
 *    `ThemeShowcasePicker`'s dropdown (click, Escape, outside-click, and
 *    ArrowUp/ArrowDown/Home/End roving focus among its options — mirroring
 *    `theme-picker.tsx`'s `ThemePicker` conventions for a visitor already
 *    familiar with that control elsewhere on the site) and, on a pick,
 *    re-themes the diagram via {@link applyTheme}: seven CSS custom
 *    properties set on `#theme-showcase-diagram-card` ("swap variables, no
 *    re-render" — the same technique `demo/diagram-page-client.ts`'s
 *    `applyThemeToDiagram` uses elsewhere), which the diagram's own CSS
 *    (`demo/components/index-page.tsx`'s `.tsd-*` classes) reads via
 *    `var()` with a 500ms transition — so a single `setProperty()` call per
 *    role re-colors every shape at once, rather than walking the diagram's
 *    individual elements. It also fires a brief
 *    `.theme-showcase-burst-ring` flash (an svg `<circle>` centered on the
 *    "Deploy?" diamond) so a click reads as having *done* something.
 *    `prefers-reduced-motion: reduce` only skips that flash and the
 *    diagram's own dashed-line flow animation — the picker itself keeps
 *    working (a click still re-themes instantly).
 * 3. **Output toggle** — `initThemeShowcaseOutputToggle()` switches
 *    `#theme-showcase-diagram-card` between its svg and (real,
 *    `renderMermaidASCII()`-produced) ASCII states by flipping the card's
 *    own `data-output-mode` attribute, mirroring the homepage hero's
 *    `HeroOutputPanel` toggle (`hero-output-panel.tsx`) but as plain DOM
 *    wiring instead of React state — same reasoning as the picker above:
 *    this section stays outside both of `index-app.tsx`'s hydrated islands
 *    specifically to keep `react-dom/server` out of the client bundle (see
 *    `index-app.tsx`'s header comment), so nothing under `#theme-showcase`
 *    can hydrate via React. Unlike the svg panel (a single `--tsd-*`
 *    `setProperty()` call per role), the ASCII panel's colors are baked
 *    into per-character `<span style="color:...">` markup at build time —
 *    one full render per theme (`demo/components/index-page.tsx`'s
 *    `themeShowcaseAsciiHtmlByTheme`), threaded down via
 *    `#theme-showcase-ascii-props`'s `<script type="application/json">`
 *    element — so `applyTheme()` re-themes it by replacing
 *    `#theme-showcase-ascii`'s whole `innerHTML` with that theme's
 *    pre-rendered entry, rather than swapping a CSS variable.
 * 4. **Fullscreen zoom: scale (#987), pan/pinch (#988)** —
 *    `initThemeShowcaseFullscreen()` wires `#theme-showcase-fullscreen-
 *    trigger`, a button beside the output toggle that
 *    `requestFullscreen()`s `#theme-showcase-grid` (the picker column and
 *    diagram card together — see that class's own CSS comment in
 *    `demo/components/index-page.tsx` for the reflow this triggers). The
 *    small inline card itself stays a static preview, matching
 *    `diagram-detail-app.tsx`'s `DetailOutputPanel` own convention: all
 *    zoom/pan/pinch interactivity is fullscreen-only. Once fullscreen,
 *    `#theme-showcase-zoom-in`/`-out`/`-reset` write scale to
 *    `#theme-showcase-output-body`'s `--tsd-scale` custom property (read
 *    via `var()` to apply `transform: translate(...) scale(n)` — the same
 *    "swap a variable, let CSS do the rest" technique {@link applyTheme}
 *    already uses for `--tsd-bg` etc.), and mouse-drag, single-finger
 *    touch-drag, two-finger touch pinch-zoom, trackpad wheel-pan, and
 *    trackpad ctrl/cmd-wheel pinch-zoom all drive that same property plus
 *    `--tsd-pan-x`/`--tsd-pan-y` (the `translate(...)` half of that rule),
 *    clamped so the zoomed content's edge never pans past
 *    `#theme-showcase-diagram-card`'s own visible box. All of it applies to
 *    whichever output (svg or ASCII `<pre>`) is currently visible, since
 *    both live inside that one wrapper. See `initThemeShowcaseFullscreen`'s
 *    own doc comment for why fullscreen, scale, pan, and pinch-zoom all
 *    share one function instead of splitting into separate ones.
 */
import { initChromeTheme } from './chrome-theme-client.ts'
import { THEMES, type DiagramColors } from '@zombie-mermaid/core'

/** How long `.theme-showcase-burst-ring.active` stays applied — must be >= its own CSS animation duration (650ms) so the animation is never cut off mid-flight. */
const BURST_MS = 700

/**
 * Blends `fgHex` into `bgHex` at `pctFg`% — matches
 * `demo/components/index-page.tsx`'s own `mixHex` (itself transcribed from
 * the design canvas's inline `mix()` helper), kept as a separate local
 * copy rather than a shared import: that file only ever runs at build time
 * under Node, and this one is the client bundle, so there's no reasonable
 * shared module for three lines of arithmetic without creating a
 * cross-bundle dependency neither side needs otherwise.
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
 * Derives the same six diagram color roles
 * `demo/components/index-page.tsx`'s `deriveShowcaseColors()` computes at
 * build time, so a pick re-themes the diagram identically to how it was
 * first rendered.
 */
interface DiagramShowcaseColors {
  bg: string
  nodeFill: string
  nodeStroke: string
  text: string
  labelText: string
  muted: string
  arrow: string
}

/** Mirrors `demo/components/index-page.tsx`'s `deriveShowcaseColors()` mapping exactly, so a pick re-themes the diagram identically to how it was first rendered. */
function deriveDiagramColors(theme: DiagramColors): DiagramShowcaseColors {
  const arrow = theme.accent ?? mixHex(theme.fg, theme.bg, 85)
  return {
    bg: theme.bg,
    nodeFill: mixHex(theme.fg, theme.bg, 6),
    nodeStroke: mixHex(theme.fg, theme.bg, 26),
    text: theme.fg,
    labelText: mixHex(theme.fg, theme.bg, 45),
    muted: mixHex(theme.fg, theme.bg, 34),
    arrow,
  }
}

/** The DOM refs the picker re-themes against — queried once, shared by reference. */
interface ShowcaseEls {
  diagramCard: HTMLElement
  pickerLabel: HTMLElement
  pickerChip: HTMLElement
  pickerOptions: HTMLElement[]
  /**
   * `#theme-showcase-ascii` and its per-theme pre-rendered HTML map (read
   * from `#theme-showcase-ascii-props`, see this file's header comment) —
   * both nullable rather than part of {@link initThemeShowcase}'s
   * all-or-nothing required-elements check: the ASCII toggle is a separate
   * feature from the svg re-theming this picker's whole job already is, so
   * malformed/absent ASCII markup degrades to "the svg still re-themes,
   * the ASCII panel just doesn't" rather than breaking the picker outright.
   */
  asciiPre: HTMLElement | null
  asciiHtmlByTheme: Record<string, string> | null
  /**
   * Edge scroll-fade overlays for {@link asciiPre} -- mirrors
   * `demo/components/fork-fixes-app.tsx`'s `AsciiWell`/`AsciiWellFade`,
   * wired here via plain DOM ({@link updateAsciiFade}) instead of a React
   * hook since this section never hydrates via React (see this file's
   * header comment). Nullable alongside `asciiPre` for the same
   * degrade-gracefully reason its own doc comment gives.
   */
  asciiFadeLeft: HTMLElement | null
  asciiFadeRight: HTMLElement | null
}

/**
 * Reads {@link themeShowcaseAsciiHtmlByTheme}'s full per-theme map back out
 * of `#theme-showcase-ascii-props`'s `<script type="application/json">`
 * element (`demo/components/index-page.tsx`'s `ThemeShowcase`) — `null` if
 * the element is missing or its content isn't valid JSON, so a malformed
 * page degrades gracefully (see {@link ShowcaseEls.asciiHtmlByTheme}'s own
 * doc comment) instead of throwing.
 */
function readThemeShowcaseAsciiHtmlByTheme(): Record<string, string> | null {
  const propsEl = document.getElementById('theme-showcase-ascii-props')
  if (!propsEl?.textContent) return null
  try {
    return JSON.parse(propsEl.textContent) as Record<string, string>
  } catch {
    return null
  }
}

/**
 * Toggles `els.asciiFadeLeft`/`asciiFadeRight`'s `.visible` class to match
 * `els.asciiPre`'s current scroll position -- mirrors
 * `demo/components/fork-fixes-app.tsx`'s `useScrollFadeVisibility` as a
 * plain function instead of a React hook: `right` stays visible while
 * there's more content to scroll into (including at rest, scrolled all the
 * way to the start), `left` only once scrolled away from the start. The 1px
 * slop absorbs the same sub-pixel `scrollLeft`/`scrollWidth` rounding that
 * hook's own comment describes. A no-op if the fade markup isn't present
 * (see {@link ShowcaseEls.asciiFadeLeft}'s doc comment).
 */
function updateAsciiFade(els: ShowcaseEls): void {
  const { asciiPre, asciiFadeLeft, asciiFadeRight } = els
  if (!asciiPre || !asciiFadeLeft || !asciiFadeRight) return
  asciiFadeLeft.classList.toggle('visible', asciiPre.scrollLeft > 1)
  asciiFadeRight.classList.toggle(
    'visible',
    asciiPre.scrollLeft + asciiPre.clientWidth < asciiPre.scrollWidth - 1,
  )
}

/**
 * Re-themes the diagram via CSS custom properties on `els.diagramCard`
 * (read by `demo/components/index-page.tsx`'s `.tsd-*` classes through
 * `var()`), swaps `els.asciiPre`'s whole `innerHTML` to `themeKey`'s
 * pre-rendered entry in `els.asciiHtmlByTheme` (a no-op if either is
 * `null` — see {@link ShowcaseEls.asciiPre}'s doc comment), and syncs
 * `ThemeShowcasePicker`'s own trigger label/chip and each option's
 * `aria-selected` to match.
 */
function applyTheme(
  themeKey: string,
  theme: DiagramColors,
  els: ShowcaseEls,
): void {
  const colors = deriveDiagramColors(theme)
  els.diagramCard.style.setProperty('--tsd-bg', colors.bg)
  els.diagramCard.style.setProperty('--tsd-node-fill', colors.nodeFill)
  els.diagramCard.style.setProperty('--tsd-node-stroke', colors.nodeStroke)
  els.diagramCard.style.setProperty('--tsd-text', colors.text)
  els.diagramCard.style.setProperty('--tsd-label-text', colors.labelText)
  els.diagramCard.style.setProperty('--tsd-muted', colors.muted)
  els.diagramCard.style.setProperty('--tsd-arrow', colors.arrow)

  const asciiHtml = els.asciiHtmlByTheme?.[themeKey]
  if (els.asciiPre && asciiHtml !== undefined) {
    els.asciiPre.innerHTML = asciiHtml
    // A content swap can change scrollWidth without changing asciiPre's
    // own box size, which is all the ResizeObserver wired in
    // initThemeShowcase() actually watches -- so the fade visibility needs
    // an explicit recheck here rather than relying on that observer alone.
    updateAsciiFade(els)
  }

  els.pickerLabel.textContent = themeKey
  els.pickerChip.style.background = colors.arrow
  for (const opt of els.pickerOptions) {
    opt.setAttribute('aria-selected', String(opt.dataset.theme === themeKey))
  }
}

/**
 * Queries the showcase's DOM refs and wires up the picker — a no-op (not a
 * thrown error) if any expected element is missing, since this script has
 * no other page to run on and a malformed/absent markup shouldn't break the
 * rest of the page's client bundle. Returns the resolved {@link ShowcaseEls}
 * (or `null` on that no-op path) so `initThemeShowcaseOutputToggle()` can
 * recheck the ASCII scroll-fade after its own toggle switches the panel
 * visible — see that call's own comment for why.
 */
function initThemeShowcase(): ShowcaseEls | null {
  const diagramCard = document.getElementById('theme-showcase-diagram-card')
  const burst = document.getElementById('theme-showcase-burst')
  const pickerWrapper = document.getElementById('theme-showcase-picker')
  const pickerTrigger = document.getElementById('theme-showcase-picker-trigger')
  const pickerPanel = document.getElementById('theme-showcase-picker-panel')
  const pickerLabel = document.getElementById('theme-showcase-picker-label')
  const pickerChip = document.getElementById('theme-showcase-picker-chip')
  if (
    !diagramCard ||
    !burst ||
    !pickerWrapper ||
    !pickerTrigger ||
    !pickerPanel ||
    !pickerLabel ||
    !pickerChip
  ) {
    return null
  }
  const pickerOptions = Array.from(
    pickerPanel.querySelectorAll<HTMLElement>('[data-theme]'),
  )
  const els: ShowcaseEls = {
    diagramCard,
    pickerLabel,
    pickerChip,
    pickerOptions,
    asciiPre: document.getElementById('theme-showcase-ascii'),
    asciiHtmlByTheme: readThemeShowcaseAsciiHtmlByTheme(),
    asciiFadeLeft: document.getElementById('theme-showcase-ascii-fade-left'),
    asciiFadeRight: document.getElementById('theme-showcase-ascii-fade-right'),
  }

  // Keeps the fade overlays in sync with scroll position and with the
  // well's own box-size changes (e.g. a viewport resize). NOT the
  // display:none -> display:block transition when the output toggle
  // switches to ASCII -- empirically a ResizeObserver here doesn't reliably
  // report that for a target that never had display:none set on itself,
  // only on an ancestor -- so initThemeShowcaseOutputToggle() gets an
  // explicit callback for that case instead (see its own doc comment), and
  // applyTheme() rechecks explicitly for the innerHTML-swap case.
  if (els.asciiPre && els.asciiFadeLeft && els.asciiFadeRight) {
    updateAsciiFade(els)
    els.asciiPre.addEventListener('scroll', () => updateAsciiFade(els), {
      passive: true,
    })
    new ResizeObserver(() => updateAsciiFade(els)).observe(els.asciiPre)
  }

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  wireThemePicker(els, {
    reduced,
    burst,
    wrapper: pickerWrapper,
    trigger: pickerTrigger,
    panel: pickerPanel,
  })

  return els
}

/**
 * Wires `ThemeShowcasePicker`'s trigger/panel/options: open/close (click,
 * Escape, outside-click, plus focus-on-open and ArrowUp/ArrowDown/Home/End
 * roving focus among the options — mirroring `theme-picker.tsx`'s
 * `ThemePicker` conventions) and, on a pick, an instant re-theme of the
 * diagram via {@link applyTheme} plus a `.theme-showcase-burst-ring` flash.
 */
function wireThemePicker(
  els: ShowcaseEls,
  opts: {
    reduced: boolean
    burst: HTMLElement
    wrapper: HTMLElement
    trigger: HTMLElement
    panel: HTMLElement
  },
): void {
  const { wrapper, trigger, panel } = opts

  /**
   * Focuses an option without letting the browser's default
   * scroll-into-view kick in -- #theme-showcase needs `overflow: hidden`
   * to clip its oversized decorative aurora/mesh background, which
   * (surprisingly) is enough to make it a real, programmatically
   * scrollable container even though nothing ever draws a scrollbar on
   * it. Plain `.focus()` on a deeply-nested option was walking up to that
   * ancestor and setting a nonzero `scrollTop` on it, silently shifting
   * the entire section's visible content (confirmed empirically: 27px,
   * every time, regardless of viewport size) -- exactly the "opening the
   * picker moves everything below it" bug this fixes. `preventScroll:
   * true` stops that, including the desirable case (the panel's own
   * `overflow-y: auto` scrolling to reveal an option outside its current
   * 300px window), so that specific, correct scroll is reimplemented by
   * hand here, scoped to just `panel.scrollTop`.
   */
  function focusOption(option: HTMLElement): void {
    option.focus({ preventScroll: true })
    const panelRect = panel.getBoundingClientRect()
    const optionRect = option.getBoundingClientRect()
    if (optionRect.top < panelRect.top) {
      panel.scrollTop -= panelRect.top - optionRect.top
    } else if (optionRect.bottom > panelRect.bottom) {
      panel.scrollTop += optionRect.bottom - panelRect.bottom
    }
  }

  /** The single place open/close state changes -- always call this rather than toggling `panel.hidden` directly, since opening also has to move focus (via {@link focusOption}). */
  function setOpen(open: boolean): void {
    panel.hidden = !open
    trigger.setAttribute('aria-expanded', String(open))
    wrapper.classList.toggle('open', open)
    if (open) {
      const selected = els.pickerOptions.find(
        (opt) => opt.getAttribute('aria-selected') === 'true',
      )
      const target = selected ?? els.pickerOptions[0]
      if (target) focusOption(target)
    }
  }

  trigger.addEventListener('click', () => {
    setOpen(panel.hidden)
  })

  // ArrowUp/ArrowDown/Home/End roving focus among the panel's own option
  // buttons -- mirrors theme-picker.tsx's ThemePicker onDropdownKeyDown,
  // scoped to whatever's rendered under the panel rather than a captured
  // items array, since the options are plain focusable buttons already.
  panel.addEventListener('keydown', (e) => {
    const items = els.pickerOptions
    if (items.length === 0) return
    const currentIndex = items.indexOf(document.activeElement as HTMLElement)
    let nextIndex: number | null = null
    if (e.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length
    } else if (e.key === 'ArrowUp') {
      nextIndex =
        currentIndex < 0
          ? items.length - 1
          : (currentIndex - 1 + items.length) % items.length
    } else if (e.key === 'Home') {
      nextIndex = 0
    } else if (e.key === 'End') {
      nextIndex = items.length - 1
    }
    if (nextIndex === null) return
    e.preventDefault()
    const next = items[nextIndex]
    if (next) focusOption(next)
  })

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || panel.hidden) return
    setOpen(false)
    trigger.focus({ preventScroll: true })
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

      applyTheme(themeKey, theme, els)

      if (!opts.reduced) {
        opts.burst.classList.remove('active')
        // Force a reflow so re-adding the class restarts the CSS
        // animation even if a previous burst is still finishing.
        // getBoundingClientRect(), not offsetWidth: the burst is an svg
        // <circle>, and offsetWidth is an HTMLElement-only property (always
        // undefined on an SVGElement, so it wouldn't force anything).
        void opts.burst.getBoundingClientRect()
        opts.burst.classList.add('active')
        window.setTimeout(() => opts.burst.classList.remove('active'), BURST_MS)
      }

      setOpen(false)
      trigger.focus({ preventScroll: true })
    })
  }
}

/**
 * Wires `#theme-showcase-diagram-card`'s "OUTPUT / SVG / ASCII" segmented
 * toggle (`demo/components/index-page.tsx`'s `ThemeShowcase`): a click
 * flips the card's `data-output-mode` attribute, which
 * `.theme-showcase-diagram-card[data-output-mode='ascii']`'s CSS rules
 * (same file) use to show/hide the svg vs. the pre-rendered
 * `#theme-showcase-ascii` block. A no-op (not a thrown error) if any
 * expected element is missing, matching {@link initThemeShowcase}'s own
 * defensive style.
 */
/** Applies `mode` to the output toggle's three elements — a plain function taking already-narrowed elements as parameters rather than a closure over them, since TS control-flow narrowing of `getElementById`'s `| null` result doesn't persist into a nested function body. */
function setThemeShowcaseOutputMode(
  card: HTMLElement,
  svgBtn: HTMLElement,
  asciiBtn: HTMLElement,
  mode: 'svg' | 'ascii',
): void {
  card.dataset.outputMode = mode
  const isSvg = mode === 'svg'
  svgBtn.classList.toggle('active', isSvg)
  svgBtn.setAttribute('aria-pressed', String(isSvg))
  asciiBtn.classList.toggle('active', !isSvg)
  asciiBtn.setAttribute('aria-pressed', String(!isSvg))
}

/**
 * @param onAsciiShown Called after a click switches to `'ascii'` mode --
 *   lets {@link initThemeShowcase} recheck its scroll-fade overlays once
 *   `#theme-showcase-ascii-wrap` actually has a box. Not something a
 *   `ResizeObserver` on the `<pre>` can catch on its own: empirically (this
 *   file's own testing, not just a spec reading) an ancestor's
 *   `display:none` -> `display:block` doesn't reliably deliver a resize
 *   entry for a descendant that never had `display:none` set on itself.
 */
function initThemeShowcaseOutputToggle(onAsciiShown?: () => void): void {
  const card = document.getElementById('theme-showcase-diagram-card')
  const svgBtn = document.getElementById('theme-showcase-output-svg')
  const asciiBtn = document.getElementById('theme-showcase-output-ascii')
  if (!card || !svgBtn || !asciiBtn) return

  svgBtn.addEventListener('click', () =>
    setThemeShowcaseOutputMode(card, svgBtn, asciiBtn, 'svg'),
  )
  asciiBtn.addEventListener('click', () => {
    setThemeShowcaseOutputMode(card, svgBtn, asciiBtn, 'ascii')
    onAsciiShown?.()
  })
}

/** How far `#theme-showcase-output-body` can zoom in/out (zombie-mermaid#987), via the +/-/reset buttons, pinch, or ctrl/cmd-wheel -- every one of those routes through `setScale()`'s own clamp to this range. */
const SCALE_MIN = 0.5
const SCALE_MAX = 2.5

/**
 * Trackpad pinch-to-zoom sensitivity for a ctrl/cmd-wheel event's `deltaY`
 * (zombie-mermaid#988's gesture follow-up) -- the exact value
 * `output-panel-viewport.ts`'s own `WHEEL_ZOOM_SENSITIVITY` uses, per that
 * file's comment: a naive 1:1 `deltaY` reads as sluggish for this gesture,
 * confirmed there by hands-on feedback after shipping that feature. Not
 * imported from there (see `pointerDistance`/`pointerMidpoint` below for
 * why this file can't import from that module at all).
 */
const WHEEL_ZOOM_SENSITIVITY = 0.997

interface Point {
  x: number
  y: number
}

/**
 * Euclidean distance between two points -- the pinch gesture's zoom
 * signal. Same one-line math as `output-panel-viewport.ts`'s own exported
 * `pointerDistance()`, duplicated rather than imported: that module's
 * top-level `import ... from 'react'` (for its `useOutputPanelViewport`
 * hook) would drag React into this file's bundle the moment anything is
 * imported from it, even just these two pure functions -- exactly what
 * this file's own header comment says to keep out.
 */
function pointerDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Midpoint between two points -- the pinch gesture's pan signal. Same math as `output-panel-viewport.ts`'s own `pointerMidpoint()`; see `pointerDistance` above for why it's duplicated, not imported. */
function pointerMidpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Whole-percent display for the zoom-reset button's label -- `formatScalePercent(1.005)` reads as "101%", not "100.5%": the label is a rounded summary, not the precise applied `--tsd-scale` value. */
function formatScalePercent(scale: number): string {
  return `${Math.round(scale * 100)}%`
}

/**
 * Trackpad-wheel-zoom step used for `#theme-showcase-zoom-in`/`-out`'s own
 * discrete +/- clicks -- the same `1.25` `output-panel-viewport.ts`'s own
 * `ZOOM_STEP` uses for its identical +/- buttons, duplicated rather than
 * imported (see `pointerDistance`'s own comment above for why).
 */
const ZOOM_STEP = 1.25

/**
 * Wires `#theme-showcase-grid`'s fullscreen toggle
 * (`#theme-showcase-fullscreen-trigger`) plus that fullscreen view's zoom
 * (`#theme-showcase-zoom-in`/`-out`/`-reset`, zombie-mermaid#987) and pan/
 * pinch (zombie-mermaid#988) support — all three share one function for
 * the same reasons `output-panel-viewport.ts`'s `useOutputPanelViewport`
 * bundles its own fullscreen-scoped zoom+pan: pan's clamp range depends on
 * the *live* scale value, pinch-zoom needs to drive the exact same
 * `setScale()` the +/- buttons use, and every one of these has to know
 * whether the grid is actually fullscreen right now — splitting any piece
 * out would mean either duplicating that `document.fullscreenElement`
 * check in a second function or a custom event just to hand off state.
 *
 * Requests fullscreen on `#theme-showcase-grid` itself, not just the
 * diagram card, so the theme picker column comes along too -- a visitor
 * gets picker + output toggle + zoom/pan together, not just a bigger
 * diagram. `isFullscreenActive()` below is the single source of truth for
 * "is this grid the fullscreen element right now," read from
 * `document.fullscreenElement` (never set optimistically from a click
 * handler) so it's correct regardless of *how* fullscreen was entered or
 * left — a click on this trigger, Esc, the browser exiting on its own, or
 * `requestFullscreen()` being rejected outright — mirroring
 * `editor-fullscreen.ts`'s `useEditorFullscreen` (#980) and
 * `diagram-detail-app.tsx`'s `DetailOutputPanel` (`toggleFullscreen`/its
 * own `fullscreenchange` listener), the two prior instances of this exact
 * pattern already in this repo.
 *
 * Scale, pan, and the pointer/pinch state map (`pointers`, `panStart`,
 * `pinchStart`) all reset to identity on *every* `fullscreenchange` (entry
 * or exit) -- entering or leaving fullscreen always starts from a clean
 * slate, matching `useOutputPanelViewport`'s own identical behavior on its
 * `active` flag flipping.
 *
 * Zoom/pan/pinch themselves are a no-op whenever `isFullscreenActive()` is
 * false -- the small inline card stays a static preview (matching
 * `DetailOutputPanel`'s own "small inline panel stays a static centered
 * preview" convention), with all interactivity gated behind fullscreen.
 * Three input paths once fullscreen, all reading/writing the same
 * `panX`/`panY`/`pointers` state:
 *   - mouse click-drag, single-finger touch-drag, and two-finger touch
 *     pinch-zoom: one Pointer Event listener set (`pointerdown`/
 *     `pointermove`/`pointerup`/`pointercancel`), gesture inferred purely
 *     from how many pointers are down (0/1/2) — the same `pointers`-map
 *     convention `output-panel-viewport.ts`'s `useOutputPanelViewport`
 *     already uses for the fullscreen diagram viewer's own pan+pinch (see
 *     `pointerDistance`'s own comment above for why that module's pinch
 *     math is duplicated here, not imported) — a more directly applicable
 *     prior art than `editor-viewport.ts`'s `scrollLeft`/`scrollTop` drag
 *     (which #988 itself points to, but which doesn't compose with this
 *     panel's `transform: scale()` zoom — see that issue's own "related
 *     prior art" note). Not reused directly: that hook is a React hook
 *     (`useState`/`useLayoutEffect`), and this section stays outside React
 *     hydration on purpose (see this file's header comment) — plus its own
 *     panning is deliberately unclamped (fine for its full-viewport
 *     overlay, not for this card, which still confines the zoomed content
 *     to its own box even fullscreen).
 *   - trackpad two-finger pan: a plain `wheel` event (neither `ctrlKey` nor
 *     `metaKey`).
 *   - trackpad pinch-to-zoom: a `wheel` event with `ctrlKey` or `metaKey`
 *     true — every evergreen browser reports a trackpad pinch gesture this
 *     way (`ctrlKey` on Windows/Linux, `metaKey`/Cmd on macOS), the same
 *     pair `editor-viewport.ts`'s own ctrl/cmd-wheel zoom and
 *     `output-panel-viewport.ts`'s own wheel handling both already check in
 *     this repo.
 * A lone pointer's drag is a no-op below 100% scale (nothing to reveal
 * yet) — `maxPanX`/`maxPanY` are computed from how much
 * `#theme-showcase-output-body`'s current (scaled)
 * `getBoundingClientRect()` overflows the card's own, which is zero once
 * nothing is clipped — and re-clamping on every scale change is also what
 * snaps `panX`/`panY` back to `(0, 0)` automatically once the scale
 * returns to 100%, with no separate "reset" path needed for that specific
 * case (on top of the unconditional fullscreenchange reset above).
 *
 * A no-op (not a thrown error) if any expected element is missing,
 * matching {@link initThemeShowcase}'s own defensive style.
 */
function initThemeShowcaseFullscreen(): void {
  const grid = document.getElementById('theme-showcase-grid')
  const card = document.getElementById('theme-showcase-diagram-card')
  const body = document.getElementById('theme-showcase-output-body')
  const fullscreenBtn = document.getElementById(
    'theme-showcase-fullscreen-trigger',
  )
  const zoomInBtn = document.getElementById('theme-showcase-zoom-in')
  const zoomOutBtn = document.getElementById('theme-showcase-zoom-out')
  const zoomResetBtn = document.getElementById('theme-showcase-zoom-reset')
  if (
    !grid ||
    !card ||
    !body ||
    !fullscreenBtn ||
    !zoomInBtn ||
    !zoomOutBtn ||
    !zoomResetBtn
  ) {
    return
  }

  const isFullscreenActive = (): boolean => document.fullscreenElement === grid

  const toggleFullscreen = (): void => {
    if (isFullscreenActive()) {
      document.exitFullscreen().catch(() => {
        // Rejected exit (e.g. already left some other way) -- the next
        // fullscreenchange, if any, is still what state below syncs from.
      })
    } else {
      grid.requestFullscreen().catch(() => {
        // Rejected entry (no user-activation, a permissions-policy block,
        // ...) -- isFullscreenActive() simply never flips, since no
        // fullscreenchange fires for a request that never took effect.
      })
    }
  }
  fullscreenBtn.addEventListener('click', toggleFullscreen)

  // Pan state (#988) -- see this function's own doc comment above for why
  // it lives here instead of a separate initThemeShowcasePan().
  let panX = 0
  let panY = 0
  let maxPanX = 0
  let maxPanY = 0

  const clampPan = (): void => {
    panX = Math.min(maxPanX, Math.max(-maxPanX, panX))
    panY = Math.min(maxPanY, Math.max(-maxPanY, panY))
  }

  const applyPan = (): void => {
    body.style.setProperty('--tsd-pan-x', `${panX}px`)
    body.style.setProperty('--tsd-pan-y', `${panY}px`)
  }

  /**
   * `maxPanX`/`maxPanY` come from comparing the already-scaled
   * `getBoundingClientRect()` of `body` against `card`'s own -- `translate`
   * doesn't change an element's rendered width/height, only its position,
   * so `bodyRect`'s size here already reflects the current `--tsd-scale`
   * with no need to separately track or re-derive the raw scale factor.
   * Re-clamping on every call is what snaps `panX`/`panY` back to
   * `(0, 0)` once `maxPanX`/`maxPanY` shrink back to zero (scale back at
   * 100%), with no separate reset path needed.
   */
  const recomputePanBounds = (): void => {
    const cardRect = card.getBoundingClientRect()
    const bodyRect = body.getBoundingClientRect()
    maxPanX = Math.max(0, (bodyRect.width - cardRect.width) / 2)
    maxPanY = Math.max(0, (bodyRect.height - cardRect.height) / 2)
    clampPan()
    applyPan()
    body.classList.toggle('pannable', maxPanX > 0 || maxPanY > 0)
  }

  // Module-scope `slider.value` equivalent -- there's no slider anymore
  // (#987's disclosure/range-input UI moved to the +/-/reset button group
  // below, matching DetailOutputPanel's own fullscreen zoom controls), so
  // the current scale is plain closure state instead of something read
  // back off a DOM element.
  let scale = 1

  // No step-snapping here (a prior revision of this function rounded every
  // setScale() call to the nearest 0.1, back when #987's UI was a range
  // slider whose thumb needed to visually land on a step). Now that scale
  // is driven by +/-/reset buttons and continuous gestures (pinch, wheel),
  // nothing needs a stepped value at all -- and snapping every call was
  // actively harmful for wheel-zoom specifically: since it always rounded
  // from the *previous already-snapped* scale rather than an unsnapped
  // accumulator, repeated small deltaY events (an ordinary trackpad pinch)
  // could round right back to the same value forever, leaving zoom stuck.
  // Confirmed by tracing it through: starting at scale=1, a wheel tick
  // small enough to only nudge the raw value to ~1.03 rounds straight back
  // to 1.0, and the next tick repeats identically since scale itself never
  // moved. formatScalePercent()'s own Math.round is the only rounding left
  // -- purely a display concern for the percentage label, not the applied
  // --tsd-scale value.
  const setScale = (next: number): void => {
    scale = Number.isFinite(next)
      ? Math.max(SCALE_MIN, Math.min(SCALE_MAX, next))
      : 1
    body.style.setProperty('--tsd-scale', String(scale))
    zoomResetBtn.textContent = formatScalePercent(scale)
    recomputePanBounds()
  }

  // CSS alone (.theme-showcase-zoom-controls only displays while
  // .theme-showcase-grid is :fullscreen) already keeps these three
  // unreachable outside fullscreen for a real user -- a display: none
  // button is neither clickable nor focusable. The isFullscreenActive()
  // check below is defense in depth, not load-bearing: matches every other
  // handler in this function, which never trusts CSS visibility alone.
  zoomInBtn.addEventListener('click', () => {
    if (isFullscreenActive()) setScale(scale * ZOOM_STEP)
  })
  zoomOutBtn.addEventListener('click', () => {
    if (isFullscreenActive()) setScale(scale / ZOOM_STEP)
  })
  zoomResetBtn.addEventListener('click', () => {
    if (isFullscreenActive()) setScale(1)
  })

  // Recomputes pan bounds on any resize of the card itself (a viewport
  // resize while fullscreen, a breakpoint change otherwise) that isn't
  // driven by a zoom button -- mirrors this file's other ResizeObserver use
  // (updateAsciiFade's, above) for the same reason: a size change that
  // isn't itself a `--tsd-scale` write still needs `maxPanX`/`maxPanY`
  // (and thus a possible re-clamp) refreshed.
  new ResizeObserver(recomputePanBounds).observe(card)

  // Mouse click-drag, single-finger touch-drag, and two-finger touch
  // pinch-zoom through one Pointer Event listener set (pointerdown/
  // pointermove/pointerup/pointercancel) -- the same pointers-map
  // convention `output-panel-viewport.ts`'s `useOutputPanelViewport` uses
  // for its fullscreen pan+pinch (gesture inferred purely from how many
  // pointers are currently down; see `pointerDistance`'s own comment above
  // for why that module's logic is duplicated here, not imported).
  // Adapted to drive #987's `setScale()` directly rather than owning zoom
  // state independently, so the zoom-reset button's percentage label
  // always matches a pinch-driven zoom too, and to clamp pan to this
  // panel's own box (that hook's own panning is deliberately unclamped --
  // fine for its full-viewport overlay, not for this small showcase card).
  const pointers = new Map<number, Point>()
  let panStart: { x: number; y: number; panX: number; panY: number } | null =
    null
  let pinchStart: {
    dist: number
    mid: Point
    scale: number
    panX: number
    panY: number
  } | null = null

  // (Re)snapshots the in-progress gesture from whatever pointers are
  // currently down -- called both on a fresh pointerdown and when a pinch
  // drops back to a single finger, so the remaining finger keeps panning
  // from exactly where it already was instead of jumping (mirrors
  // output-panel-viewport.ts's own beginGesture()). A single pointer only
  // starts a pan when there's already somewhere to pan to (`maxPanX`/
  // `maxPanY` > 0) -- unlike a pinch, which can always zoom in from
  // scratch, a lone finger doing nothing at 100% scale has nothing to do.
  const beginGesture = (): void => {
    panStart = null
    pinchStart = null
    const [a, b] = pointers.values()
    if (a && b) {
      pinchStart = {
        dist: pointerDistance(a, b),
        mid: pointerMidpoint(a, b),
        scale,
        panX,
        panY,
      }
    } else if (a && !b && (maxPanX > 0 || maxPanY > 0)) {
      panStart = { x: a.x, y: a.y, panX, panY }
    }
  }

  const onPointerDown = (e: PointerEvent): void => {
    if (!isFullscreenActive()) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (pointers.size >= 2) return // no more than two active pointers -- a third finger is ignored
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try {
      // jsdom (this repo's DOM test environment) implements no
      // setPointerCapture at all, and a real browser can still throw for a
      // pointerId it doesn't recognize as currently active -- see
      // output-panel-viewport.ts's own identical try/catch for why this
      // stays optional rather than a hard dependency (losing capture just
      // makes the gesture slightly less forgiving about leaving `body`'s
      // bounds, it doesn't stop panning/pinching from working).
      body.setPointerCapture?.(e.pointerId)
    } catch {
      // See comment above -- capture is a nice-to-have.
    }
    beginGesture()
    if (!panStart && !pinchStart) return
    body.classList.add('panning')
    e.preventDefault() // stop native text/image drag-select while panning/pinching
  }
  const onPointerMove = (e: PointerEvent): void => {
    if (!isFullscreenActive() || !pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const [a, b] = pointers.values()
    if (pinchStart && a && b) {
      const start = pinchStart
      setScale(start.scale * (pointerDistance(a, b) / start.dist))
      const mid = pointerMidpoint(a, b)
      panX = start.panX + (mid.x - start.mid.x)
      panY = start.panY + (mid.y - start.mid.y)
      clampPan()
      applyPan()
      e.preventDefault()
    } else if (panStart && a && !b) {
      const start = panStart
      panX = start.panX + (a.x - start.x)
      panY = start.panY + (a.y - start.y)
      clampPan()
      applyPan()
      e.preventDefault()
    }
  }
  const endGesture = (e: PointerEvent): void => {
    if (!pointers.has(e.pointerId)) return
    pointers.delete(e.pointerId)
    // Restart from whatever's left (one finger, or none) rather than just
    // clearing -- see beginGesture's own comment. A pinch dropping to one
    // finger keeps panning from exactly where it was, not from a jump.
    beginGesture()
    if (pointers.size === 0) body.classList.remove('panning')
  }

  body.addEventListener('pointerdown', onPointerDown)
  body.addEventListener('pointermove', onPointerMove)
  body.addEventListener('pointerup', endGesture)
  body.addEventListener('pointercancel', endGesture)

  // Trackpad gestures: a plain wheel event, deliberately separate from the
  // Pointer Event set above -- a trackpad swipe/pinch fires wheel events,
  // never pointer events, mirroring output-panel-viewport.ts's own wheel
  // listener registered alongside (not instead of) its pointer listeners.
  // `ctrlKey`/`metaKey` is how every evergreen browser reports a trackpad
  // pinch as a wheel event -- `ctrlKey` on Windows/Linux trackpads, `metaKey`
  // (Cmd) on macOS's own pinch-to-zoom convention -- the same pair
  // editor-viewport.ts's own ctrl/cmd-wheel zoom and output-panel-
  // viewport.ts's own onWheel both already check, so either now zooms
  // (matching that established convention) rather than being left for the
  // browser's own page-zoom; a plain wheel (#988) still pans.
  body.addEventListener(
    'wheel',
    (e) => {
      if (!isFullscreenActive()) return
      if (e.ctrlKey || e.metaKey) {
        setScale(scale * Math.pow(WHEEL_ZOOM_SENSITIVITY, e.deltaY))
        e.preventDefault()
        return
      }
      if (maxPanX <= 0 && maxPanY <= 0) return
      panX -= e.deltaX
      panY -= e.deltaY
      clampPan()
      applyPan()
      e.preventDefault()
    },
    { passive: false },
  )

  // Entering or leaving fullscreen always starts from a clean slate --
  // matches output-panel-viewport.ts's useOutputPanelViewport's identical
  // behavior on its own `active` flag flipping. Also syncs
  // #theme-showcase-fullscreen-trigger's data-fullscreen/aria-pressed/title
  // from document.fullscreenElement, the only state fullscreenchange
  // itself is trusted to report correctly (see this function's own doc
  // comment on why isFullscreenActive() never gets set optimistically).
  document.addEventListener('fullscreenchange', () => {
    const active = isFullscreenActive()
    fullscreenBtn.dataset.fullscreen = String(active)
    fullscreenBtn.setAttribute('aria-pressed', String(active))
    fullscreenBtn.title = active ? 'Exit fullscreen' : 'View fullscreen'
    pointers.clear()
    panStart = null
    pinchStart = null
    body.classList.remove('panning')
    setScale(1)
  })
}

// Site chrome (Nav/Footer/cards): demo/chrome-theme-client.ts's job,
// unrelated to the showcase below.
initChromeTheme(THEMES)

const showcaseEls = initThemeShowcase()
initThemeShowcaseOutputToggle(
  showcaseEls ? () => updateAsciiFade(showcaseEls) : undefined,
)
initThemeShowcaseFullscreen()
