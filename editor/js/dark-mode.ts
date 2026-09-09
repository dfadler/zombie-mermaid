import { requireElement } from './dom.ts'
import { applyThemeToPage, scheduleRender } from './rendering.ts'
import { setEditorTheme, state } from './state.ts'
// Imported from theme-button.ts, not init.ts, specifically to avoid a
// dark-mode.ts <-> init.ts import cycle -- see that file's own header
// comment for why a real bundler's circular-import resolution made that
// cycle an actual runtime bug here, not just a theoretical one.
import { updateThemeButton } from './theme-button.ts'

export let isDark = localStorage.getItem('bm-editor-dark') === 'true'
const iconMoon = requireElement('icon-moon', SVGElement)
const iconSun = requireElement('icon-sun', SVGElement)

const AUTO_DARK_DIAGRAM_THEME = 'zinc-dark'
const AUTO_LIGHT_DIAGRAM_THEME = ''

let diagramThemeIsAuto = true

/** The only cross-file writer of `diagramThemeIsAuto` -- see init.ts. */
export function setDiagramThemeIsAuto(value: boolean): void {
  diagramThemeIsAuto = value
}

export function applyColorMode(dark: boolean, force?: boolean): void {
  isDark = dark
  // Toggle icon visibility
  if (dark) {
    iconMoon.style.display = 'none'
    iconSun.style.display = ''
  } else {
    iconMoon.style.display = ''
    iconSun.style.display = 'none'
  }
  localStorage.setItem('bm-editor-dark', dark ? 'true' : 'false')

  if (diagramThemeIsAuto || force) {
    const autoTheme = dark ? AUTO_DARK_DIAGRAM_THEME : AUTO_LIGHT_DIAGRAM_THEME
    setEditorTheme(autoTheme)
    diagramThemeIsAuto = true
  }
  // Update all page colors via :root inline styles
  applyThemeToPage(state.theme)
  updateThemeButton()
  // zombie-mermaid#808: no more refreshAllColorUIs() call here --
  // demo/components/editor-config.tsx's ConfigPanel now listens for
  // setEditorTheme()'s zm-editor-theme-changed event itself and re-renders
  // its own color-field placeholders reactively.
  scheduleRender(0)
}

requireElement('dark-light-btn', HTMLElement).addEventListener(
  'click',
  function () {
    applyColorMode(!isDark, true)
  },
)
