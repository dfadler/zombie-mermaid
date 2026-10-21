/**
 * dashboard.html — the maintenance-transparency dashboard (ported from the
 * former packages/site/dashboard.ts). Renders a static snapshot of the committed
 * demo/dashboard-data.json (refreshed by `pnpm run dashboard:data`), never live
 * data: the site build runs on every PR and push to main and must not gain a
 * network dependency. The hydration bundle is inlined, not written to `assets/`.
 */
import { readFile } from 'node:fs/promises'
import { createElement } from 'react'
import dashboardData from '../../../demo/dashboard-data.json' with { type: 'json' }
import { DashboardPage } from '../../../demo/components/dashboard-page.tsx'
import { sharedPageCss } from '../../../demo/components/shared-page-css.tsx'
import { parseDashboardData } from '../../../demo/dashboard-model.ts'
import { renderHtmlDocument } from '../../../demo/render-html.ts'
import type { Clients, Routes } from './shared.ts'

export async function dashboardRoutes(c: Clients, out: Routes): Promise<void> {
  const pageCss = await readFile(
    new URL('../../../demo/dashboard.css', import.meta.url),
    'utf8',
  )
  out.set(
    'dashboard.html',
    renderHtmlDocument(
      createElement(DashboardPage, {
        data: parseDashboardData(dashboardData),
        css: sharedPageCss(pageCss),
        clientScript: c['dashboard-client']!,
      }),
    ),
  )
}
