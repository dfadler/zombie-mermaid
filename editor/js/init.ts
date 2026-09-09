import { refreshAllColorUIs } from './config-panel.ts'
// zombie-mermaid#809: applyColorMode/isDark moved out of dark-mode.ts (now
// React state, demo/components/editor-dark-mode.ts) -- this file no longer
// needs either. setDiagramThemeIsAuto stays a dark-mode.ts export (it's
// still the diagram-auto-theme flag's only writer besides that module
// itself); see this file's applyTheme()/hashSource uses below.
import { setDiagramThemeIsAuto } from './dark-mode.ts'
import { closest, requireElement } from './dom.ts'
import { updateLineNumbers } from './editor-helpers.ts'
import { editor, themeMenu } from './elements.ts'
import { applyThemeToPage, scheduleRender } from './rendering.ts'
import { getHashSource } from './sharing.ts'
import { state, THEMES } from './state.ts'
// Theme dropdown button + updateThemeButton() live in their own module so
// dark-mode.ts can also reach updateThemeButton() without an init.ts <->
// dark-mode.ts import cycle -- see theme-button.ts's header comment.
import { themeDropdownBtn, updateThemeButton } from './theme-button.ts'

// #688: applyTheme() is this file's own re-theming — everything setting
// `key` here previously did directly, now split so it can also run as a
// window.__themeState.subscribe() listener (see below), the same shape
// demo/diagram-type-client.tsx's #687 reconciliation uses. setTheme() (the
// click handler below calls this, not applyTheme() directly) only persists
// + notifies through the shared demo/theme-state.ts module; applyTheme()
// is what actually updates this page for a theme change from *any* source
// — a click here, or a theme picked on another tab/page entirely.
function applyTheme(key: string): void {
  state.theme = key
  setDiagramThemeIsAuto(false)
  applyThemeToPage(key)
  updateThemeButton()
  refreshAllColorUIs()
  scheduleRender(0)
}

function setTheme(key: string): void {
  window.__themeState.setTheme(key)
}

// Toggle dropdown
themeDropdownBtn.addEventListener('click', function (e) {
  e.stopPropagation()
  const isOpen = themeMenu.classList.toggle('open')
  themeDropdownBtn.classList.toggle('open', isOpen)
})

// Click item
themeMenu.addEventListener('click', function (e) {
  const item = closest(e.target, '.theme-dropdown-item')
  if (!item || !(item instanceof HTMLElement)) return
  setTheme(item.dataset.theme || '')
  themeMenu.classList.remove('open')
  themeDropdownBtn.classList.remove('open')
})

const themeDropdownWrap = requireElement('theme-dropdown-wrap', HTMLElement)

// Close on outside click
document.addEventListener('click', function (e) {
  if (!(e.target instanceof Node) || !themeDropdownWrap.contains(e.target)) {
    themeMenu.classList.remove('open')
    themeDropdownBtn.classList.remove('open')
  }
})

// Store label data for lookup
themeMenu
  .querySelectorAll<HTMLElement>('.theme-dropdown-item')
  .forEach(function (item) {
    const key = item.dataset.theme || ''
    themeDropdownBtn.setAttribute(
      'data-label-' + key,
      item.textContent?.trim() || '',
    )
  })

// zombie-mermaid#809: the initial-dark-mode bootstrap call that used to
// live here (`applyColorMode(isDark)`) moved to dark-mode.ts's own module
// top level -- that module owns `applyColorMode` now, and reaches the
// persisted preference via `window.__editorDarkModeState.getIsDark()`
// (registered by demo/editor-dark-mode-state-bridge.ts, always ready
// before this legacy bundle runs at all -- see editor-app.tsx's
// EDITOR_HYDRATED_EVENT doc comment). See dark-mode.ts's header comment.

// #688: one-time migration off the editor's own, now-retired
// 'bm-editor-theme' localStorage key onto the shared 'mermaid-theme' key
// every other page already reads/writes through window.__themeState (demo/
// theme-state.ts) -- mirrors demo/diagram-type-client.tsx's identical
// migration for its own prior per-page key (#687, zm-diagram-page-theme).
// Only migrate when the shared key has nothing stored yet, so a value
// already picked elsewhere on the site isn't clobbered by a stale editor
// preference. window.__themeState.setTheme() both persists under the
// shared key and notifies the subscribe() listener registered below, so
// this reaches applyTheme() exactly the same way a live pill click would.
const legacyEditorTheme = localStorage.getItem('bm-editor-theme')
if (
  window.__themeState.getTheme() === '' &&
  legacyEditorTheme &&
  THEMES[legacyEditorTheme]
) {
  window.__themeState.setTheme(legacyEditorTheme)
}
localStorage.removeItem('bm-editor-theme')

// Restore the shared theme preference, if any -- an empty string means "no
// preference stored" (theme-state.ts's DEFAULT_THEME_KEY), which already
// matches this page's own build-time default, so there's nothing to apply
// in that case.
const savedTheme = window.__themeState.getTheme()
if (savedTheme && THEMES[savedTheme]) {
  state.theme = savedTheme
  setDiagramThemeIsAuto(false)
}
applyThemeToPage(state.theme)
updateThemeButton()

// Cross-tab/cross-page sync: reapply whenever the shared theme changes,
// whether from this page's own pill click (setTheme() above) or a theme
// picked on another tab/page entirely. Registered once, after the initial
// restore above (which reads the current value directly) so the editor
// doesn't double-apply its own starting theme.
window.__themeState.subscribe(applyTheme)

// Load from URL hash or use default
const DEFAULT_SOURCE =
  'graph TD\n  A[Start] --> B{Decision?}\n  B -->|Yes| C[Do the thing]\n  B -->|No| D[Skip it]\n  C --> E[End]\n  D --> E'

const hashSource = getHashSource()
if (hashSource) {
  editor.value = hashSource
  // getHashSource() may have set state.theme (see sharing.ts) as a side
  // effect, but nothing had applied it yet -- a shared/linked-to theme was
  // silently ignored, leaving only the source itself loaded.
  setDiagramThemeIsAuto(false)
  applyThemeToPage(state.theme)
  updateThemeButton()
} else {
  editor.value = DEFAULT_SOURCE
}

updateLineNumbers()
scheduleRender(0)
