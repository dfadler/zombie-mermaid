// ============================================================================
// zombie-mermaid demo — client-side rendering, theming, and navigation
//
// Bundled by index.ts with esbuild and inlined into the generated page, the
// same way src/browser.ts already is. It previously lived as a ~680-line
// template-literal string inside index.ts, which meant no type checking, no
// linting, and no editor support for the largest piece of behavior on the
// page.
//
// The renderer bundle runs first and publishes `window.__mermaid`; this script
// consumes it. Sample data arrives through a `<script type="application/json">`
// tag rather than being interpolated into the source, so this file is plain
// code with no build-time substitution.
// ============================================================================

/** The subset of the renderer bundle's exports this page uses. */
interface MermaidBundle {
  THEMES: Record<string, DiagramColors>
  renderMermaidSVGAsync: (
    source: string,
    options?: Record<string, unknown>,
  ) => Promise<string>
  renderMermaidASCII: (
    source: string,
    options?: Record<string, unknown>,
  ) => string
  diagramColorsToAsciiTheme: (colors: DiagramColors) => unknown
  getSeriesColor: (index: number, accent: string, bg: string) => string
  CHART_ACCENT_FALLBACK: string
  isWideChar: (char: string) => boolean
}

interface DiagramColors {
  bg: string
  fg: string
  line?: string
  accent?: string
  muted?: string
  surface?: string
  border?: string
}

/** One gallery sample, as serialized into the page by index.ts. */
interface DemoSample {
  title: string
  description?: string
  source: string
  category: string
  options: Record<string, unknown>
}

declare global {
  interface Window {
    __mermaid: MermaidBundle
  }
}

/**
 * Give wide glyphs their terminal width inside a rendered ASCII panel.
 *
 * The ASCII renderer's box math assumes the terminal rule: a CJK, fullwidth,
 * or emoji glyph occupies exactly two columns. A browser instead gives it the
 * advance of whichever font supplies it — JetBrains Mono has no CJK coverage,
 * so the substitute face renders those glyphs at roughly 1.66x the Latin
 * advance here. The borders then fail to line up, on a page whose whole point
 * is that they do.
 *
 * Each wide glyph is wrapped in a span pinned to 2ch, restoring the terminal's
 * geometry. This runs over the DOM rather than the string because the browser
 * colour mode emits HTML, so the glyphs arrive already wrapped in colour spans.
 */
function applyWideCharWidths(container: HTMLElement): void {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode()) !== null) texts.push(node as Text)

  for (const text of texts) {
    if (![...text.data].some(isWideChar)) continue

    const fragment = document.createDocumentFragment()
    for (const ch of text.data) {
      if (isWideChar(ch)) {
        const span = document.createElement('span')
        span.className = 'ascii-wide'
        span.textContent = ch
        fragment.appendChild(span)
      } else {
        fragment.appendChild(document.createTextNode(ch))
      }
    }
    text.replaceWith(fragment)
  }
}

/**
 * Look up an element that the generated page is guaranteed to contain.
 *
 * index.ts emits every id this script reaches for, so a miss means the
 * generator and the client have drifted apart — a bug worth failing loudly on
 * at startup rather than silently no-opping some interaction later. Returning
 * a non-null type also removes the null check from ~40 call sites.
 */
function mustGet<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`demo: missing required element #${id}`)
  return el as T
}

/**
 * Look up an element that may legitimately be absent — per-sample containers
 * exist only for samples in the currently rendered category.
 */
function maybeGet<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null
}

/**
 * Narrow an event target to an Element so `.closest()` is available.
 *
 * `EventTarget` has no DOM-traversal methods; every delegated handler here
 * needs the element form.
 */
function eventElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null
}

/**
 * Sample definitions, read from the JSON script tag index.ts emits.
 *
 * Passing data through the DOM rather than interpolating it into this file
 * keeps the bundle free of build-time substitution — the file compiles and
 * type-checks on its own.
 */
function loadSamples(): DemoSample[] {
  const el = document.getElementById('demo-samples')
  if (!el || !el.textContent) return []
  try {
    return JSON.parse(el.textContent) as DemoSample[]
  } catch {
    console.error('demo: could not parse sample data')
    return []
  }
}

