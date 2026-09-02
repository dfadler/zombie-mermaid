/**
 * Shared helper for rendering through the actual upstream `mermaid` npm
 * package headlessly via Playwright — the same engine behind the mermaid
 * Live Editor and GitHub's own mermaid code-block preview. Used by both
 * scripts/form-diff.ts (human-reviewable HTML report) and
 * scripts/form-facts.ts (structured JSON dump for the form-judge workflow).
 *
 * Mermaid does real DOM text measurement (getBBox/getComputedTextLength)
 * during layout, so it needs an actual rendering surface — that's why this
 * exists instead of a lighter, DOM-free approach. It can't be a perfect
 * stand-in for what GitHub or the Live Editor render right now: they may run
 * a different mermaid version, and headless Chromium's available fonts could
 * shift exact text measurement. `mermaid`'s version is pinned exactly (no
 * `^`) in package.json specifically so this doesn't silently drift further
 * from whatever was last spot-checked against a real mermaid.live/GitHub
 * render. It's still the actual mermaid.js layout algorithm on a real DOM,
 * not a reimplementation's guess at one — the closest thing to ground truth
 * this repo can render offline and on demand.
 */

import { chromium, type Browser, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { Mermaid } from 'mermaid'

declare global {
  interface Window {
    mermaid: Mermaid
  }
}

export interface RealMermaidSession {
  browser: Browser
  page: Page
  close(): Promise<void>
}

/** Launch a headless browser with the real mermaid.js library loaded and initialized. */
export async function startRealMermaid(): Promise<RealMermaidSession> {
  const mermaidJs = await readFile(
    new URL('../../node_modules/mermaid/dist/mermaid.min.js', import.meta.url),
    'utf8',
  )

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setContent('<!DOCTYPE html><html><body></body></html>')
  await page.addScriptTag({ content: mermaidJs })
  await page.evaluate(() => {
    window.mermaid.initialize({ startOnLoad: false, theme: 'default' })
  })

  return {
    browser,
    page,
    close: () => browser.close(),
  }
}

/**
 * Render `source` through real mermaid.js, returning the raw SVG string.
 * `renderId` must be unique per call within a session and must not contain
 * `-` (mermaid uses it as a literal DOM id, and this repo's slugs use
 * hyphens — callers should strip them, e.g. `id.replace(/-/g, '_')`).
 * Throws mermaid's own parse/render error on invalid syntax — callers
 * decide how to surface that (a report panel, a judge-input field, etc.).
 */
export async function renderRealMermaidSvg(
  session: RealMermaidSession,
  renderId: string,
  source: string,
): Promise<string> {
  return session.page.evaluate(
    async ([id, src]) => {
      const { svg } = await window.mermaid.render(id, src)
      return svg
    },
    [renderId, source] as [string, string],
  )
}

/**
 * Strip the boilerplate every mermaid render carries regardless of diagram
 * content — `<defs>` (arrowhead/icon symbol definitions), `<marker>`, and
 * the injected `<style>` block (mermaid's default theme CSS, identical
 * shape every time) — keeping only the elements that actually vary per
 * diagram. This is what makes passing real SVG to an LLM judge affordable:
 * the boilerplate is the majority of a raw render's byte size (see the
 * spike in this session: a two-actor sequence diagram's `<defs>`/`<style>`
 * block alone ran several KB) and carries zero per-sample signal.
 */
export function trimMermaidSvg(svg: string): string {
  return svg
    .replace(/<defs>[\s\S]*?<\/defs>/g, '')
    .replace(/<style>[\s\S]*?<\/style>/g, '')
    .replace(/<marker[^>]*>[\s\S]*?<\/marker>/g, '')
    .replace(/\n\s*\n/g, '\n')
    .trim()
}
