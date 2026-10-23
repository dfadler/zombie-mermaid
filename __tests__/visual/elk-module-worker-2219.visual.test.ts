/**
 * #2219: a flowchart that needs ELK must render inside a browser module
 * Worker. A Worker has `self` but no `window`/`global`/`document`, so
 * `ensureElk()` hiding `self` left elk-worker.min.js with no global object
 * ("Cannot set properties of undefined (setting 'stackTraceLimit')").
 *
 * Bundles a tiny worker entry (registerElk + renderMermaidSVG) from source
 * and runs it as `new Worker(url, { type: 'module' })` in real Chromium.
 */
import { expect, test } from '@playwright/test'
import { bundleForBrowser } from '../../scripts/vite-bundle.ts'

const ORIGIN = 'https://worker.test'

test('renders an ELK flowchart inside a module Worker', async ({ page }) => {
  const entry = new URL('./helpers/elk-worker-entry.ts', import.meta.url)
  const script = await bundleForBrowser(entry.pathname, {
    minify: false,
    format: 'es',
  })
  await page.route(`${ORIGIN}/**`, (route) =>
    route.request().url().endsWith('/worker.js')
      ? route.fulfill({ contentType: 'text/javascript', body: script })
      : route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }),
  )
  await page.goto(`${ORIGIN}/`)

  const result = await page.evaluate(
    (url) =>
      new Promise<{ ok: boolean; svg?: string; msg?: string }>((resolve) => {
        const w = new Worker(url, { type: 'module' })
        w.onmessage = (e) => resolve(e.data)
        w.onerror = (e) => resolve({ ok: false, msg: e.message })
        w.postMessage(1)
      }),
    `${ORIGIN}/worker.js`,
  )

  expect(result.msg).toBeUndefined()
  expect(result.ok).toBe(true)
  expect(result.svg).toContain('<svg')
})