// ============================================================================
// Client-side rendering + theme switching
// ============================================================================

const samples = loadSamples()
const THEMES = window.__mermaid.THEMES
const renderMermaid = window.__mermaid.renderMermaidSVGAsync
const renderMermaidASCII = window.__mermaid.renderMermaidASCII
const diagramColorsToAsciiTheme = window.__mermaid.diagramColorsToAsciiTheme
const getSeriesColor = window.__mermaid.getSeriesColor
const CHART_ACCENT_FALLBACK = window.__mermaid.CHART_ACCENT_FALLBACK
const isWideChar = window.__mermaid.isWideChar

const totalTimingEl = mustGet('total-timing')

// -- Theme state --
// Stores each SVG element's original inline style attribute (from initial render)
// so we can restore per-sample colors when switching back to "Default".
/**
 * Optional theme colors mirrored onto each SVG as CSS custom properties.
 *
 * Typed as keys of DiagramColors so indexing a theme with one is checked;
 * it used to be a bare string array, which made every lookup implicitly any.
 */
const ENRICHMENT_KEYS = [
  'line',
  'accent',
  'muted',
  'surface',
  'border',
] as const satisfies ReadonlyArray<keyof DiagramColors>

/**
 * Each rendered SVG's original inline `style` attribute, indexed by sample.
 *
 * Sparse: only samples in a rendered category have an entry, so reads must
 * tolerate a hole (hence the `| undefined` and the guard at each use).
 */
const originalSvgStyles: Array<string | undefined> = []

function hexToRgb(
  hex: string | null | undefined,
): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== 'string') return null
  let value = hex.trim()
  if (value[0] === '#') value = value.slice(1)
  if (value.length === 3) {
    value = value.replace(/(.)/g, '$1$1')
  }
  if (value.length !== 6) return null
  const intValue = parseInt(value, 16)
  if (Number.isNaN(intValue)) return null
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  }
}

function setShadowVars(theme: DiagramColors | null) {
  const body = document.body
  const fg = theme ? theme.fg : '#27272A'
  const bg = theme ? theme.bg : '#FFFFFF'
  const accent = theme ? theme.accent || '#3b82f6' : '#3b82f6'
  const fgRgb = hexToRgb(fg) || { r: 39, g: 39, b: 42 }
  const bgRgb = hexToRgb(bg) || { r: 255, g: 255, b: 255 }
  const accentRgb = hexToRgb(accent) || { r: 59, g: 130, b: 246 }
  const brightness = (bgRgb.r * 299 + bgRgb.g * 587 + bgRgb.b * 114) / 1000
  const darkMode = brightness < 140

  body.style.setProperty(
    '--foreground-rgb',
    fgRgb.r + ', ' + fgRgb.g + ', ' + fgRgb.b,
  )
  body.style.setProperty(
    '--accent-rgb',
    accentRgb.r + ', ' + accentRgb.g + ', ' + accentRgb.b,
  )
  body.style.setProperty('--shadow-border-opacity', darkMode ? '0.15' : '0.08')
  body.style.setProperty('--shadow-blur-opacity', darkMode ? '0.12' : '0.06')
}

// Update <meta name="theme-color"> so Safari 26+ title bar matches the page.
// Computes color-mix(in srgb, fg 4%, bg) in JS since browsers may not
// reliably re-evaluate CSS color-mix() for the meta tag.
function updateThemeColor(fg: string, bg: string) {
  const fgRgb = hexToRgb(fg) || { r: 39, g: 39, b: 42 }
  const bgRgb = hexToRgb(bg) || { r: 255, g: 255, b: 255 }
  // Mix: 4% foreground, 96% background (matches body CSS)
  const r = Math.round(bgRgb.r * 0.96 + fgRgb.r * 0.04)
  const g = Math.round(bgRgb.g * 0.96 + fgRgb.g * 0.04)
  const b = Math.round(bgRgb.b * 0.96 + fgRgb.b * 0.04)
  const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  mustGet('theme-color-meta').setAttribute('content', hex)
  // Update --theme-bar-bg on body so gradients update instantly
  document.body.style.setProperty('--theme-bar-bg', hex)
  // Force Safari 26+ to re-read title bar color by updating the invisible fixed div
  // and triggering a reflow (display toggle + offsetHeight read)
  const safariDiv = mustGet('safari-theme-color')
  safariDiv.style.background = hex
  safariDiv.style.display = 'none'
  void safariDiv.offsetHeight
  safariDiv.style.display = ''
}

