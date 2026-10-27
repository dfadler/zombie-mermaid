/**
 * layout-fidelity.html (#1686): a static snapshot of the committed
 * docs/layout-fidelity-scorecard.md and layout-fidelity-history.jsonl
 * (refreshed by `pnpm run layout:scorecard`), never a live run: the site build
 * has no network dependency and does not run the oracle.
 */
import { readFile } from 'node:fs/promises'
import { createElement } from 'react'
import { LayoutFidelityPage } from '../../../demo/components/layout-fidelity-page.tsx'
import { sharedPageCss } from '../../../demo/components/shared-page-css.tsx'
import {
  parseHistory,
  parseScorecard,
} from '../../../demo/layout-fidelity-model.ts'
import { renderHtmlDocument } from '../../../demo/render-html.ts'
import type { Clients, Routes } from './shared.ts'

const read = (rel: string) =>
  readFile(new URL(rel, import.meta.url), 'utf8')

export async function layoutFidelityRoutes(
  c: Clients,
  out: Routes,
): Promise<void> {
  const [css, md, jsonl] = await Promise.all([
    read('../../../demo/layout-fidelity.css'),
    read('../../../docs/layout-fidelity-scorecard.md'),
    read('../../../layout-fidelity-history.jsonl'),
  ])
  out.set(
    'layout-fidelity.html',
    renderHtmlDocument(
      createElement(LayoutFidelityPage, {
        css: sharedPageCss(css),
        sections: parseScorecard(md),
        ...parseHistory(jsonl),
        clientScript: c['layout-fidelity-client']!,
      }),
    ),
  )
}
