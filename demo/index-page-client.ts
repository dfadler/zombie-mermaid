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

// Site chrome (Nav/Footer/cards): demo/chrome-theme-client.ts's job,
// unrelated to the showcase below.
initChromeTheme(THEMES)

const showcaseEls = initThemeShowcase()
initThemeShowcaseOutputToggle(
  showcaseEls ? () => updateAsciiFade(showcaseEls) : undefined,
)
