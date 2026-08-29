/**
 * Builds the terminal-window DOM the live demo renders ASCII output into
 * (see index.ts's `.ascii-panel` markup and demo/client.ts's
 * `TERMINAL_ASCII_OPTS`/`applyWideCharWidths`), so the visual regression
 * suite screenshots the exact chrome + palette a user actually sees.
 *
 * demo/client.ts can't be imported directly here: it assumes a bundled
 * `window.__mermaid` global that only exists once esbuild has inlined the
 * renderer into the generated demo page. The pieces below are reimplemented
 * against the real library exports instead — kept in sync with
 * demo/client.ts by hand where the browser DOM logic is duplicated, but
 * `charDisplayWidth` itself is imported from the renderer rather than
 * reimplemented, so "how wide is this glyph" has one source of truth.
 */
import { charDisplayWidth } from '../../../src/ascii/display-width.ts'
import {
  diagramColorsToAsciiTheme,
  type AsciiRenderOptions,
} from '../../../src/ascii/index.ts'

/**
 * Fixed dark palette the demo's ASCII panel renders with, independent of
 * the page's theme picker — real terminal output doesn't retheme itself.
 * Mirrors `TERMINAL_PALETTE` in demo/client.ts.
 */
const TERMINAL_PALETTE = {
  bg: '#0d1117',
  fg: '#e6edf3',
  line: '#3d444d',
  accent: '#4493f8',
  muted: '#9198a1',
}

export const TERMINAL_ASCII_OPTS: AsciiRenderOptions = {
  theme: diagramColorsToAsciiTheme(TERMINAL_PALETTE),
}

/** Split text into grapheme clusters — mirrors `graphemes` in demo/client.ts. */
function graphemes(text: string): string[] {
  if (typeof Intl.Segmenter !== 'function') return [...text]
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return [...segmenter.segment(text)].map((s) => s.segment)
}

/**
 * Give wide glyphs (CJK, emoji, etc.) their terminal width inside a
 * rendered ASCII panel. Mirrors `applyWideCharWidths` in demo/client.ts.
 */
export function applyWideCharWidths(container: HTMLElement): void {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode()) !== null) texts.push(node as Text)

  for (const text of texts) {
    const clusters = graphemes(text.data)
    if (!clusters.some((cluster) => charDisplayWidth(cluster) > 1)) continue

    const fragment = document.createDocumentFragment()
    for (const cluster of clusters) {
      const width = charDisplayWidth(cluster)
      if (width > 1) {
        const span = document.createElement('span')
        span.className = 'ascii-wide'
        span.style.width = `${width}ch`
        span.textContent = cluster
        fragment.appendChild(span)
      } else {
        fragment.appendChild(document.createTextNode(cluster))
      }
    }
    text.replaceWith(fragment)
  }
}

/**
 * Build the terminal-window element the demo renders ASCII output into
 * (see index.ts's `.ascii-panel` markup), populated with `html` — the
 * pre-rendered HTML string `renderMermaidASCII` returns under colorMode
 * 'html'/'auto'-in-a-browser.
 */
export function buildTerminalPanel(html: string): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'terminal-window'
  wrapper.innerHTML = `
    <div class="terminal-titlebar">
      <span class="terminal-dots" aria-hidden="true">
        <span class="terminal-dot terminal-dot-red"></span>
        <span class="terminal-dot terminal-dot-yellow"></span>
        <span class="terminal-dot terminal-dot-green"></span>
      </span>
      <span class="terminal-title">ascii</span>
    </div>
    <pre class="ascii-output"><code></code></pre>`
  const code = wrapper.querySelector('code')
  if (!code) throw new Error('terminal-panel: missing <code> element')
  code.innerHTML = html
  applyWideCharWidths(code)
  return wrapper
}
