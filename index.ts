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

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createElement } from 'react'
import {
  escapeJsonForScriptTag,
  buildSoftwareApplicationJsonLd,
  type SoftwareApplicationPackageInfo,
} from './demo/format.ts'
import { renderHtmlDocument } from './demo/render-html.ts'
import { IndexPage } from './demo/components/index-page.tsx'
import { bundleForBrowser } from './scripts/vite-bundle.ts'

/**
 * Bundle `demo/index-page-client.ts` for the browser (#759) — mirrors
 * `pages.ts`'s `bundleDiagramPageClient()`. Unlike this generator's
 * previous client script (`demo/theme-bar-only-client.ts`'s `themeBarScript`,
 * inlined directly into a `<script type="module">` tag), the homepage's
 * theme showcase now has meaningfully more client logic — diagram
 * re-theming, site-chrome re-theming, and an `IntersectionObserver`-driven
 * picker relocation — so it's written to its own external file instead,
 * the same `assets/` pattern `pages.ts`/`blog.ts`/`dashboard.ts` already
 * use for their own bundles.
 */
async function bundleClientScript(): Promise<string> {
  return bundleForBrowser(
    new URL('./demo/index-page-client.ts', import.meta.url).pathname,
    { minify: false },
  )
}

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
  const jsonLd = await buildJsonLd()
  return renderHtmlDocument(
    createElement(IndexPage, {
      jsonLd,
      clientScriptSrc: 'assets/index-page-client.js',
    }),
  )
}

const assetsDir = new URL('./assets/', import.meta.url)
await mkdir(assetsDir, { recursive: true })

const [html, clientJs] = await Promise.all([generateHtml(), bundleClientScript()])

await writeFile(new URL('./index-page-client.js', assetsDir), clientJs)

const outPath = new URL('./index.html', import.meta.url).pathname
await writeFile(outPath, html)
console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`)
