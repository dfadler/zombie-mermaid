import { requireElement } from './dom.ts'
import { previewInner, zoomLabel } from './elements.ts'
import { state } from './state.ts'

export function getSvgNaturalSize(svgEl: SVGSVGElement): {
  w: number
  h: number
} {
  const vb = svgEl.viewBox && svgEl.viewBox.baseVal
  if (vb && vb.width > 0 && vb.height > 0) return { w: vb.width, h: vb.height }
  const w =
    parseFloat(svgEl.getAttribute('width') || '') ||
    svgEl.getBoundingClientRect().width ||
    400
  const h =
    parseFloat(svgEl.getAttribute('height') || '') ||
    svgEl.getBoundingClientRect().height ||
    300
  return { w: w, h: h }
}

export function applyZoom(z: number): void {
  state.zoom = Math.max(0.1, Math.min(8, z))
  const svgEl = previewInner.querySelector<SVGSVGElement>('svg')
  if (svgEl) {
    const nat = getSvgNaturalSize(svgEl)
    svgEl.style.width = nat.w * state.zoom + 'px'
    svgEl.style.height = nat.h * state.zoom + 'px'
    svgEl.style.transform = ''
  }
  zoomLabel.textContent = Math.round(state.zoom * 100) + '%'
}

requireElement('zoom-in-btn', HTMLElement).addEventListener(
  'click',
  function () {
    applyZoom(state.zoom * 1.25)
  },
)
requireElement('zoom-out-btn', HTMLElement).addEventListener(
  'click',
  function () {
    applyZoom(state.zoom / 1.25)
  },
)
requireElement('zoom-fit-btn', HTMLElement).addEventListener(
  'click',
  function () {
    applyZoom(1)
  },
)
