// Theme dropdown logic
var themeBtnLabel = document.getElementById('theme-btn-label')
var themeBtnSwatch = document.getElementById('theme-btn-swatch')
var themeDropdownBtn = document.getElementById('theme-dropdown-btn')

function updateThemeButton() {
  var key = state.theme
  if (key && THEMES[key]) {
    themeBtnLabel.textContent =
      themeDropdownBtn.getAttribute('data-label-' + key) || key
    themeBtnSwatch.style.background = THEMES[key].bg
    themeBtnSwatch.style.display = ''
  } else {
    themeBtnLabel.textContent = 'Default'
    themeBtnSwatch.style.background = ''
    themeBtnSwatch.style.display = 'none'
  }
  // Update active state in dropdown
  themeMenu.querySelectorAll('.theme-dropdown-item').forEach(function (item) {
    item.classList.toggle('active', item.dataset.theme === key)
  })
}

// #688: applyTheme() is this file's own re-theming — everything setting
// `key` here previously did directly, now split so it can also run as a
// window.__themeState.subscribe() listener (see below), the same shape
// demo/diagram-page-client.ts's #687 reconciliation uses. setTheme() (the
// click handler below calls this, not applyTheme() directly) only persists
// + notifies through the shared demo/theme-state.ts module; applyTheme()
// is what actually updates this page for a theme change from *any* source
// — a click here, or a theme picked on another tab/page entirely.
function applyTheme(key) {
  state.theme = key
  diagramThemeIsAuto = false
  applyThemeToPage(key)
  updateThemeButton()
  refreshAllColorUIs()
  scheduleRender(0)
}

function setTheme(key) {
  window.__themeState.setTheme(key)
}

// Toggle dropdown
themeDropdownBtn.addEventListener('click', function (e) {
  e.stopPropagation()
  var isOpen = themeMenu.classList.toggle('open')
  themeDropdownBtn.classList.toggle('open', isOpen)
})

// Click item
themeMenu.addEventListener('click', function (e) {
  var item = e.target.closest('.theme-dropdown-item')
  if (!item) return
  setTheme(item.dataset.theme || '')
  themeMenu.classList.remove('open')
  themeDropdownBtn.classList.remove('open')
})

// Close on outside click
document.addEventListener('click', function (e) {
  if (!document.getElementById('theme-dropdown-wrap').contains(e.target)) {
    themeMenu.classList.remove('open')
    themeDropdownBtn.classList.remove('open')
  }
})

// Store label data for lookup
themeMenu.querySelectorAll('.theme-dropdown-item').forEach(function (item) {
  var key = item.dataset.theme || ''
  themeDropdownBtn.setAttribute('data-label-' + key, item.textContent.trim())
})

// Apply initial dark/light mode (must happen after all DOM refs + functions are ready)
applyColorMode(isDark)

// #688: one-time migration off the editor's own, now-retired
// 'bm-editor-theme' localStorage key onto the shared 'mermaid-theme' key
// every other page already reads/writes through window.__themeState (demo/
// theme-state.ts) -- mirrors demo/diagram-page-client.ts's identical
// migration for its own prior per-page key (#687, zm-diagram-page-theme).
// Only migrate when the shared key has nothing stored yet, so a value
// already picked elsewhere on the site isn't clobbered by a stale editor
// preference. window.__themeState.setTheme() both persists under the
// shared key and notifies the subscribe() listener registered below, so
// this reaches applyTheme() exactly the same way a live pill click would.
var legacyEditorTheme = localStorage.getItem('bm-editor-theme')
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
var savedTheme = window.__themeState.getTheme()
if (savedTheme && THEMES[savedTheme]) {
  state.theme = savedTheme
  diagramThemeIsAuto = false
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
var DEFAULT_SOURCE =
  'graph TD\n  A[Start] --> B{Decision?}\n  B -->|Yes| C[Do the thing]\n  B -->|No| D[Skip it]\n  C --> E[End]\n  D --> E'

var hashSource = getHashSource()
if (hashSource) {
  editor.value = hashSource
  // getHashSource() may have set state.theme (see sharing.js) as a side
  // effect, but nothing had applied it yet -- a shared/linked-to theme was
  // silently ignored, leaving only the source itself loaded.
  diagramThemeIsAuto = false
  applyThemeToPage(state.theme)
  updateThemeButton()
} else {
  editor.value = DEFAULT_SOURCE
}

updateLineNumbers()
scheduleRender(0)
