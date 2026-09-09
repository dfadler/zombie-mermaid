import { closest, requireElement } from './dom.ts'
import { editor, previewInner } from './elements.ts'
import { updateHash } from './sharing.ts'
import { showToast } from './toast.ts'

let exportScale = 4
const exportDropdown = requireElement('export-dropdown', HTMLElement)

function toggleExportDropdown(e: Event): void {
  e.stopPropagation()
  exportDropdown.classList.toggle('open')
}
requireElement('export-chevron-btn', HTMLElement).addEventListener(
  'click',
  toggleExportDropdown,
)
requireElement('export-main-btn', HTMLElement).addEventListener(
  'click',
  function () {
    exportPNG()
  },
)

document.addEventListener('click', function (e) {
  if (!closest(e.target, '#export-wrap'))
    exportDropdown.classList.remove('open')
})

requireElement('size-pills', HTMLElement).addEventListener(
  'click',
  function (e) {
    const pill = closest(e.target, '.size-pill')
    if (!pill || !(pill instanceof HTMLElement)) return
    exportScale = parseInt(pill.dataset.scale || '', 10)
    document.querySelectorAll<HTMLElement>('.size-pill').forEach(function (p) {
      p.classList.remove('active')
    })
    pill.classList.add('active')
  },
)

function getSvgEl(): SVGSVGElement | null {
  const el = previewInner.querySelector<SVGSVGElement>('svg')
  if (!el) {
    showToast('Render a diagram first.')
    return null
  }
  return el
}

function svgToPngBlob(
  svgEl: SVGSVGElement,
  scale: number,
  cb: BlobCallback,
): void {
  const serialized = new XMLSerializer().serializeToString(svgEl)
  const svgBlob = new Blob([serialized], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(svgBlob)
  const img = new Image()
  img.onload = function () {
    const canvas = document.createElement('canvas')
    const w = img.naturalWidth || svgEl.viewBox.baseVal.width || 800
    const h = img.naturalHeight || svgEl.viewBox.baseVal.height || 600
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      URL.revokeObjectURL(url)
      return
    }
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    canvas.toBlob(cb, 'image/png')
  }
  img.onerror = function () {
    URL.revokeObjectURL(url)
    showToast('PNG export failed.')
  }
  img.src = url
}

function exportPNG(): void {
  const svgEl = getSvgEl()
  if (!svgEl) return
  svgToPngBlob(svgEl, exportScale, function (blob) {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'diagram.png'
    a.click()
    URL.revokeObjectURL(url)
    showToast('PNG saved (' + exportScale + 'x)')
    exportDropdown.classList.remove('open')
  })
}

function exportSVG(): void {
  const svgEl = getSvgEl()
  if (!svgEl) return
  const data = new XMLSerializer().serializeToString(svgEl)
  const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'diagram.svg'
  a.click()
  URL.revokeObjectURL(url)
  showToast('SVG saved!')
  exportDropdown.classList.remove('open')
}

function copyImage(): void {
  const svgEl = getSvgEl()
  if (!svgEl) return
  svgToPngBlob(svgEl, exportScale, function (blob) {
    if (!blob) return
    try {
      navigator.clipboard
        .write([new ClipboardItem({ 'image/png': blob })])
        .then(function () {
          showToast('Image copied to clipboard!')
          exportDropdown.classList.remove('open')
        })
    } catch {
      showToast('Copy not supported in this browser.')
    }
  })
}

function copyURL(): void {
  updateHash()
  navigator.clipboard.writeText(window.location.href).then(function () {
    showToast('URL copied to clipboard!')
    exportDropdown.classList.remove('open')
  })
}

requireElement('export-png-btn', HTMLElement).addEventListener(
  'click',
  exportPNG,
)
requireElement('export-svg-btn', HTMLElement).addEventListener(
  'click',
  exportSVG,
)
requireElement('copy-image-btn', HTMLElement).addEventListener(
  'click',
  copyImage,
)
requireElement('copy-link-btn', HTMLElement).addEventListener('click', copyURL)

document.addEventListener('keydown', function (e) {
  if (e.target === editor) return
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 's') {
    e.preventDefault()
    exportPNG()
  }
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') {
    e.preventDefault()
    exportSVG()
  }
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'c') {
    e.preventDefault()
    copyImage()
  }
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
    e.preventDefault()
    copyURL()
  }
})
