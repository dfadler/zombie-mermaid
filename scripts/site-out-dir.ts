/**
 * Resolves the directory a site generator writes its *output* into.
 *
 * Each of the six one-shot site generators (index.ts, editor.ts,
 * fork-fixes.ts, pages.ts, blog.ts, dashboard.ts) defaults to writing next
 * to itself — resolved relative to its own `import.meta.url`, i.e. the
 * repo root. `pnpm run dev` (vite.config.ts) and the standalone per-page
 * scripts (`pnpm run samples`/`editor`/`pages`/`blog`/`dashboard`/
 * `fork-fixes`) all depend on that default: they read generated output
 * straight from the repo root without passing anything special.
 *
 * Setting the `SITE_OUT_DIR` env var (a path, absolute or resolved
 * relative to `process.cwd()`) redirects every generator's *output* to
 * that directory instead. Each generator's own *source* reads (demo/**,
 * editor/**, blog-posts/**, package.json, the fork-fixes cache/screenshot
 * dirs, …) are unaffected — those are always resolved from the
 * generator's own `import.meta.url` directly, never through this helper.
 *
 * `build:site` (package.json) sets `SITE_OUT_DIR=site` so every generator
 * writes directly into `site/`, eliminating the old
 * generate-at-repo-root-then-`mv` chain — see #829.
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function siteOutDir(generatorUrl: string | URL): URL {
  const override = process.env.SITE_OUT_DIR
  if (!override) return new URL('./', generatorUrl)

  const abs = resolve(process.cwd(), override)
  // The trailing slash is load-bearing: every caller does
  // `new URL('./relative/path', siteOutDir(...))`, and WHATWG URL
  // resolution treats a base with no trailing slash as a *file*, dropping
  // its last path segment (`file:///a/b` + `./c` => `file:///a/c`, not
  // `file:///a/b/c`).
  return pathToFileURL(`${abs}/`)
}
