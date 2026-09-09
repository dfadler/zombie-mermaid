import { requireElement } from './dom.ts'
import { previewInner } from './elements.ts'
// cfgFont/cfgPadding are owned by font-picker.ts (the only module that ever
// reassigns them -- see that file's own header comment) and only read here
// to build the render config; importing them for a read is fine even
// though the modules import each other back for their own reasons (see
// font-picker.ts), since neither reads the other's binding until well
// after both modules have finished their own top-level setup.
import { cfgFont, cfgPadding } from './font-picker.ts'
import { state, THEMES } from './state.ts'

export const cfgColors: Record<string, string> = {
  bg: '',
  fg: '',
  accent: '',
  line: '',
  muted: '',
  surface: '',
}

export const COLOR_PRESETS = [
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

export function readConfig(): void {
  const cfg: Record<string, unknown> = {}
  if (cfgColors.bg) cfg.bg = cfgColors.bg
  if (cfgColors.fg) cfg.fg = cfgColors.fg
  if (cfgColors.accent) cfg.accent = cfgColors.accent
  if (cfgColors.line) cfg.line = cfgColors.line
  if (cfgColors.muted) cfg.muted = cfgColors.muted
  if (cfgColors.surface) cfg.surface = cfgColors.surface
  if (cfgFont) cfg.font = cfgFont
  if (cfgPadding !== 24) cfg.padding = cfgPadding
  state.config = cfg
}

const THEME_COLOR_MAP: Record<string, keyof EditorMermaidTheme> = {
  bg: 'bg',
  fg: 'fg',
  accent: 'accent',
  line: 'line',
  muted: 'muted',
  surface: 'surface',
}

export function getThemeColor(key: string): string | null {
  const theme = state.theme ? THEMES[state.theme] : undefined
  if (!theme) return null
  const mapped = THEME_COLOR_MAP[key]
  if (!mapped) return null
  return theme[mapped] || null
}

export function updateColorUI(key: string): void {
  const override = cfgColors[key]
  const themeVal = getThemeColor(key)
  const effective = override || themeVal
  const label = document.getElementById('cfg-' + key + '-label')
  const swatch = document.getElementById('cfg-' + key + '-swatch')
  const btn = document.querySelector<HTMLElement>(
    '.color-edit-btn[data-cfg="' + key + '"]',
  )

  if (label) {
    label.textContent = override || (themeVal ? themeVal : '—')
    label.style.opacity = override ? '1' : '0.45'
  }
  if (swatch) {
    swatch.style.background = effective || 'transparent'
    swatch.style.border = effective
      ? '1px solid rgba(0,0,0,0.15)'
      : '1px dashed var(--fg3)'
    swatch.style.opacity = override ? '1' : themeVal ? '0.6' : '1'
  }
  if (btn) {
    btn.title = override
      ? 'Override: ' + override
      : themeVal
        ? 'Theme default: ' + themeVal
        : 'Not set'
  }
}

export function refreshAllColorUIs(): void {
  Object.keys(cfgColors).forEach(function (k) {
    updateColorUI(k)
  })
}

refreshAllColorUIs()

let cfgEdgeStroke = 1
let cfgNodeStroke = 1

export function applyStrokeOverrides(svgEl: SVGSVGElement | null): void {
  if (!svgEl) return
  const defsEl = svgEl.querySelector('defs')

  function inDefs(el: Element): boolean {
    return !!defsEl && defsEl.contains(el)
  }

  if (cfgEdgeStroke !== 1) {
    const ew = String(cfgEdgeStroke)
    svgEl
      .querySelectorAll('line, path[fill="none"], polyline[fill="none"]')
      .forEach(function (el) {
        if (!inDefs(el)) el.setAttribute('stroke-width', ew)
      })
    const arrowFactor = Math.sqrt(cfgEdgeStroke)
    svgEl.querySelectorAll('defs marker').forEach(function (marker) {
      const origW = parseFloat(marker.getAttribute('markerWidth') || '8')
      const origH = parseFloat(marker.getAttribute('markerHeight') || '5')
      marker.setAttribute('viewBox', '0 0 ' + origW + ' ' + origH)
      marker.setAttribute('markerUnits', 'userSpaceOnUse')
      marker.setAttribute('markerWidth', String(origW * arrowFactor))
      marker.setAttribute('markerHeight', String(origH * arrowFactor))
    })
  }

  if (cfgNodeStroke !== 1) {
    const nw = String(cfgNodeStroke)
    svgEl
      .querySelectorAll('rect, ellipse, circle, polygon')
      .forEach(function (el) {
        if (!inDefs(el)) el.setAttribute('stroke-width', nw)
      })
  }
}

function makeStrokeSetter(
  numEl: HTMLInputElement,
  sliderEl: HTMLInputElement,
  getVal: () => number,
  setVal: (v: number) => void,
): (raw: string) => void {
  return function (raw: string) {
    let v = Math.max(0.25, Math.min(6, parseFloat(raw) || 1))
    v = Math.round(v * 4) / 4
    setVal(v)
    numEl.value = String(v)
    sliderEl.value = String(v)
    const svgEl = previewInner.querySelector<SVGSVGElement>('svg')
    if (svgEl) applyStrokeOverrides(svgEl)
  }
}

const edgeStrokeNum = requireElement('cfg-edge-stroke', HTMLInputElement)
const edgeStrokeSlider = requireElement(
  'cfg-edge-stroke-slider',
  HTMLInputElement,
)
const nodeStrokeNum = requireElement('cfg-node-stroke', HTMLInputElement)
const nodeStrokeSlider = requireElement(
  'cfg-node-stroke-slider',
  HTMLInputElement,
)

const setEdgeStroke = makeStrokeSetter(
  edgeStrokeNum,
  edgeStrokeSlider,
  function () {
    return cfgEdgeStroke
  },
  function (v) {
    cfgEdgeStroke = v
  },
)
const setNodeStroke = makeStrokeSetter(
  nodeStrokeNum,
  nodeStrokeSlider,
  function () {
    return cfgNodeStroke
  },
  function (v) {
    cfgNodeStroke = v
  },
)

edgeStrokeNum.addEventListener('input', function () {
  setEdgeStroke(edgeStrokeNum.value)
})
edgeStrokeSlider.addEventListener('input', function () {
  setEdgeStroke(edgeStrokeSlider.value)
})
nodeStrokeNum.addEventListener('input', function () {
  setNodeStroke(nodeStrokeNum.value)
})
nodeStrokeSlider.addEventListener('input', function () {
  setNodeStroke(nodeStrokeSlider.value)
})
