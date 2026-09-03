/**
 * Shared theme-picker UI: a few pills inline, the rest in a "More" dropdown.
 *
 * Used by both the interactive gallery (index.ts) and the per-diagram-type
 * SEO pages (pages.ts) -- both include the "Default" pseudo-theme pill
 * (empty key) and both render it active initially, so a first-time visitor
 * sees the exact same look on either surface. On index.ts, Default means
 * "no override, use each sample's own baked-in colors"; on pages.ts it
 * means DEFAULT_SWATCH below, since a diagrams page always renders exactly
 * one diagram with no per-sample baked-in colors to fall back to.
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
 * always rendered active) ahead of the real themes. `activeThemeKey` marks
 * a real-theme pill active instead -- only takes effect when `includeDefault`
 * is false, or when `activeThemeKey` isn't the empty string the Default
 * pill already occupies, since the Default pill's own active state doesn't
 * consult it.
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
