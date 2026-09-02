/**
 * Shared DOM plumbing for the visual regression suite: injects the demo's
 * real stylesheet once per browser tab (so `.svg-panel`/`.terminal-window`
 * etc. render pixel-identical to the live gallery, with zero risk of the
 * test's own copy drifting from it) and mounts/unmounts a sample's output
 * into a panel so every screenshot is framed consistently.
 */
// @ts-expect-error -- this file is only ever consumed by the esbuild bundle
// build-harness.ts produces, which loads .css as the `text` loader (raw file
// contents as a JS string) — not a type worth declaring project-wide for
// one file.
import demoStylesheet from '../../../demo/styles.css'

/**
 * Cap on how wide a panel screenshot grows. Panels shrink-wrap to their
 * content (`width: fit-content`) so a screenshot is exactly the rendered
 * diagram/terminal, not padded with whatever blank space is left in an
 * arbitrary fixed-width box — this cap only guards against an unusually
 * wide diagram ballooning the image.
 */
const PANEL_MAX_WIDTH = '960px'

/**
 * Cap on how long to wait for a mounted panel's web fonts (Inter, embedded
 * per-SVG by renderMermaidSVG; JetBrains Mono, from the injected demo
 * stylesheet) before screenshotting anyway.
 *
 * A screenshot taken while a web font is still loading captures the
 * fallback font mid-swap, which is exactly the kind of instability
 * `toMatchScreenshot()`'s stability detection keeps retrying against — on
 * a CI runner with a slow/blocked path to the Google Fonts CDN, every
 * single test in the file would otherwise burn its whole per-test timeout
 * retrying a page that never stabilizes. Capped, not awaited unconditionally,
 * so a fully broken network still produces a (fallback-font) screenshot
 * once, rather than hanging until Vitest's test timeout kills every test.
 */
const FONT_WAIT_TIMEOUT_MS = 8000

let stylesInjected = false

function ensureStylesInjected(): void {
  if (stylesInjected) return
  const style = document.createElement('style')
  style.textContent = demoStylesheet as string
  document.head.appendChild(style)
  stylesInjected = true
}

/**
 * `document.fonts.ready` only reflects fonts the browser currently
 * considers "needed" by the DOM as laid out *right now* — it does not
 * re-resolve for fonts a later DOM insertion requires. So this must be
 * called after the panel's content is in the document, not before: called
 * too early (e.g. right after injecting the stylesheet but before the SVG
 * or terminal content that actually uses those font-family rules is
 * mounted), it can resolve before the relevant font has even started
 * loading, silently defeating the wait it's supposed to provide.
 */
async function waitForFonts(): Promise<void> {
  await Promise.race([
    document.fonts.ready.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, FONT_WAIT_TIMEOUT_MS)),
  ])
}

/**
 * Wrap a view panel (`.svg-panel` or `.ascii-panel`) in the demo's
 * `.output-panel > .output-stage` shell and mark it `.is-active` — since
 * index.ts#generateHtml, both view panels are only ever visible via that
 * class (see demo/styles.css's `.svg-panel.is-active`/`.ascii-panel.is-active`
 * rules and demo/client.ts's toggle handler, which is what applies it for a
 * real page load). Mounting a panel standalone under `<body>` without this
 * wrapper leaves it `display: none` and the screenshot locator times out
 * waiting for an element that can never become visible.
 */
function wrapInOutputPanel(panel: HTMLElement, ascii: boolean): HTMLElement {
  const outputPanel = document.createElement('div')
  outputPanel.className = ascii ? 'output-panel ascii-active' : 'output-panel'
  const stage = document.createElement('div')
  stage.className = 'output-stage'
  stage.appendChild(panel)
  outputPanel.appendChild(stage)
  return outputPanel
}

/**
 * Mount an SVG sample's rendered markup inside the demo's `.svg-panel` /
 * `.svg-container` chrome, matching how the live gallery frames it
 * (including the sample's own background, for samples rendered transparent).
 */
export async function mountSvgPanel(
  svg: string,
  bg?: string,
): Promise<HTMLElement> {
  ensureStylesInjected()
  const panel = document.createElement('div')
  panel.className = 'svg-panel is-active'
  panel.style.width = 'fit-content'
  panel.style.maxWidth = PANEL_MAX_WIDTH
  if (bg) panel.style.background = bg
  const container = document.createElement('div')
  container.className = 'svg-container'
  container.innerHTML = svg
  panel.appendChild(container)
  document.body.appendChild(wrapInOutputPanel(panel, false))
  await waitForFonts()
  return panel
}

/** Mount a pre-built terminal-window element inside the demo's `.ascii-panel` chrome. */
export async function mountAsciiPanel(
  terminalWindow: HTMLElement,
): Promise<HTMLElement> {
  ensureStylesInjected()
  const panel = document.createElement('div')
  panel.className = 'ascii-panel is-active'
  panel.style.width = 'fit-content'
  panel.style.maxWidth = PANEL_MAX_WIDTH
  panel.appendChild(terminalWindow)
  document.body.appendChild(wrapInOutputPanel(panel, true))
  await waitForFonts()
  return panel
}

/**
 * Mount a minimal `.sidebar` nav containing one open `.sidebar-group` and a
 * `.sidebar-list` of links, matching the real markup
 * index.ts#renderSidebar produces. Used by sidebar-focus.visual.test.ts to
 * catch the shared focus-visible ring (demo/styles.css's `a:focus-visible`,
 * zombie-mermaid#283/#316) regressing back to being clipped by
 * `.sidebar-list li` (zombie-mermaid#325) — a purely visual pixel-clipping
 * effect that no non-visual test can see.
 */
export async function mountSidebarList(titles: string[]): Promise<HTMLElement> {
  ensureStylesInjected()
  const nav = document.createElement('nav')
  nav.className = 'sidebar'
  // The real `.sidebar` sets height: calc(100vh - var(--nav-height)) so it
  // fills the viewport as a sticky, independently-scrollable column — not
  // relevant here and, left as-is, would screenshot a viewport-tall image
  // that's almost entirely blank below the few mounted links, diluting a
  // clipped-vs-unclipped ring down to a tiny fraction of the image (below
  // toHaveScreenshot's maxDiffPixelRatio, so a real regression wouldn't
  // even fail the test). Shrink-wrap it instead, the same way
  // mountSvgPanel below overrides width for tighter framing; this leaves
  // every selector this test actually cares about (.sidebar-list li's
  // overflow, .sidebar-list's own overflow) untouched.
  nav.style.height = 'auto'
  const details = document.createElement('details')
  details.className = 'sidebar-group'
  details.open = true
  const summary = document.createElement('summary')
  summary.textContent = 'Flowchart'
  const ol = document.createElement('ol')
  ol.className = 'sidebar-list'
  for (const [i, title] of titles.entries()) {
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.href = `#sample-${i}`
    const num = document.createElement('span')
    num.className = 'sidebar-num'
    num.textContent = `${i + 1}.`
    a.appendChild(num)
    a.appendChild(document.createTextNode(` ${title}`))
    li.appendChild(a)
    ol.appendChild(li)
  }
  details.appendChild(summary)
  details.appendChild(ol)
  nav.appendChild(details)
  document.body.appendChild(nav)
  await waitForFonts()
  return nav
}

/** Remove a mounted panel (and its `.output-panel` wrapper) so consecutive tests in the same tab don't stack up. */
export function unmount(panel: HTMLElement): void {
  ;(panel.closest('.output-panel') ?? panel).remove()
}
