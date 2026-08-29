/**
 * Shared DOM plumbing for the visual regression suite: injects the demo's
 * real stylesheet once per browser tab (so `.svg-panel`/`.terminal-window`
 * etc. render pixel-identical to the live gallery, with zero risk of the
 * test's own copy drifting from it) and mounts/unmounts a sample's output
 * into a panel so every screenshot is framed consistently.
 */
// @ts-expect-error -- `?raw` is a Vite/Vitest import-query convention with
// no ambient type; the string it resolves to is CSS, not a type worth
// declaring project-wide for one file.
import demoStylesheet from '../../../demo/styles.css?raw'

/**
 * Cap on how wide a panel screenshot grows. Panels shrink-wrap to their
 * content (`width: fit-content`) so a screenshot is exactly the rendered
 * diagram/terminal, not padded with whatever blank space is left in an
 * arbitrary fixed-width box — this cap only guards against an unusually
 * wide diagram ballooning the image.
 */
const PANEL_MAX_WIDTH = '960px'

let stylesInjected = false

function ensureStylesInjected(): void {
  if (stylesInjected) return
  const style = document.createElement('style')
  style.textContent = demoStylesheet as string
  document.head.appendChild(style)
  stylesInjected = true
}

/**
 * Mount an SVG sample's rendered markup inside the demo's `.svg-panel` /
 * `.svg-container` chrome, matching how the live gallery frames it
 * (including the sample's own background, for samples rendered transparent).
 */
export function mountSvgPanel(svg: string, bg?: string): HTMLElement {
  ensureStylesInjected()
  const panel = document.createElement('div')
  panel.className = 'svg-panel'
  panel.style.width = 'fit-content'
  panel.style.maxWidth = PANEL_MAX_WIDTH
  if (bg) panel.style.background = bg
  const container = document.createElement('div')
  container.className = 'svg-container'
  container.innerHTML = svg
  panel.appendChild(container)
  document.body.appendChild(panel)
  return panel
}

/** Mount a pre-built terminal-window element inside the demo's `.ascii-panel` chrome. */
export function mountAsciiPanel(terminalWindow: HTMLElement): HTMLElement {
  ensureStylesInjected()
  const panel = document.createElement('div')
  panel.className = 'ascii-panel'
  panel.style.width = 'fit-content'
  panel.style.maxWidth = PANEL_MAX_WIDTH
  panel.appendChild(terminalWindow)
  document.body.appendChild(panel)
  return panel
}

/** Remove a mounted panel so consecutive tests in the same tab don't stack up. */
export function unmount(panel: HTMLElement): void {
  panel.remove()
}
