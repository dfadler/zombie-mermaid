import {
  cfgColors,
  COLOR_PRESETS,
  readConfig,
  updateColorUI,
} from './config-panel.ts'
import { closest, requireElement } from './dom.ts'
import { scheduleRender } from './rendering.ts'

const colorPopup = requireElement('color-popup', HTMLElement)
const colorNative = requireElement('color-native-input', HTMLInputElement)
const colorHexInput = requireElement('color-hex-input', HTMLInputElement)
let activeColorKey: string | null = null

const paletteEl = requireElement('color-palette', HTMLElement)
COLOR_PRESETS.forEach(function (hex) {
  const btn = document.createElement('button')
  btn.className = 'color-swatch-btn'
  btn.style.background = hex
  btn.title = hex
  btn.addEventListener('click', function () {
    setActiveColor(hex)
  })
  paletteEl.appendChild(btn)
})

function openColorPopup(key: string, anchorEl: Element): void {
  activeColorKey = key
  const labels: Record<string, string> = {
    bg: 'Background',
    fg: 'Foreground',
    accent: 'Accent',
    line: 'Line',
    muted: 'Muted',
    surface: 'Surface',
  }
  requireElement('color-popup-title', HTMLElement).textContent =
    labels[key] || key

  const val = cfgColors[key] || '#ffffff'
  colorHexInput.value = cfgColors[key] || ''
  if (/^#[0-9a-fA-F]{6}$/.test(val)) colorNative.value = val

  const rect = anchorEl.getBoundingClientRect()
  const popup = colorPopup
  popup.classList.add('open')
  const pw = 240
  let left = rect.right - pw
  if (left < 8) left = 8
  let top = rect.bottom + 6
  if (top + 400 > window.innerHeight) top = rect.top - 406
  popup.style.left = left + 'px'
  popup.style.top = top + 'px'
}

function setActiveColor(hex: string): void {
  if (!activeColorKey) return
  cfgColors[activeColorKey] = hex
  colorHexInput.value = hex
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) colorNative.value = hex
  updateColorUI(activeColorKey)
  readConfig()
  scheduleRender(200)
}

function closeColorPopup(): void {
  colorPopup.classList.remove('open')
  activeColorKey = null
}

document
  .querySelectorAll<HTMLElement>('.color-edit-btn')
  .forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation()
      const key = btn.dataset.cfg
      if (!key) return
      if (colorPopup.classList.contains('open') && activeColorKey === key) {
        closeColorPopup()
        return
      }
      openColorPopup(key, btn)
    })
  })

requireElement('color-popup-close', HTMLElement).addEventListener(
  'click',
  closeColorPopup,
)

requireElement('color-clear-btn', HTMLElement).addEventListener(
  'click',
  function () {
    if (!activeColorKey) return
    cfgColors[activeColorKey] = ''
    colorHexInput.value = ''
    updateColorUI(activeColorKey)
    readConfig()
    scheduleRender(200)
  },
)

colorNative.addEventListener('input', function () {
  setActiveColor(colorNative.value)
})

colorHexInput.addEventListener('input', function () {
  let val = colorHexInput.value.trim()
  if (!val.startsWith('#')) val = '#' + val
  if (/^#[0-9a-fA-F]{6}$/.test(val) && activeColorKey) {
    colorNative.value = val
    cfgColors[activeColorKey] = val
    updateColorUI(activeColorKey)
    readConfig()
    scheduleRender(400)
  }
})

document.addEventListener('click', function (e) {
  if (!colorPopup.classList.contains('open')) return
  if (
    !closest(e.target, '#color-popup') &&
    !closest(e.target, '.color-edit-btn')
  )
    closeColorPopup()
})
