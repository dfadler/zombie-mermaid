import { requireElement } from './dom.ts'
import { themeMenu } from './elements.ts'
import { state, THEMES } from './state.ts'

/**
 * The theme-dropdown trigger button (top bar), split out of init.ts so
 * dark-mode.ts's applyColorMode() can update it without an import cycle:
 * applyColorMode() needs to refresh this button after a dark/light toggle,
 * and init.ts needs both applyColorMode() *and* this button's own DOM refs
 * -- a real bundler resolves a cycle by picking one module to evaluate
 * first, which does not have to match either file's own top-level
 * execution order, and this file's `var`-hoisted-but-not-yet-initialized
 * DOM refs (requireElement() runs at module-evaluation time, not
 * declaration time) broke exactly that way when this lived in init.ts
 * (zombie-mermaid#766). Giving both dark-mode.ts and init.ts a shared,
 * cycle-free dependency instead removes the ambiguity entirely.
 */
export const themeBtnLabel = requireElement('theme-btn-label', HTMLElement)
export const themeBtnSwatch = requireElement('theme-btn-swatch', HTMLElement)
export const themeDropdownBtn = requireElement(
  'theme-dropdown-btn',
  HTMLElement,
)

export function updateThemeButton(): void {
  const key = state.theme
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
  themeMenu
    .querySelectorAll<HTMLElement>('.theme-dropdown-item')
    .forEach(function (item) {
      item.classList.toggle('active', item.dataset.theme === key)
    })
}
