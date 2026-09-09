/**
 * Generates index.html — the site's marketing landing page.
 *
 * Usage: tsx index.ts
 *
 * Until #598 this generator also bundled `src/browser.ts`/`demo/client.ts`
 * for the browser, pre-highlighted every sample with shiki, and wrote a
 * client-rendered sample gallery. That gallery's job (browsing every
 * sample/theme combination) now belongs to the Diagrams hub (`/diagrams/`,
 * `pages.ts`) and the Editor (`editor.html`, `editor.ts`); this file only
 * needs the one piece of real I/O the marketing page still requires —
 * reading `package.json` to build the `SoftwareApplication` JSON-LD block —
 * and hands everything else to demo/components/index-page.tsx, a pure
 * function of that one string.
 *
 * The markup comes from React (demo/components/index-page.tsx) rendered
 * with react-dom/server's `renderToStaticMarkup`, per #589's move of every
 * site generator off template-literal HTML.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { createElement } from 'react'
import {
  escapeJsonForScriptTag,
  buildSoftwareApplicationJsonLd,
  type SoftwareApplicationPackageInfo,
} from './demo/format.ts'
import { renderHtmlDocument } from './demo/render-html.ts'
import { IndexPage } from './demo/components/index-page.tsx'
import { bundleThemeBarClient } from './demo/build-theme-bar-client.ts'

/**
 * Read package.json and build the `SoftwareApplication` JSON-LD block for
 * the home page's `<head>`, indented and escaped for embedding in a
 * `<script type="application/ld+json">` tag.
 *
 * The I/O (reading package.json) lives here; the JSON-LD shape itself is
 * `buildSoftwareApplicationJsonLd` in demo/format.ts, which is pure and unit
 * tested directly — see that function's doc comment for why the block is
 * shaped the way it is.
 */
async function buildJsonLd(): Promise<string> {
  const pkgRaw = await readFile(
    new URL('./package.json', import.meta.url),
    'utf8',
  )
  const pkg = JSON.parse(pkgRaw) as SoftwareApplicationPackageInfo
  const jsonLd = buildSoftwareApplicationJsonLd(pkg)

  const json = escapeJsonForScriptTag(JSON.stringify(jsonLd, null, 2))
  return json
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n')
}

async function generateHtml(): Promise<string> {
  const [jsonLd, themeBarScript] = await Promise.all([
    buildJsonLd(),
    bundleThemeBarClient(),
  ])
  return renderHtmlDocument(
    createElement(IndexPage, { jsonLd, themeBarScript }),
  )
}

const html = await generateHtml()
const outPath = new URL('./index.html', import.meta.url).pathname
await writeFile(outPath, html)
console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`)