// ----------------------------------------------------------------
// Apply a named theme (or '' for Default) to the entire page.
//
// This is instant — no re-rendering needed. SVGs use CSS custom
// properties internally, so updating --bg/--fg on the <svg> tag
// re-paints all nodes, edges, text, and backgrounds via color-mix().
// ----------------------------------------------------------------
function applyTheme(themeKey: string) {
  const theme = (themeKey ? THEMES[themeKey] : null) ?? null
  const body = document.body

  // 1. Update body CSS variables — the entire page derives from these
  if (theme) {
    body.style.setProperty('--t-bg', theme.bg)
    body.style.setProperty('--t-fg', theme.fg)
    body.style.setProperty('--t-accent', theme.accent || '#3b82f6')
  } else {
    body.style.setProperty('--t-bg', '#FFFFFF')
    body.style.setProperty('--t-fg', '#27272A')
    body.style.setProperty('--t-accent', '#3b82f6')
  }
  setShadowVars(theme)
  updateThemeColor(theme ? theme.fg : '#27272A', theme ? theme.bg : '#FFFFFF')

  // 2. Update all rendered SVG elements' CSS variables. Indexed by sample
  // (not NodeList position) since not-yet-rendered categories mean this
  // list is sparse — a lazily-rendered sample picks up the live theme
  // itself (see renderSample), so skipping it here is correct, not stale.
  for (let j = 0; j < samples.length; j++) {
    const svgContainerEl = maybeGet('svg-' + j)
    const svgEl = svgContainerEl && svgContainerEl.querySelector('svg')
    if (!svgEl) continue
    if (theme) {
      // Override with the global theme colors
      svgEl.style.setProperty('--bg', theme.bg)
      svgEl.style.setProperty('--fg', theme.fg)
      // Set enrichment variables if provided, else remove so SVG
      // internal color-mix() fallbacks activate
      for (const prop of ENRICHMENT_KEYS) {
        const value = theme[prop]
        if (value) svgEl.style.setProperty('--' + prop, value)
        else svgEl.style.removeProperty('--' + prop)
      }
      // Recompute xychart series color vars from the new accent
      const maxColor = parseInt(
        svgEl.getAttribute('data-xychart-colors') || '-1',
        10,
      )
      if (maxColor >= 0) {
        const accent = theme.accent || CHART_ACCENT_FALLBACK
        svgEl.style.setProperty('--xychart-color-0', accent)
        for (let ci = 1; ci <= maxColor; ci++) {
          svgEl.style.setProperty(
            '--xychart-color-' + ci,
            getSeriesColor(ci, accent, theme.bg),
          )
        }
      }
    } else {
      // Restore original inline style from initial render
      if (originalSvgStyles[j] !== undefined) {
        svgEl.setAttribute('style', originalSvgStyles[j] ?? '')
      }
    }
  }

  // 3. Update SVG panel backgrounds to match (skip hero panels - keep transparent)
  for (let j = 0; j < samples.length; j++) {
    const panel = maybeGet('svg-panel-' + j)
    if (!panel) continue
    // Skip hero panels - they stay transparent
    if (panel.classList.contains('hero-diagram-panel')) continue
    if (theme) {
      panel.style.background = theme.bg
    } else {
      // Default mode: use the per-sample bg (or clear for page default)
      const sampleBg = panel.getAttribute('data-sample-bg')
      panel.style.background = sampleBg || ''
    }
  }

  // 4. Re-render ASCII panels with new theme colors — only for samples
  // already rendered. An unrendered (category not yet opened) sample picks
  // up the live theme itself when renderSample eventually runs for it, so
  // skipping it here isn't stale, and avoids rendering ASCII for the whole
  // sample set on every theme switch regardless of what's actually visible.
  const asciiTheme = theme ? diagramColorsToAsciiTheme(theme) : null
  for (let j = 0; j < samples.length; j++) {
    if (originalSvgStyles[j] === undefined) continue
    const asciiEl = maybeGet('ascii-' + j)
    if (!asciiEl) continue
    try {
      asciiEl.innerHTML = renderMermaidASCII(
        samples[j]!.source,
        asciiTheme ? { theme: asciiTheme } : {},
      )
      applyWideCharWidths(asciiEl)
    } catch {
      // Leave the previous ASCII rendering in place — a theme switch
      // should not blank a panel that rendered fine a moment ago.
    }
  }

  // 5. Update active pill
  document.querySelectorAll('.theme-pill').forEach((pill) => {
    const isActive = pill.getAttribute('data-theme') === themeKey
    pill.classList.toggle('active', isActive)
    pill.classList.toggle('shadow-tinted', isActive)
  })

  // 6. Persist selection
  if (themeKey) {
    localStorage.setItem('mermaid-theme', themeKey)
  } else {
    localStorage.removeItem('mermaid-theme')
  }
}

