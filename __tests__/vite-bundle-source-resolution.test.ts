/**
 * #1754: bundleForBrowser must resolve @zombie-mermaid/* from source, so a
 * stale packages/svg-renderer/dist (missing newer exports like registerElk)
 * cannot break `pnpm run editor`.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { bundleForBrowser } from '../scripts/vite-bundle.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = `${root}packages/svg-renderer/dist`

describe('bundleForBrowser workspace resolution', () => {
  it('ignores a stale svg-renderer dist', async () => {
    // packages/svg-renderer/dist is shared with other test files (cli-e2e runs
    // the built CLI, which imports it). Never replace or delete a real build
    // (#1970): only plant the stale stub when no dist/index.js exists, and
    // remove it only if it is still our stub.
    const indexJs = `${dist}/index.js`
    const stub = 'export const stale = 1\n'
    const planted = !existsSync(indexJs)
    if (planted) {
      mkdirSync(dist, { recursive: true })
      writeFileSync(indexJs, stub)
    }
    try {
      const code = await bundleForBrowser(`${root}src/browser.ts`, {
        minify: false,
      })
      expect(code).toContain('registerElk')
    } finally {
      if (
        planted &&
        existsSync(indexJs) &&
        readFileSync(indexJs, 'utf8') === stub
      ) {
        rmSync(indexJs, { force: true })
      }
    }
  }, 60_000)
})
