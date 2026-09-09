import {
  editor,
  previewInner,
  renderTime,
  spinner,
  statusDot,
  statusText,
} from './elements.ts'
import { escHtml } from './helpers.ts'
import { updateHash } from './sharing.ts'
import { renderMermaid, state, THEMES } from './state.ts'

let renderTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleRender(delay?: number): void {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(doRender, delay ?? 300)
}

/**
 * zombie-mermaid#808: registers `scheduleRender` on `window` for
 * `demo/components/editor-config.tsx`'s `ConfigPanel` to call -- the
 * *reverse* direction from `window.__editorConfigState`/
 * `window.__editorViewportState` above (this module is the one being
 * called into, not the caller). Colors/font/padding are React state now,
 * so picking a color/font or dragging the padding slider happens entirely
 * inside a React event handler with no access to this module's own
 * `scheduleRender` import -- `editor/js/color-picker.ts`'s/
 * `font-picker.ts`'s/`config-panel.ts`'s old handlers (deleted by #808)
 * called it directly, which is exactly what drove the "live preview
 * updates as you edit" behavior a config change needs to keep. Found via
 * live-browser verification while building #808: without this, a picked
 * color updated `window.__editorConfigState.getConfig()` and the config
 * panel's own swatch/label correctly, but the diagram preview itself never
 * re-rendered.
 *
 * Declared optional on the `demo/` side (`ConfigPanel` calls it through
 * `?.`) since, unlike the bridges above, there's no ordering guarantee the
 * other direction: a user could theoretically interact with the config
 * panel before this module (part of the legacy bundle, loaded after
 * `<EditorApp>` finishes hydrating) has registered it, however unlikely in
 * practice. See `editor/js/global.d.ts` for this program's ambient
 * declaration of the shape (`EditorRenderTriggerBridge`).
 */
window.__editorRenderTrigger = { scheduleRender }

export interface Rgb {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string | null | undefined): Rgb | null {
  if (!hex || typeof hex !== 'string') return null
  let v = hex.trim()
  if (v[0] === '#') v = v.slice(1)
  if (v.length === 3)
    v =
      v.charAt(0) +
      v.charAt(0) +
      v.charAt(1) +
      v.charAt(1) +
      v.charAt(2) +
      v.charAt(2)
  if (v.length !== 6) return null
  const n = parseInt(v, 16)
  if (isNaN(n)) return null
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function applyThemeToPage(themeKey: string): void {
  const root = document.documentElement
  const t = themeKey ? THEMES[themeKey] : undefined
  if (t) {
    root.style.setProperty('--t-bg', t.bg)
    root.style.setProperty('--t-fg', t.fg)
    root.style.setProperty('--t-accent', t.accent || '#3b82f6')
  } else {
    // Default — reset to light/dark base. zombie-mermaid#809: `isDark`
    // moved to React state (demo/components/editor-dark-mode.ts) -- reached
    // here through the window.__editorDarkModeState bridge instead of a
    // direct import, the same pattern this file already uses for zoom (see
    // doRender()'s window.__editorViewportState.applyZoom() call below).
    const dark = window.__editorDarkModeState.getIsDark()
    root.style.setProperty('--t-bg', dark ? '#18181B' : '#FFFFFF')
    root.style.setProperty('--t-fg', dark ? '#FAFAFA' : '#27272A')
    root.style.setProperty('--t-accent', dark ? '#60a5fa' : '#3b82f6')
  }
  // Update shadow RGB
  const fg = root.style.getPropertyValue('--t-fg').trim() || '#27272A'
  const rgb = hexToRgb(fg)
  if (rgb) {
    root.style.setProperty(
      '--foreground-rgb',
      rgb.r + ', ' + rgb.g + ', ' + rgb.b,
    )
    const bgRgb = hexToRgb(root.style.getPropertyValue('--t-bg').trim())
    const brightness = bgRgb
      ? (bgRgb.r * 299 + bgRgb.g * 587 + bgRgb.b * 114) / 1000
      : 255
    const dark = brightness < 140
    root.style.setProperty('--shadow-border-opacity', dark ? '0.15' : '0.08')
    root.style.setProperty('--shadow-blur-opacity', dark ? '0.12' : '0.06')
  }
}

export function buildOptions(): Record<string, unknown> {
  const opts: Record<string, unknown> = {}
  const t = state.theme ? THEMES[state.theme] : undefined
  if (t) {
    opts.bg = t.bg
    opts.fg = t.fg
    if (t.line) opts.line = t.line
    if (t.accent) opts.accent = t.accent
    if (t.muted) opts.muted = t.muted
    if (t.surface) opts.surface = t.surface
    if (t.border) opts.border = t.border
  }
  // zombie-mermaid#808: colors/font/padding overrides are now React state
  // owned by <EditorApp>'s reducer (demo/components/editor-config.tsx) --
  // editor/js/config-panel.ts (which used to own state.config) is gone, so
  // this reaches the current merged overrides through the
  // window.__editorConfigState bridge instead. See that file's header
  // comment for the full rationale.
  return Object.assign(opts, window.__editorConfigState.getConfig())
}

export async function doRender(): Promise<void> {
  const source = editor.value.trim()
  if (!source) {
    previewInner.innerHTML =
      '<div class="preview-placeholder">Start typing to render your diagram</div>'
    statusText.textContent = 'Ready'
    statusText.className = ''
    statusDot.className = 'status-dot'
    renderTime.textContent = ''
    return
  }

  spinner.classList.add('visible')
  const t0 = performance.now()

  try {
    const svg = await renderMermaid(source, buildOptions())
    const ms = (performance.now() - t0).toFixed(0)
    previewInner.innerHTML = svg
    const svgEl = previewInner.querySelector('svg')
    // zombie-mermaid#808: edge/node stroke overrides are now React state
    // too -- see buildOptions()'s comment above for the same bridge.
    window.__editorConfigState.applyStrokeOverrides(svgEl)
    // zombie-mermaid#807: zoom is now React state owned by <EditorApp>'s
    // reducer (demo/components/editor-app.tsx) -- editor/js/zoom.ts (which
    // used to own state.zoom and this reapplication) is gone, so this
    // reaches the current zoom level through the window.__editorViewportState
    // bridge instead. See demo/components/editor-viewport.ts's header
    // comment for the full rationale.
    window.__editorViewportState.applyZoom()
    statusText.textContent = 'OK'
    statusText.className = 'status-ok'
    statusDot.className = 'status-dot ok'
    renderTime.textContent = 'Rendered in ' + ms + 'ms'
    updateHash()
  } catch (err) {
    previewInner.innerHTML =
      '<div class="preview-error">' + escHtml(String(err)) + '</div>'
    statusText.textContent = 'Error'
    statusText.className = 'status-err'
    statusDot.className = 'status-dot err'
    renderTime.textContent = ''
  } finally {
    spinner.classList.remove('visible')
  }
}