// -- Set up theme pill click handlers --
mustGet('theme-pills').addEventListener('click', function (e) {
  const pill = eventElement(e.target)?.closest('.theme-pill')
  if (!pill || pill.id === 'theme-more-btn') return
  applyTheme(pill.getAttribute('data-theme') || '')
  // Close "More" dropdown if a theme was picked from it
  const dd = mustGet('theme-more-dropdown')
  if (dd && dd.classList.contains('open')) dd.classList.remove('open')
})

// -- "More" themes dropdown (direct listener, same pattern as Contents) --
const moreBtn = mustGet('theme-more-btn')
const moreDropdown = mustGet('theme-more-dropdown')

if (moreBtn && moreDropdown) {
  moreBtn.addEventListener('click', function (e) {
    e.stopPropagation()
    moreDropdown.classList.toggle('open')
  })

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!moreDropdown.classList.contains('open')) return
    if (!eventElement(e.target)?.closest('.theme-more-wrapper')) {
      moreDropdown.classList.remove('open')
    }
  })

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && moreDropdown.classList.contains('open')) {
      moreDropdown.classList.remove('open')
    }
  })
}

// -- Random theme button --
// Resolve the Editor link against the current path so it works under both
// / (direct Pages URL) and /mermaid (Worker proxy, with or without trailing slash).
// Note: this script is embedded inside a TypeScript template literal, so regex
// backslashes get consumed during string interpolation. We use endsWith/slice
// here instead of a regex literal to avoid escaping pitfalls.
const editorLink = mustGet<HTMLAnchorElement>('editor-link')
if (editorLink) {
  let basePath = location.pathname
  if (basePath.indexOf('/index.html', basePath.length - 11) !== -1) {
    basePath = basePath.slice(0, basePath.length - 11)
  }
  if (basePath.charAt(basePath.length - 1) === '/') {
    basePath = basePath.slice(0, basePath.length - 1)
  }
  editorLink.href = basePath + '/editor'
}

const randomThemeBtn = mustGet('random-theme-btn')
const themeKeys = Object.keys(THEMES)
let currentThemeKey = localStorage.getItem('mermaid-theme') || ''

if (randomThemeBtn) {
  randomThemeBtn.addEventListener('click', function () {
    // Filter out the current theme so we never pick the same one
    const availableKeys = themeKeys.filter(function (k) {
      return k !== currentThemeKey
    })
    // Also include default ('') if not currently selected
    if (currentThemeKey !== '') availableKeys.push('')
    // Pick a random theme
    const randomIndex = Math.floor(Math.random() * availableKeys.length)
    const newThemeKey = availableKeys[randomIndex]
    if (newThemeKey === undefined) return
    currentThemeKey = newThemeKey
    applyTheme(newThemeKey)
  })
}

// -- Sidebar navigation (persistent on desktop; off-canvas drawer below 1024px) --
const sidebar = mustGet('sidebar')
const sidebarToggle = mustGet('sidebar-toggle')
const sidebarBackdrop = mustGet('sidebar-backdrop')

