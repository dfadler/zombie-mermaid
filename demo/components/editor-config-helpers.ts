/**
 * Pure, stateless helpers for the editor's config surface -- colors, fonts,
 * padding/stroke, and the merged render config -- split out of
 * `editor-config.tsx` (zombie-mermaid#935's audit) so the color/font popup
 * and field components that need these constants can import them without a
 * circular dependency on the component that composes them (`ConfigPanel`,
 * still in `editor-config.tsx`). No JSX, no React state: everything here is
 * a plain function or constant, safe to import from a test file or another
 * component with no risk of pulling in `ConfigPanel`'s own local-state
 * surface.
 *
 * All of this was moved verbatim (behavior unchanged) from
 * `editor-config.tsx` -- see that file's header comment for the original
 * `editor/js/config-panel.ts`/`color-picker.ts`/`font-picker.ts` provenance
 * of each piece.
 */

/* -----------------------------------------------------------------
 * Colors
 * ----------------------------------------------------------------- */

/** The six overridable color slots -- matches `editor/js/config-panel.ts`'s `cfgColors` keys exactly. */
export type ColorKey = 'bg' | 'fg' | 'accent' | 'line' | 'muted' | 'surface'

export const COLOR_KEYS: readonly ColorKey[] = [
  'bg',
  'fg',
  'accent',
  'line',
  'muted',
  'surface',
]

/** Human labels for each key -- moved verbatim from `editor/js/color-picker.ts`'s `openColorPopup()`. */
export const COLOR_LABELS: Record<ColorKey, string> = {
  bg: 'Background',
  fg: 'Foreground',
  accent: 'Accent',
  line: 'Line',
  muted: 'Muted',
  surface: 'Surface',
}

/** Moved verbatim from `editor/js/config-panel.ts` (deleted by #808). */
export const COLOR_PRESETS: readonly string[] = [
  '#ffffff',
  '#f5f5f5',
  '#e0e0e0',
  '#bdbdbd',
  '#9e9e9e',
  '#757575',
  '#424242',
  '#212121',
  '#000000',
  '#f44336',
  '#e91e63',
  '#ff4081',
  '#ff1744',
  '#d50000',
  '#9c27b0',
  '#673ab7',
  '#3f51b5',
  '#7c4dff',
  '#aa00ff',
  '#2196f3',
  '#03a9f4',
  '#00bcd4',
  '#1565c0',
  '#2979ff',
  '#0091ea',
  '#4caf50',
  '#8bc34a',
  '#009688',
  '#00e676',
  '#1b5e20',
  '#ffeb3b',
  '#ffc107',
  '#ff9800',
  '#ff5722',
  '#ff6d00',
  '#0f1117',
  '#161b22',
  '#1c2128',
  '#0d1117',
  '#1a1a2e',
  '#16213e',
]

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value)
}

/** The color-per-theme shape `window.__mermaid.THEMES` entries have (mirrors `editor/js/global.d.ts`'s `EditorMermaidTheme`, duplicated for the same "separate tsc program" reason that file documents). */
export interface EditorThemeColors {
  bg: string
  fg: string
  line?: string
  accent?: string
  muted?: string
  surface?: string
  border?: string
}

const THEME_COLOR_MAP: Record<ColorKey, keyof EditorThemeColors> = {
  bg: 'bg',
  fg: 'fg',
  accent: 'accent',
  line: 'line',
  muted: 'muted',
  surface: 'surface',
}

/**
 * Moved from `editor/js/config-panel.ts`'s `getThemeColor()`. `themes` is
 * `window.__mermaid.THEMES` (undefined under SSR/before the renderer bundle
 * has loaded) and `themeKey` is the *effective* current theme -- see
 * `editor-config.tsx`'s header comment on why that isn't simply
 * `window.__themeState.getTheme()`.
 */
export function getEffectiveThemeColor(
  themes: Record<string, EditorThemeColors> | undefined,
  themeKey: string,
  key: ColorKey,
): string | null {
  const theme = themeKey ? themes?.[themeKey] : undefined
  if (!theme) return null
  return theme[THEME_COLOR_MAP[key]] || null
}

/* -----------------------------------------------------------------
 * Fonts
 * ----------------------------------------------------------------- */

export interface PresetFont {
  name: string
  value: string
  group: string
}

/** Moved verbatim from `editor/js/font-picker.ts` (deleted by #808). */
export const PRESET_FONTS: readonly PresetFont[] = [
  { name: 'Inter', value: 'Inter', group: 'Sans-serif' },
  { name: 'Geist', value: 'Geist', group: 'Sans-serif' },
  { name: 'Roboto', value: 'Roboto', group: 'Sans-serif' },
  { name: 'Open Sans', value: 'Open Sans', group: 'Sans-serif' },
  { name: 'Lato', value: 'Lato', group: 'Sans-serif' },
  { name: 'Poppins', value: 'Poppins', group: 'Sans-serif' },
  { name: 'Nunito', value: 'Nunito', group: 'Sans-serif' },
  { name: 'DM Sans', value: 'DM Sans', group: 'Sans-serif' },
  { name: 'Space Grotesk', value: 'Space Grotesk', group: 'Sans-serif' },
  { name: 'Arial', value: 'Arial', group: 'System' },
  { name: 'Georgia', value: 'Georgia', group: 'Serif' },
  { name: 'Merriweather', value: 'Merriweather', group: 'Serif' },
  { name: 'Playfair Display', value: 'Playfair Display', group: 'Serif' },
  { name: 'JetBrains Mono', value: 'JetBrains Mono', group: 'Monospace' },
  { name: 'Fira Code', value: 'Fira Code', group: 'Monospace' },
  { name: 'Source Code Pro', value: 'Source Code Pro', group: 'Monospace' },
  { name: 'Courier New', value: 'Courier New', group: 'Monospace' },
]

