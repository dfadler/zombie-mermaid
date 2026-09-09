/**
 * Generates dashboard.html — a public maintenance-transparency dashboard
 * comparing zombie-mermaid against upstream beautiful-mermaid.
 *
 * Usage: tsx dashboard.ts
 *
 * Unlike index.ts/editor.ts, this page renders a **static snapshot**, not
 * live data: it reads demo/dashboard-data.json, a committed file refreshed
 * by `pnpm run dashboard:data` (scripts/generate-dashboard-data.ts). See
 * that script's header comment for why the GitHub API calls happen there
 * and not here — in short, this generator runs on every PR (ci.yml's
 * `build-site` job) and on every push to main (pages.yml), and neither of
 * those should gain a live network dependency. The page shows
 * `generatedAt` up front so readers know it's a point-in-time snapshot.
 *
 * The markup comes from React components (demo/components/dashboard-
 * page.tsx) rendered with react-dom/server's `renderToStaticMarkup` — the
 * pilot for #423, which is migrating every site generator off
 * template-literal HTML, and (#610) rebuilt in the #590 shared visual
 * system. This file is deliberately just the I/O shell: read the snapshot
 * and stylesheet, render, write. The data model and formatting helpers
 * live in demo/dashboard-model.ts (re-exported here for callers that
 * already import them from this module).
 *
 * The stylesheet is assembled from shared-page-css.tsx's `sharedPageCss()`
 * — the shared component library's design tokens, primitives, nav, and
 * footer CSS, in the order the cascade requires — plus this page's own
 * demo/dashboard.css, rather than demo/styles.css's older `--t-*` theme
 * those shared modules do not use.
 *
 * Addresses zombie-mermaid#265 and #610. See also #259 ("state of the fork"
 * report) for a complementary, narrative write-up of similar underlying
 * data — this page is the always-current rendered artifact, not a periodic
 * post.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import dashboardData from './demo/dashboard-data.json' with { type: 'json' }
import { DashboardPage } from './demo/components/dashboard-page.tsx'
import { sharedPageCss } from './demo/components/shared-page-css.tsx'
import { themePickerCss } from './demo/components/theme-picker.tsx'
import { bundleThemeBarClient } from './demo/build-theme-bar-client.ts'
import {
  parseDashboardData,
  type DashboardData,
} from './demo/dashboard-model.ts'
import { renderHtmlDocument } from './demo/render-html.ts'

export {
  daysSince,
  formatDate,
  formatDateTime,
  pluralDays,
  type DashboardData,
  type RepoStats,
  type RescuedIssue,
} from './demo/dashboard-model.ts'

/**
 * Renders the complete dashboard document for `data`, styled by `css`.
 *
 * `themeBarScript` defaults to `''` (an empty inline `<script>`) so
 * existing callers/tests that don't care about the theme bar's
 * interactivity — this page has nothing of its own to re-theme — don't
 * need to pass a real bundle.
 */
export function renderDashboardHtml(
  data: DashboardData,
  css: string,
  themeBarScript = '',
): string {
  return renderHtmlDocument(
    createElement(DashboardPage, { data, css, themeBarScript }),
  )
}

/** Renders the committed snapshot (demo/dashboard-data.json) with the page's assembled stylesheet. */
export async function generate(): Promise<string> {
  const [pageCss, themeBarScript] = await Promise.all([
    readFile(new URL('./demo/dashboard.css', import.meta.url), 'utf8'),
    bundleThemeBarClient(),
  ])
  const css = sharedPageCss([themePickerCss(), pageCss].join('\n\n'))
  return renderDashboardHtml(
    parseDashboardData(dashboardData),
    css,
    themeBarScript,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const html = await generate()
  const outPath = fileURLToPath(new URL('./dashboard.html', import.meta.url))
  await writeFile(outPath, html, 'utf8')
  console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`)
}
