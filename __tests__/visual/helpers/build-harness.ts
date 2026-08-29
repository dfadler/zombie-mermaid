/**
 * Bundles harness-entry.ts (and everything it pulls in — mount.ts,
 * terminal-panel.ts, the ASCII/theme renderer internals, the demo
 * stylesheet) into a single browser-ready script, once per test run.
 *
 * `.css` uses esbuild's built-in `text` loader (raw file contents as a JS
 * string export) — the same effect as Vite's `?raw` import convention that
 * mount.ts used when this suite ran under Vitest's browser mode, but
 * without depending on Vite/Vitest at all.
 */
import * as esbuild from 'esbuild'

let cachedScript: Promise<string> | null = null

export function buildHarnessScript(): Promise<string> {
  cachedScript ??= esbuild
    .build({
      entryPoints: [new URL('./harness-entry.ts', import.meta.url).pathname],
      bundle: true,
      platform: 'browser',
      format: 'iife',
      loader: { '.css': 'text' },
      write: false,
    })
    .then((result) => result.outputFiles[0]!.text)
  return cachedScript
}
