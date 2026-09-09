/**
 * Bundles {@link ./nav-only-client.tsx} for the browser, for any page
 * generator whose only hydrated content is `<Nav>` (zombie-mermaid#800) —
 * editor.ts, index.ts, fork-fixes.ts, blog.ts, and pages.ts, as of this
 * issue. `dashboard.ts` does not use this: its own `bundleDashboardClient()`
 * bundles `demo/dashboard-client.tsx` instead, which imports `hydrateNav()`
 * directly (see that file's header comment).
 *
 * One shared helper rather than each of those five generators repeating the
 * same `bundleForBrowser` call — mirrors `build-theme-bar-client.ts`'s
 * `bundleThemeBarClient()` in shape and reasoning, but `minify: true`
 * (unlike that helper's `minify: false`): like `dashboard.ts`'s own
 * `bundleDashboardClient()`, this bundle includes `react` and
 * `react-dom/client`, and the #797 epic issue's accepted bundle-size
 * baseline was measured against a minified build (see that generator's own
 * doc comment for the measured unminified-vs-minified difference).
 */
import { bundleForBrowser } from '../scripts/vite-bundle.ts'

export async function bundleNavClient(): Promise<string> {
  return bundleForBrowser(
    new URL('./nav-only-client.tsx', import.meta.url).pathname,
    { minify: true },
  )
}
