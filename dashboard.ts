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
 * The stylesheet is assembled from the shared component library's own CSS
 * functions — tokens.tsx's `designBaseCss()`, primitives.tsx's
 * `primitivesCss()`, nav.tsx's `navCss()`, footer.tsx's `footerCss()` — plus
 * this page's own demo/dashboard.css, rather than demo/styles.css's older
 * `--t-*` theme those shared modules do not use.
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
import { footerCss } from './demo/components/footer.tsx'
import { navCss } from './demo/components/nav.tsx'
import { primitivesCss } from './demo/components/primitives.tsx'
import { designBaseCss } from './demo/components/tokens.tsx'
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

/** Renders the complete dashboard document for `data`, styled by `css`. */
export function renderDashboardHtml(data: DashboardData, css: string): string {
  return renderHtmlDocument(createElement(DashboardPage, { data, css }))
}

/** Renders the committed snapshot (demo/dashboard-data.json) with the page's assembled stylesheet. */
export async function generate(): Promise<string> {
  const pageCss = await readFile(
    new URL('./demo/dashboard.css', import.meta.url),
    'utf8',
  )
  const css = [designBaseCss(), primitivesCss(), navCss(), footerCss(), pageCss].join(
    '\n\n',
  )
  return renderDashboardHtml(parseDashboardData(dashboardData), css)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const html = await generate()
  const outPath = fileURLToPath(new URL('./dashboard.html', import.meta.url))
  await writeFile(outPath, html, 'utf8')
  console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`)
}
