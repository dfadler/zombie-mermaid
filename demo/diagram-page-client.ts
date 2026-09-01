/**
 * Client-side theme switcher for the per-diagram-type SEO pages
 * (pages.ts) — swaps the CSS custom properties on the page's one rendered
 * `<svg>` when a theme pill is clicked. No re-render: renderMermaidSVG's
 * output is already parameterized entirely by --bg/--fg (plus optional
 * --line/--accent/--muted/--surface/--border), so switching themes is just
 * updating those variables in place — see src/theme.ts's own header comment
 * for that architecture.
 *
 * Deliberately standalone rather than reusing demo/client.ts's
 * applyThemeToSvgElement: that function also handles xychart per-series
 * color variables and multiple `<svg>`s per sample, concerns this
 * single-diagram page doesn't have, and demo/client.ts's bundle pulls in
 * the full interactive gallery (search, sidebar, edit dialog) that has no
 * place on a lightweight SEO landing page. Theme color data is embedded as
 * inline JSON (window.__diagramPageThemes, written by pages.ts) rather than
 * importing src/theme.ts here, so this bundle stays small and this file can
 * live under demo/ without reaching outside its rootDir.
 */

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
  }
}

const THEMES = window.__diagramPageThemes

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

function mustGet(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`missing #${id}`)
  return el
}

function applyTheme(themeKey: string): void {
  const theme = THEMES[themeKey]
  if (!theme) return

  const svg = document.querySelector('.diagram-frame svg')
  if (svg instanceof SVGSVGElement) {
    svg.style.setProperty('--bg', theme.bg)
    svg.style.setProperty('--fg', theme.fg)
    for (const prop of ENRICHMENT_KEYS) {
      const value = theme[prop]
      if (value) svg.style.setProperty('--' + prop, value)
      else svg.style.removeProperty('--' + prop)
    }
  }

  document.querySelectorAll('.theme-pill').forEach((pill) => {
    pill.classList.toggle(
      'active',
      pill.getAttribute('data-theme') === themeKey,
    )
  })

  const editorLink = document.querySelector('.cta-btn.primary')
  if (editorLink instanceof HTMLAnchorElement) {
    // Read/write the attribute, not the `.href` property -- the property
    // getter always returns a resolved absolute URL, which would silently
    // turn the original relative `../editor` markup into an absolute one.
    const base = (editorLink.getAttribute('href') ?? '').replace(/#.*$/, '')
    const hash = editorHash(window.__diagramPageSource, themeKey)
    editorLink.setAttribute('href', `${base}#${hash}`)
  }

  localStorage.setItem('zm-diagram-page-theme', themeKey)
}

// -- Pill clicks (event delegation, same pattern as demo/client.ts) --
mustGet('theme-pills').addEventListener('click', (e) => {
  const target = e.target
  if (!(target instanceof Element)) return
  const pill = target.closest('.theme-pill')
  if (!pill || pill.id === 'theme-more-btn') return
  const themeKey = pill.getAttribute('data-theme')
  if (themeKey) applyTheme(themeKey)

  const dd = document.getElementById('theme-more-dropdown')
  if (dd?.classList.contains('open')) {
    dd.classList.remove('open')
    mustGet('theme-more-btn').setAttribute('aria-expanded', 'false')
  }
})

// -- "More themes" dropdown --
const moreBtn = document.getElementById('theme-more-btn')
const moreDropdown = document.getElementById('theme-more-dropdown')
if (moreBtn && moreDropdown) {
  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    const isOpen = moreDropdown.classList.toggle('open')
    moreBtn.setAttribute('aria-expanded', String(isOpen))
  })

  document.addEventListener('click', (e) => {
    if (!moreDropdown.classList.contains('open')) return
    const target = e.target
    if (
      !(target instanceof Element) ||
      !target.closest('.theme-more-wrapper')
    ) {
      moreDropdown.classList.remove('open')
      moreBtn.setAttribute('aria-expanded', 'false')
    }
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && moreDropdown.classList.contains('open')) {
      moreDropdown.classList.remove('open')
      moreBtn.setAttribute('aria-expanded', 'false')
    }
  })
}

// -- Restore a previously picked theme, if it differs from this page's
//    build-time default --
const saved = localStorage.getItem('zm-diagram-page-theme')
if (saved && THEMES[saved]) applyTheme(saved)