// Body scroll lock while the drawer is open — otherwise the page behind
// the backdrop keeps scrolling with touch, which is disorienting.
function openSidebarDrawer() {
  sidebar.classList.add('open')
  sidebarBackdrop.classList.add('open')
  sidebarToggle.setAttribute('aria-expanded', 'true')
  document.body.style.overflow = 'hidden'
}

function closeSidebarDrawer() {
  sidebar.classList.remove('open')
  sidebarBackdrop.classList.remove('open')
  sidebarToggle.setAttribute('aria-expanded', 'false')
  document.body.style.overflow = ''
}

/*
 * The drawer only exists below 1024px. Resizing or rotating up to desktop
 * width hides its controls in CSS but leaves the JS state untouched, so an
 * open drawer would strand document.body.style.overflow = 'hidden' with no
 * visible control left to release it. Reset everything together when the
 * query stops matching.
 */
const drawerQuery = window.matchMedia('(max-width: 1023px)')

drawerQuery.addEventListener('change', function (e) {
  if (!e.matches) closeSidebarDrawer()
})

sidebarToggle.addEventListener('click', function (e) {
  e.stopPropagation()
  if (sidebar.classList.contains('open')) closeSidebarDrawer()
  else openSidebarDrawer()
})

sidebarBackdrop.addEventListener('click', closeSidebarDrawer)

// A <summary> click switches the active category (see "Category switching"
// below); a sample <a> click smooth-scrolls to it. Either way, close the
// drawer so mobile visitors see the content they just picked.
sidebar.addEventListener('click', function (e) {
  const summary = eventElement(e.target)?.closest('summary')
  if (summary) {
    e.preventDefault()
    closeSidebarDrawer()
    const slug = summary
      .closest('.sidebar-group')
      ?.getAttribute('data-category-slug')
    if (!slug) return
    showCategory(slug, {
      updateHash: true,
      scrollToTop: true,
    })
    return
  }
  const link = eventElement(e.target)?.closest('a')
  if (!link) return
  const href = link.getAttribute('href')
  if (!href) return
  // Let a modified click (open in new tab, etc.) through untouched.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  closeSidebarDrawer()
  history.pushState(null, '', href)
  const target = document.querySelector(href)
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

// Keyboard-only preview: tabbing to a sidebar CTA scrolls its section into
// view, same as clicking it would — without waiting for activation (Enter).
// Unlike the click handler, this never calls showCategory: switching the
// active category on mere focus (no click/Enter) would be an unexpected
// context change, so a not-yet-active category's <summary> just no-ops
// here (its section is hidden, so scrollIntoView has nothing to do).
sidebar.addEventListener('focusin', function (e) {
  const link = eventElement(e.target)?.closest('a')
  if (link) {
    const href = link.getAttribute('href')
    const linkTarget = href ? document.querySelector(href) : null
    if (linkTarget)
      linkTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }
  const summary = eventElement(e.target)?.closest('summary')
  if (summary) {
    const slug = summary
      .closest('.sidebar-group')
      ?.getAttribute('data-category-slug')
    if (!slug) return
    const summaryTarget = maybeGet('category-' + slug)
    if (summaryTarget)
      summaryTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
})

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && sidebar.classList.contains('open'))
    closeSidebarDrawer()
})

// "Browse diagram types" — the category banner's explicit nudge toward the
// sidebar, since only one category renders by default (see below).
mustGet('browse-categories-btn').addEventListener('click', function () {
  if (drawerQuery.matches) {
    openSidebarDrawer()
  } else {
    sidebar.scrollIntoView({ behavior: 'smooth', block: 'start' })
    sidebar.classList.add('attention')
    setTimeout(function () {
      sidebar.classList.remove('attention')
    }, 1300)
  }
})

