/**
 * #1754: bundleForBrowser must resolve @zombie-mermaid/* from source, so a
 * stale packages/svg-renderer/dist (missing newer exports like registerElk)
 * cannot break `pnpm run editor`.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { bundleForBrowser } from '../scripts/vite-bundle.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = `${root}packages/svg-renderer/dist`

describe('bundleForBrowser workspace resolution', () => {
  it('ignores a stale svg-renderer dist', async () => {
    mkdirSync(dist, { recursive: true })
    writeFileSync(`${dist}/index.js`, 'export const stale = 1\n')
    try {
      const code = await bundleForBrowser(`${root}src/browser.ts`, {
        minify: false,
      })
      expect(code).toContain('registerElk')
    } finally {
      rmSync(dist, { recursive: true, force: true })
    }
  }, 60_000)
})
