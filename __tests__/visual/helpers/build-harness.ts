/**
 * Bundles harness-entry.ts (and everything it pulls in — mount.ts,
 * terminal-panel.ts, the ASCII/theme renderer internals, the demo
 * stylesheet) into a single browser-ready script, once per test run.
 *
 * Goes through the shared Vite/rolldown helper in scripts/vite-bundle.ts
 * (https://vite.dev/guide/api-javascript#build); mount.ts imports the
 * stylesheet with `?raw` (https://vite.dev/guide/assets#importing-asset-as-string).
 */
import { bundleForBrowser } from '../../../scripts/vite-bundle.ts'

let cachedScript: Promise<string> | null = null

export function buildHarnessScript(): Promise<string> {
  cachedScript ??= bundleForBrowser(
    new URL('./harness-entry.ts', import.meta.url).pathname,
    { minify: false, format: 'iife' },
  )
  return cachedScript
}
