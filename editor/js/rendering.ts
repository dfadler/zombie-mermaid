import { applyStrokeOverrides } from './config-panel.ts'
import { isDark } from './dark-mode.ts'
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
import { applyZoom } from './zoom.ts'

let renderTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleRender(delay?: number): void {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(doRender, delay ?? 300)
}

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
    // Default — reset to light/dark base
    root.style.setProperty('--t-bg', isDark ? '#18181B' : '#FFFFFF')
    root.style.setProperty('--t-fg', isDark ? '#FAFAFA' : '#27272A')
    root.style.setProperty('--t-accent', isDark ? '#60a5fa' : '#3b82f6')
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
  return Object.assign(opts, state.config)
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
    applyStrokeOverrides(svgEl)
    applyZoom(state.zoom)
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
