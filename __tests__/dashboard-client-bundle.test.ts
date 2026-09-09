/**
 * Guards two invariants `demo/components/dashboard-app.tsx`'s header
 * comment documents but that no other test actually exercises end to end:
 *
 * 1. `demo/dashboard-client.tsx` (the real browser bundle `dashboard.ts`
 *    inlines into dashboard.html) never pulls in `react-dom/server` — not
 *    just "no source file in its import graph says `from 'react-dom/
 *    server'`" (a source-level check a refactor could still defeat via an
 *    indirect re-export), but the *actual built chunk*, inspecting Rollup's
 *    own `moduleIds` list for every module Vite actually resolved into the
 *    bundle. This is exactly the regression fixed for real during #802's
 *    investigation: #801 changed `ThemePickerSection` to render via
 *    `ThemePickerIsland` (which imports `react-dom/server` for its own
 *    SSR-only purposes — see that file's header comment), and
 *    `dashboard-app.tsx`'s `DashboardApp` nested `<ThemePickerSection>`
 *    directly in its hydrated tree — silently dragging that whole
 *    dependency into this bundle despite this file's own explicit "never
 *    touches react-dom/server" contract. The fix moved `<ThemePickerSection>`
 *    (and `<Footer>`, for the same nesting reason) out of `DashboardApp`
 *    and into `dashboard-page.tsx` as plain siblings of the hydration
 *    container instead.
 * 2. Only one hydration call ever targets a given `THEME_PILLS_ROOT_ID`
 *    node for one page render — see the "no double hydration" describe
 *    block in `__tests__/dom/dashboard-hydration.test.ts` for that half
 *    (kept separate: it's a DOM/hydration behavior check, not a
 *    bundle-content check, so it belongs with the other `__tests__/dom/*`
 *    hydration tests rather than here).
 *
 * A real (if slower than a unit test) `vite build()` — not a plain source
 * grep — because minification/inlining can restructure how an import shows
 * up in the emitted *code*, but Rollup's own per-chunk `moduleIds` always
 * lists the absolute path of every module resolved into that chunk,
 * regardless of minification.
 */
import { fileURLToPath } from 'node:url'
import { build as viteBuild } from 'vite'
import { describe, expect, it } from 'vitest'

/**
 * Bundles `entryPath` exactly like `scripts/vite-bundle.ts`'s
 * `bundleForBrowser`, but returns the built chunk's `moduleIds` instead of
 * just its code string — `bundleForBrowser`'s own return type (a plain
 * string) has no room for that, and every existing caller only wants the
 * code, so this stays a test-local helper rather than widening that shared
 * function's contract for one caller.
 */
async function bundledModuleIds(entryPath: string): Promise<string[]> {
  const result = await viteBuild({
    configFile: false,
    logLevel: 'warn',
    build: {
      write: false,
      minify: true,
      target: 'esnext',
      rollupOptions: {
        input: entryPath,
        output: {
          format: 'es',
          codeSplitting: false,
          entryFileNames: 'bundle.js',
        },
      },
    },
  })
  const output = Array.isArray(result) ? result[0] : result
  if (!output || !('output' in output)) {
    throw new Error(`Vite build of ${entryPath} returned no output`)
  }
  const chunk = output.output.find((item) => item.type === 'chunk')
  if (!chunk || chunk.type !== 'chunk') {
    throw new Error(`Vite build of ${entryPath} produced no JS chunk`)
  }
  return chunk.moduleIds
}

describe('demo/dashboard-client.tsx bundle (#802 investigation fix)', () => {
  it(
    'never resolves any react-dom/server module into the built chunk',
    { timeout: 30_000 },
    async () => {
      const entryPath = fileURLToPath(
        new URL('../demo/dashboard-client.tsx', import.meta.url),
      )
      const moduleIds = await bundledModuleIds(entryPath)
      const serverModules = moduleIds.filter((id) =>
        id.includes('react-dom/server'),
      )
      expect(serverModules).toEqual([])
    },
  )
})
