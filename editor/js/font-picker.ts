import { readConfig } from './config-panel.ts'
import { closest, requireElement } from './dom.ts'
import { scheduleRender } from './rendering.ts'

/**
 * Owned here (not config-panel.ts, despite `readConfig()` there reading
 * both) because this is the only module that ever reassigns them --
 * config-panel.ts imports them back read-only. An ES module can't assign
 * an imported binding from outside its owning module, so whichever file
 * mutates a piece of cross-file state has to be the one that declares it.
 */
export let cfgFont = ''
export let cfgPadding = 24

interface PresetFont {
  name: string
  value: string
  group: string
}

const PRESET_FONTS: PresetFont[] = [
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

const fontPopup = requireElement('font-popup', HTMLElement)
const fontSearch = requireElement('font-search', HTMLInputElement)
const fontList = requireElement('font-list', HTMLElement)
const fontSelectBtn = requireElement('font-select-btn', HTMLElement)
const fontSelectLabel = requireElement('font-select-label', HTMLElement)

function buildFontList(query: string): void {
  const q = (query || '').toLowerCase()
  const filtered = PRESET_FONTS.filter(function (f) {
    return (
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.value.toLowerCase().includes(q)
    )
  })

  const groups: Record<string, PresetFont[]> = {}
  filtered.forEach(function (f) {
    if (!groups[f.group]) groups[f.group] = []
    groups[f.group]!.push(f)
  })

  fontList.innerHTML = ''

  let browserFonts: string[] = []
  try {
    document.fonts.forEach(function (ff) {
      const n = ff.family.replace(/['"]/g, '')
      if (!q || n.toLowerCase().includes(q)) browserFonts.push(n)
    })
    browserFonts = [...new Set(browserFonts)].sort()
  } catch {
    // document.fonts isn't guaranteed to exist in every environment
  }

  Object.keys(groups).forEach(function (group) {
    const label = document.createElement('div')
    label.className = 'font-section-label'
    label.textContent = group
    fontList.appendChild(label)
    groups[group]!.forEach(function (f) {
      appendFontItem(f.name, f.value)
    })
  })

  if (browserFonts.length) {
    const label = document.createElement('div')
    label.className = 'font-section-label'
    label.textContent = 'Loaded in browser'
    fontList.appendChild(label)
    browserFonts.forEach(function (name) {
      appendFontItem(name, name)
    })
  }
}

function appendFontItem(name: string, value: string): void {
  const item = document.createElement('div')
  item.className = 'font-item' + (cfgFont === value ? ' active' : '')
  const previewSpan = document.createElement('span')
  previewSpan.className = 'font-item-preview'
  previewSpan.style.fontFamily = value + ', sans-serif'
  previewSpan.textContent = 'Aa'
  const nameSpan = document.createElement('span')
  nameSpan.className = 'font-item-name'
  nameSpan.textContent = name
  item.appendChild(previewSpan)
  item.appendChild(nameSpan)
  item.addEventListener('click', function () {
    cfgFont = value
    fontSelectLabel.textContent = name
    closeFontPopup()
    readConfig()
    scheduleRender(0)
  })
  fontList.appendChild(item)
}

function openFontPopup(): void {
  buildFontList('')
  fontSearch.value = ''
  const rect = fontSelectBtn.getBoundingClientRect()
  const top = rect.bottom + 6
  let left = rect.right - 220
  if (left < 8) left = 8
  fontPopup.style.top = top + 'px'
  fontPopup.style.left = left + 'px'
  fontPopup.classList.add('open')
  fontSearch.focus()
}

function closeFontPopup(): void {
  fontPopup.classList.remove('open')
}

fontSelectBtn.addEventListener('click', function (e) {
  e.stopPropagation()
  if (fontPopup.classList.contains('open')) {
    closeFontPopup()
    return
  }
  openFontPopup()
})

fontSearch.addEventListener('input', function () {
  buildFontList(fontSearch.value)
})

document.addEventListener('click', function (e) {
  if (!fontPopup.classList.contains('open')) return
  if (
    !closest(e.target, '#font-popup') &&
    !closest(e.target, '#font-select-btn')
  )
    closeFontPopup()
})

const paddingNum = requireElement('cfg-padding', HTMLInputElement)
const paddingSlider = requireElement('cfg-padding-slider', HTMLInputElement)

function setPadding(val: string | number): void {
  const parsed = Math.max(0, Math.min(120, parseInt(String(val), 10) || 0))
  cfgPadding = parsed
  paddingNum.value = String(parsed)
  paddingSlider.value = String(parsed)
  readConfig()
  scheduleRender(200)
}

paddingNum.addEventListener('input', function () {
  setPadding(paddingNum.value)
})
paddingSlider.addEventListener('input', function () {
  setPadding(paddingSlider.value)
})
