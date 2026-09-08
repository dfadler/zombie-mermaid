/** @jsxRuntime automatic */
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
 *
 * React components as of #589 (was theme-picker.ts, a template-literal
 * module at the repo root). Same markup, class names, and ARIA attributes;
 * the pills are simply built by JSX now so the two React page generators
 * that embed them don't have to splice a raw HTML string in.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { THEMES } from '@zombie-mermaid/core'
import { THEME_LABELS, THEME_DESCRIPTIONS } from '../theme-labels.ts'

/** Themes shown as inline pills; the rest live in the "More" dropdown. */
export const INLINE_THEMES = new Set(['dracula', 'solarized-light'])

/** The Default (no theme) pill's swatch colors. */
export const DEFAULT_SWATCH = { bg: '#FFFFFF', fg: '#27272A' }

export interface ThemePillProps {
  /** Theme key, or `''` for the "Default" pseudo-theme. */
  themeKey: string
  colors: { bg: string; fg: string }
  active?: boolean
}

/** One theme pill, with a color swatch rendered at build time. */
export function ThemePill({
  themeKey,
  colors,
  active = false,
}: ThemePillProps) {
  const isDark = parseInt(colors.bg.replace('#', '').slice(0, 2), 16) < 0x80
  const shadow = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
  const label =
    themeKey === '' ? 'Default' : (THEME_LABELS[themeKey] ?? themeKey)
  const description = THEME_DESCRIPTIONS[themeKey]
  return (
    <button
      className={`theme-pill shadow-minimal${active ? ' active' : ''}`}
      data-theme={themeKey}
      title={description}
    >
      <span
        className="theme-swatch"
        style={{
          background: colors.bg,
          boxShadow: `inset 0 0 0 1px ${shadow}`,
        }}
      />
      {label}
    </button>
  )
}

export interface ThemePickerProps {
  /**
   * Prepends the "Default" pseudo-theme pill (empty key, always rendered
   * active) ahead of the real themes.
   */
  includeDefault: boolean
  /**
   * Marks a real-theme pill active instead -- only takes effect when
   * `includeDefault` is false, or when `activeThemeKey` isn't the empty
   * string the Default pill already occupies, since the Default pill's own
   * active state doesn't consult it.
   */
  activeThemeKey?: string
}

/** The theme picker: a few pills inline, every theme in a dropdown. */
export function ThemePicker({
  includeDefault,
  activeThemeKey,
}: ThemePickerProps) {
  const themeEntries = Object.entries(THEMES)
  const defaultPill = includeDefault ? (
    <ThemePill key="" themeKey="" colors={DEFAULT_SWATCH} active />
  ) : null

  const pill = ([themeKey, colors]: [string, { bg: string; fg: string }]) => (
    <ThemePill
      key={themeKey}
      themeKey={themeKey}
      colors={colors}
      active={themeKey === activeThemeKey}
    />
  )

  const inlinePills = themeEntries
    .filter(([themeKey]) => INLINE_THEMES.has(themeKey))
    .map(pill)
  const dropdownPills = themeEntries.map(pill)
  const dropdownCount = dropdownPills.length + (includeDefault ? 1 : 0)

  return (
    <>
      <div className="theme-pills-inline">
        {defaultPill}
        {inlinePills}
      </div>
      <div className="theme-more-wrapper">
        <button
          className="theme-pill shadow-minimal"
          id="theme-more-btn"
          aria-label="More themes"
          aria-haspopup="true"
          aria-controls="theme-more-dropdown"
          aria-expanded="false"
        >
          {dropdownCount} Themes
        </button>
        <div
          className="theme-more-dropdown shadow-modal-small"
          id="theme-more-dropdown"
        >
          {defaultPill}
          {dropdownPills}
        </div>
      </div>
    </>
  )
}
