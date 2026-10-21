import { readFile } from 'node:fs/promises'
import { createElement } from 'react'
import {
  buildSoftwareApplicationJsonLd,
  escapeJsonForScriptTag,
  type SoftwareApplicationPackageInfo,
} from '../../../demo/format.ts'
import { renderHtmlDocument } from '../../../demo/render-html.ts'
import { IndexPage } from '../../../demo/components/index-page.tsx'
import type { Clients, Routes } from './shared.ts'

export async function homeRoutes(c: Clients, out: Routes): Promise<void> {
  const pkg = JSON.parse(
    await readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
  ) as SoftwareApplicationPackageInfo
  const jsonLd = escapeJsonForScriptTag(
    JSON.stringify(buildSoftwareApplicationJsonLd(pkg), null, 2),
  )
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n')
  out.set(
    'index.html',
    renderHtmlDocument(
      createElement(IndexPage, {
        jsonLd,
        clientScriptSrc: 'assets/index-page-client.js',
        clientScript: c['index-client']!,
      }),
    ),
  )
  out.set('assets/index-page-client.js', c['index-page-client']!)
}
