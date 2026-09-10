/**
 * Bundles {@link ./theme-bar-only-client.ts} for the browser, for any page
 * generator that mounts `ThemePickerSection` (`demo/components/theme-
 * picker-section.tsx`) and has no other client JS of its own — blog.ts,
 * fork-fixes.ts, dashboard.ts, as of #687. (pages.ts's `DiagramHubPage`
 * dropped `ThemePickerSection`, and so this bundle, when its own "Pick a
 * look" section was removed.)
 *
 * One shared helper rather than each of those generators repeating the
 * same `bundleForBrowser` call: mirrors editor.ts's own
 * `bundleBrowserScript` in shape (unminified, so devtools stays readable —
 * see `BundleForBrowserOptions.minify`'s doc comment), but factored out
 * since this has more than one call site.
 */
import { bundleForBrowser } from '../scripts/vite-bundle.ts'

export async function bundleThemeBarClient(): Promise<string> {
  return bundleForBrowser(
    new URL('./theme-bar-only-client.ts', import.meta.url).pathname,
    { minify: false },
  )
}
