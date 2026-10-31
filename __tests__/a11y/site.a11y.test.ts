/**
 * axe-core accessibility scan over the built static site (#1765).
 *
 * Prerequisite: `pnpm run build:site` (writes ./site). The spec serves that
 * directory itself, blocks every non-local request (the Plausible script), and
 * waits for network idle so the scan is deterministic. A static build is used
 * rather than the dev server because a live Vite page never goes network-idle
 * (HMR websocket; see CLAUDE.md).
 *
 * Fails on serious/critical violations of the wcag2a, wcag2aa and wcag22aa
 * rule sets. Run: `pnpm run test:a11y`.
 */
import { createServer, type Server } from 'node:http'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const SITE = resolve('site')
const TYPES = [
  'architecture-beta',
  'c4',
  'class',
  'er',
  'flowchart',
  'pie',
  'quadrant',
  'sequence',
  'state',
  'xy-chart',
]
const htmlIn = (dir: string) =>
  readdirSync(join(SITE, dir))
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
    .sort()

const PAGES = [
  'index.html',
  'fork-fixes.html',
  'dashboard.html',
  'layout-fidelity.html',
  'editor.html',
  'blog/index.html',
  ...htmlIn('blog')
    .slice(0, 2)
    .map((f) => `blog/${f}`),
  'diagrams/index.html',
  'diagrams/all.html',
  `diagrams/tag/${htmlIn('diagrams/tag')[0]}`,
  ...TYPES.flatMap((t) => [
    `diagrams/${t}.html`,
    `diagrams/${t}/${htmlIn(`diagrams/${t}`)[0]}`,
  ]),
]

/**
 * Violations that exist today and are tracked elsewhere. Keyed by page, then
 * axe rule id -> tracking issue. An entry here is not a disabled rule: any
 * OTHER serious/critical violation on the page still fails, and an entry that
 * no longer reproduces ALSO fails (delete it) so this list only shrinks.
 */
const KNOWN: Record<string, Record<string, string>> = {}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

let server: Server
let origin: string
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const p = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!))
    let f = join(SITE, p)
    if (!f.startsWith(SITE) || !existsSync(f)) {
      res.writeHead(404).end()
      return
    }
    if (statSync(f).isDirectory()) f = join(f, 'index.html')
    res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'text/plain' })
    res.end(readFileSync(f))
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const addr = server.address()
  origin = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
})
test.afterAll(() => server.close())

// Narrow pages scroll panels that fit at 1280 (scrollable-region-focusable,
// #1792), so scan the hand-written pages again at phone width.
const MOBILE_PAGES = PAGES.slice(0, 6)
const SCANS = [
  ...PAGES.map((path) => ({ path, width: 1280 })),
  ...MOBILE_PAGES.map((path) => ({ path, width: 390 })),
]

for (const { path, width } of SCANS) {
  test(`${path} @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    // No network: only the local static server.
    await page.route(
      (u) => u.origin !== origin,
      (r) => r.abort(),
    )
    await page.goto(`${origin}/${path}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze()
    const bad = violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    const known = KNOWN[path] ?? {}
    const seen = new Set(bad.map((v) => v.id))
    const unexpected = bad.filter((v) => !known[v.id])
    const stale = Object.keys(known).filter((id) => !seen.has(id))

    const fmt = (v: (typeof bad)[number]) =>
      `${v.id} (${v.impact}, ${v.nodes.length} nodes): ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`
    expect(unexpected.map(fmt), 'new axe violations').toEqual([])
    expect(
      stale,
      'KNOWN entries that no longer reproduce: remove them',
    ).toEqual([])
  })
}