/** `''` (no override) displays as "Default", matching the static markup's original label. */
export function getFontDisplayLabel(font: string): string {
  if (!font) return 'Default'
  return PRESET_FONTS.find((f) => f.value === font)?.name ?? font
}

/**
 * Fonts the browser already has loaded, beyond the curated preset list --
 * moved from `editor/js/font-picker.ts`'s `buildFontList()`. Guarded the
 * same way that file was: `document.fonts` isn't guaranteed to exist in
 * every environment (also false under SSR, where `document` itself doesn't
 * exist -- callers must only invoke this client-side).
 */
export function getBrowserLoadedFontNames(query: string): string[] {
  const q = query.toLowerCase()
  let names: string[] = []
  try {
    document.fonts.forEach((ff) => {
      const n = ff.family.replace(/['"]/g, '')
      if (!q || n.toLowerCase().includes(q)) names.push(n)
    })
    names = [...new Set(names)].sort()
  } catch {
    // document.fonts isn't guaranteed to exist in every environment.
  }
  return names
}

/* -----------------------------------------------------------------
 * Padding / stroke / merged config
 * ----------------------------------------------------------------- */

export const PADDING_MIN = 0
export const PADDING_MAX = 120
export const DEFAULT_PADDING = 24

export function clampPadding(value: number): number {
  return Math.max(PADDING_MIN, Math.min(PADDING_MAX, Math.round(value)))
}

export const STROKE_MIN = 0.25
export const STROKE_MAX = 6
export const STROKE_STEP = 0.25
export const DEFAULT_STROKE = 1

/** Mirrors `editor/js/config-panel.ts`'s `makeStrokeSetter()`'s clamp + quarter-step rounding. */
export function clampStroke(value: number): number {
  const clamped = Math.max(STROKE_MIN, Math.min(STROKE_MAX, value))
  return Math.round(clamped * 4) / 4
}

/**
 * Moved from `editor/js/config-panel.ts`'s `readConfig()` -- only
 * overridden fields are included, so an unmodified color/font/padding
 * falls through to the active theme's own value in
 * `editor/js/rendering.ts`'s `buildOptions()` (which merges the theme's
 * colors first, then `Object.assign`s this on top -- config always wins).
 */
export function computeConfig(
  colors: Record<ColorKey, string>,
  font: string,
  padding: number,
): Record<string, unknown> {
  const cfg: Record<string, unknown> = {}
  for (const key of COLOR_KEYS) {
    if (colors[key]) cfg[key] = colors[key]
  }
  if (font) cfg.font = font
  if (padding !== DEFAULT_PADDING) cfg.padding = padding
  return cfg
}

/**
 * Moved verbatim (minus the module-level `cfgEdgeStroke`/`cfgNodeStroke`
 * reads, now parameters) from `editor/js/config-panel.ts`'s
 * `applyStrokeOverrides()`.
 */
export function applyStrokeOverridesToSvg(
  svgEl: SVGSVGElement | null,
  edgeStroke: number,
  nodeStroke: number,
): void {
  if (!svgEl) return
  const defsEl = svgEl.querySelector('defs')

  function inDefs(el: Element): boolean {
    return !!defsEl && defsEl.contains(el)
  }

  if (edgeStroke !== DEFAULT_STROKE) {
    const ew = String(edgeStroke)
    svgEl
      .querySelectorAll('line, path[fill="none"], polyline[fill="none"]')
      .forEach((el) => {
        if (!inDefs(el)) el.setAttribute('stroke-width', ew)
      })
    const arrowFactor = Math.sqrt(edgeStroke)
    svgEl.querySelectorAll('defs marker').forEach((marker) => {
      const origW = parseFloat(marker.getAttribute('markerWidth') || '8')
      const origH = parseFloat(marker.getAttribute('markerHeight') || '5')
      marker.setAttribute('viewBox', '0 0 ' + origW + ' ' + origH)
      marker.setAttribute('markerUnits', 'userSpaceOnUse')
      marker.setAttribute('markerWidth', String(origW * arrowFactor))
      marker.setAttribute('markerHeight', String(origH * arrowFactor))
    })
  }

  if (nodeStroke !== DEFAULT_STROKE) {
    const nw = String(nodeStroke)
    svgEl.querySelectorAll('rect, ellipse, circle, polygon').forEach((el) => {
      if (!inDefs(el)) el.setAttribute('stroke-width', nw)
    })
  }
}

/* -----------------------------------------------------------------
 * Shared popup-position shape
 * ----------------------------------------------------------------- */

/** The `{left, top}` px position of a floating popup -- shared by the color and font popups (`editor-color-popup.tsx`/`editor-font-popup.tsx`), each of which computes its own via a different position formula. */
export interface PopupPosition {
  left: number
  top: number
}
