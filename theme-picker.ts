/**
 * Shared theme-picker UI: a few pills inline, the rest in a "More" dropdown.
 *
 * Used by both the interactive gallery (index.ts, which also offers a
 * "Default" pseudo-theme meaning "no override, use each sample's own
 * baked-in colors") and the per-diagram-type SEO pages (pages.ts, where
 * every pill is a real theme and exactly one is always active, matching
 * whichever theme the page happened to render with at build time).
 */
import { escapeHtml } from './demo/format.ts'
import { THEMES } from './src/theme.ts'
import { THEME_LABELS, THEME_DESCRIPTIONS } from './demo/theme-labels.ts'

/** Themes shown as inline pills; the rest live in the "More" dropdown. */
export const INLINE_THEMES = new Set(['dracula', 'solarized-light'])

/** The Default (no theme) pill's swatch colors. */
export const DEFAULT_SWATCH = { bg: '#FFFFFF', fg: '#27272A' }

/** One theme pill, with a color swatch rendered at build time. */
export function renderThemePill(
  key: string,
  colors: { bg: string; fg: string },
  active = false,
): string {
  const isDark = parseInt(colors.bg.replace('#', '').slice(0, 2), 16) < 0x80
  const shadow = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
  const label = key === '' ? 'Default' : (THEME_LABELS[key] ?? key)
  const activeClass = active ? ' active' : ''
  const description = THEME_DESCRIPTIONS[key]
  const titleAttr = description ? ` title="${escapeHtml(description)}"` : ''
  return `<button class="theme-pill shadow-minimal${activeClass}" data-theme="${key}"${titleAttr}><span class="theme-swatch" style="background:${colors.bg};box-shadow:inset 0 0 0 1px ${shadow}"></span>${escapeHtml(label)}</button>`
}

/**
 * Build the theme picker: a few pills inline, every theme in a dropdown.
 *
 * `includeDefault` prepends the "Default" pseudo-theme pill (empty key,
 * always rendered active) ahead of the real themes — the gallery's own
 * concept, not something the SEO pages need. `activeThemeKey`, when given,
 * marks the matching real-theme pill active instead (the SEO pages' case:
 * the theme the page actually rendered with at build time).
 */
export function renderThemePicker(opts: {
  includeDefault: boolean
  activeThemeKey?: string
}): string {
  const themeEntries = Object.entries(THEMES)
  const defaultPill = opts.includeDefault
    ? [renderThemePill('', DEFAULT_SWATCH, true)]
    : []

  const pill = ([key, colors]: [string, { bg: string; fg: string }]) =>
    renderThemePill(key, colors, key === opts.activeThemeKey)

  const visiblePills = [
    ...defaultPill,
    ...themeEntries.filter(([key]) => INLINE_THEMES.has(key)).map(pill),
  ]

  const allDropdownPills = [...defaultPill, ...themeEntries.map(pill)]

  return `
    <div class="theme-pills-inline">
      ${visiblePills.join('\n      ')}
    </div>
    <div class="theme-more-wrapper">
      <button class="theme-pill shadow-minimal" id="theme-more-btn" aria-label="More themes" aria-haspopup="true" aria-controls="theme-more-dropdown" aria-expanded="false">${allDropdownPills.length} Themes</button>
      <div class="theme-more-dropdown shadow-modal-small" id="theme-more-dropdown">
        ${allDropdownPills.join('\n        ')}
      </div>
    </div>`
}