// -- Restore saved theme immediately (before rendering begins) --
const savedTheme = localStorage.getItem('mermaid-theme')
if (savedTheme && THEMES[savedTheme]) {
  // Apply page-level CSS variables right away to avoid flash
  const savedColors = THEMES[savedTheme]!
  document.body.style.setProperty('--t-bg', savedColors.bg)
  document.body.style.setProperty('--t-fg', savedColors.fg)
  document.body.style.setProperty('--t-accent', savedColors.accent || '#3b82f6')
  setShadowVars(savedColors)
  updateThemeColor(savedColors.fg, savedColors.bg)
  // Mark the correct pill as active
  document.querySelectorAll('.theme-pill').forEach((pill) => {
    const isActive = pill.getAttribute('data-theme') === savedTheme
    pill.classList.toggle('active', isActive)
    pill.classList.toggle('shadow-tinted', isActive)
  })
} else {
  setShadowVars(null)
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ============================================================================
// Per-sample rendering — extracted into its own function (rather than one
// eager loop over every sample) so it can run lazily: only the active
// category renders on load, and the rest render on demand when a visitor
// opens that category from the sidebar.
// ============================================================================

// Always read live, not captured once ahead of an await — a category can
// render long after page load, and a theme switch can land mid-render
// (applyTheme's own pass runs once and skips elements that don't exist in
// the DOM yet, so a stale snapshot here would leave this sample stuck with
// the wrong colors with nothing left to correct it).
function currentTheme(): DiagramColors | null {
  const themeKey = localStorage.getItem('mermaid-theme')
  return (themeKey ? THEMES[themeKey] : null) ?? null
}

async function renderSample(i: number) {
  const sample = samples[i]
  const svgContainer = maybeGet('svg-' + i)
  const asciiContainer = maybeGet('ascii-' + i)
  const svgPanel = maybeGet('svg-panel-' + i)

  // A sample outside the rendered category has no containers yet; the
  // category's own render pass will call this again once it does.
  if (!sample || !svgContainer || !asciiContainer) return

  try {
    const svg = await renderMermaid(sample.source, sample.options)
    const theme: DiagramColors | null = currentTheme()
    svgContainer.innerHTML = svg

    // Store the SVG's original inline style for Default mode restoration
    const svgEl = svgContainer.querySelector('svg')
    if (svgEl) {
      originalSvgStyles[i] = svgEl.getAttribute('style') || ''

      // If a global theme is active, immediately override the SVG's variables
      if (theme) {
        svgEl.style.setProperty('--bg', theme.bg)
        svgEl.style.setProperty('--fg', theme.fg)
        for (const prop of ENRICHMENT_KEYS) {
          const value = theme[prop]
          if (value) svgEl.style.setProperty('--' + prop, value)
          else svgEl.style.removeProperty('--' + prop)
        }
        // Recompute xychart series color vars from the saved theme's accent
        const maxColor = parseInt(
          svgEl.getAttribute('data-xychart-colors') || '-1',
          10,
        )
        if (maxColor >= 0) {
          const accent = theme.accent || CHART_ACCENT_FALLBACK
          svgEl.style.setProperty('--xychart-color-0', accent)
          for (let ci = 1; ci <= maxColor; ci++) {
            svgEl.style.setProperty(
              '--xychart-color-' + ci,
              getSeriesColor(ci, accent, theme.bg),
            )
          }
        }
      }
    } else {
      originalSvgStyles[i] = ''
    }

    // Set panel background to match the SVG (skip for hero panels - keep transparent)
    const isHeroPanel = svgPanel?.classList.contains('hero-diagram-panel')
    if (svgPanel && !isHeroPanel) {
      if (theme) {
        svgPanel.style.background = theme.bg
      } else {
        const sampleBg = svgPanel.getAttribute('data-sample-bg')
        if (sampleBg) svgPanel.style.background = sampleBg
      }
    }
  } catch (err) {
    svgContainer.innerHTML =
      '<div class="render-error">SVG Error: ' +
      escapeHtml(String(err)) +
      '</div>'
    originalSvgStyles[i] = ''
  }

  // Hero samples don't have ASCII panels
  if (asciiContainer) {
    try {
      const asciiTheme = currentTheme()
      const asciiOpts = asciiTheme
        ? { theme: diagramColorsToAsciiTheme(asciiTheme) }
        : {}
      asciiContainer.innerHTML = renderMermaidASCII(sample.source, asciiOpts)
      applyWideCharWidths(asciiContainer)
    } catch {
      asciiContainer.textContent = '(ASCII not supported for this diagram type)'
    }
  }
}

// ============================================================================
// Category switching — renders a category's samples the first time it's
// shown, then just toggles visibility on repeat visits (no re-render).
// ============================================================================

const renderedCategories: Record<string, boolean> = {}
let renderedCount = 0
let renderedMs = 0
const totalRenderable = samples.filter(function (s) {
  return s.category !== 'Hero'
}).length

function updateRenderStats() {
  totalTimingEl.textContent =
    renderedCount * 2 +
    ' of ' +
    totalRenderable * 2 +
    ' samples (SVG+ASCII) rendered in ' +
    renderedMs.toFixed(0) +
    ' ms so far'
}

async function renderCategory(slug: string) {
  if (renderedCategories[slug]) return
  renderedCategories[slug] = true
  const view = maybeGet('category-' + slug)
  if (!view) return
  const sections = view.querySelectorAll('.sample')
  const indices: number[] = []
  for (let n = 0; n < sections.length; n++) {
    indices.push(parseInt(sections[n]!.id.slice('sample-'.length), 10))
  }
  // Accumulate each sample's own duration (not one span for the whole
  // category) — a category render isn't awaited by its caller, so two
  // could overlap in wall-clock time and double-count a shared span.
  for (let m = 0; m < indices.length; m++) {
    const sampleStart = performance.now()
    await renderSample(indices[m]!)
    renderedMs += performance.now() - sampleStart
    renderedCount++
    updateRenderStats()
  }
}

function showCategory(
  slug: string,
  opts?: { updateHash?: boolean; scrollToTop?: boolean },
) {
  const options = opts ?? {}

  const views = document.querySelectorAll<HTMLElement>('.category-view')
  views.forEach((view) => {
    view.hidden = view.getAttribute('data-category') !== slug
  })

  let label = ''
  const groups = document.querySelectorAll<HTMLDetailsElement>('.sidebar-group')
  groups.forEach((group) => {
    const isActive = group.getAttribute('data-category-slug') === slug
    group.open = isActive
    if (isActive) label = group.getAttribute('data-category-label') || ''
  })

  const activeView = maybeGet('category-' + slug)
  const nameEl = mustGet('active-category-name')
  const countEl = mustGet('active-category-count')
  if (nameEl) nameEl.textContent = label
  if (countEl)
    countEl.textContent = String(
      activeView ? activeView.querySelectorAll('.sample').length : 0,
    )

  if (options.updateHash) history.replaceState(null, '', '#category-' + slug)
  if (options.scrollToTop) {
    const banner = document.getElementById('category-banner')
    if (banner) banner.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return renderCategory(slug)
}

// -- Initial render: hero samples (always visible) + whichever category
// the URL hash points at, defaulting to the first one. --
;(async function initSamples() {
  for (let hi = 0; hi < samples.length; hi++) {
    if (samples[hi]!.category === 'Hero') await renderSample(hi)
  }

  const hash = location.hash.slice(1)
  let initialSlug = null
  if (hash.indexOf('category-') === 0) {
    initialSlug = hash.slice('category-'.length)
  } else if (hash.indexOf('sample-') === 0) {
    const hashTarget = document.getElementById(hash)
    const hashView = hashTarget && hashTarget.closest('.category-view')
    if (hashView) initialSlug = hashView.getAttribute('data-category')
  }
  if (!initialSlug || !maybeGet('category-' + initialSlug)) {
    const firstView = document.querySelector('.category-view')
    initialSlug = firstView ? firstView.getAttribute('data-category') : null
  }
  if (!initialSlug) return

  await showCategory(initialSlug, { updateHash: false })

  if (hash.indexOf('sample-') === 0) {
    const jumpTarget = document.getElementById(hash)
    if (jumpTarget) jumpTarget.scrollIntoView({ block: 'start' })
  }
})()

// ============================================================================
// Edit dialog — open, close, save & re-render
// ============================================================================

const editOverlay = mustGet('edit-overlay')
const editTextarea = mustGet<HTMLTextAreaElement>('edit-dialog-textarea')
const editSaveBtn = mustGet('edit-dialog-save')
const editCancelBtn = mustGet('edit-dialog-cancel')
const editCloseBtn = mustGet('edit-dialog-close')
let editingSampleIndex = -1

function openEditDialog(index: number) {
  editingSampleIndex = index
  const sample = samples[index]
  if (!sample) return
  editTextarea.value = sample.source
  editOverlay.classList.add('open')
  editTextarea.focus()
}

function closeEditDialog() {
  editOverlay.classList.remove('open')
  editingSampleIndex = -1
}

async function saveAndRender() {
  const index = editingSampleIndex
  if (index < 0) return
  const source = editTextarea.value
  const editing = samples[index]
  if (!editing) return
  editing.source = source

  // Close dialog immediately so user sees results rendering
  closeEditDialog()

  // Update source panel with plain text (Shiki not available at runtime)
  const sourcePanel = document.getElementById('source-panel-' + index)
  if (sourcePanel) {
    const shikiEl = sourcePanel.querySelector('.shiki')
    if (shikiEl) {
      shikiEl.innerHTML = '<code>' + escapeHtml(source) + '</code>'
    }
  }

  // Re-render SVG (async — renderMermaid returns a Promise)
  const svgContainer = maybeGet('svg-' + index)
  const editedSample = samples[index]
  if (!svgContainer || !editedSample) return
  try {
    const svg = await renderMermaid(source, editedSample.options)
    svgContainer.innerHTML = svg
    const svgEl = svgContainer.querySelector('svg')
    if (svgEl) {
      originalSvgStyles[index] = svgEl.getAttribute('style') || ''
      const activeTheme = localStorage.getItem('mermaid-theme')
      const th = activeTheme ? THEMES[activeTheme] : undefined
      if (th) {
        svgEl.style.setProperty('--bg', th.bg)
        svgEl.style.setProperty('--fg', th.fg)
        for (const prop of ENRICHMENT_KEYS) {
          const value = th[prop]
          if (value) svgEl.style.setProperty('--' + prop, value)
          else svgEl.style.removeProperty('--' + prop)
        }
        // Recompute xychart series color vars
        const maxColor = parseInt(
          svgEl.getAttribute('data-xychart-colors') || '-1',
          10,
        )
        if (maxColor >= 0) {
          const accent = th.accent || CHART_ACCENT_FALLBACK
          svgEl.style.setProperty('--xychart-color-0', accent)
          for (let ci = 1; ci <= maxColor; ci++) {
            svgEl.style.setProperty(
              '--xychart-color-' + ci,
              getSeriesColor(ci, accent, th.bg),
            )
          }
        }
      }
    }
  } catch (err) {
    svgContainer.innerHTML =
      '<div class="render-error">' + escapeHtml(String(err)) + '</div>'
  }

  // Re-render ASCII
  const asciiContainer = maybeGet('ascii-' + index)
  if (asciiContainer) {
    try {
      const activeThemeKey = localStorage.getItem('mermaid-theme')
      const activeColors = activeThemeKey ? THEMES[activeThemeKey] : undefined
      const editAsciiOpts = activeColors
        ? { theme: diagramColorsToAsciiTheme(activeColors) }
        : {}
      asciiContainer.innerHTML = renderMermaidASCII(source, editAsciiOpts)
      applyWideCharWidths(asciiContainer)
    } catch (e) {
      asciiContainer.textContent =
        '(ASCII error: ' + (e instanceof Error ? e.message : String(e)) + ')'
    }
  }
}

// Event listeners
document.addEventListener('click', function (e) {
  const btn = eventElement(e.target)?.closest<HTMLElement>('.edit-btn')
  const sampleIndex = btn?.dataset['sample']
  if (sampleIndex !== undefined) openEditDialog(parseInt(sampleIndex, 10))
})
editSaveBtn.addEventListener('click', saveAndRender)
editCancelBtn.addEventListener('click', closeEditDialog)
editCloseBtn.addEventListener('click', closeEditDialog)
editOverlay.addEventListener('click', function (e) {
  if (e.target === editOverlay) closeEditDialog()
})
document.addEventListener('keydown', function (e) {
  if (!editOverlay.classList.contains('open')) return
  if (e.key === 'Escape') closeEditDialog()
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveAndRender()
})

// Keeps `declare global` valid in a module.
export {}
