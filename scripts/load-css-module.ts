/**
 * The CSS Modules seam: resolves a real `.module.css` file through Vite's
 * own CSS Modules implementation, returning both the compiled stylesheet
 * text and the map from source class name to output class name.
 * (zombie-mermaid#938, part of the #931 umbrella.)
 *
 * ## Why this exists instead of a plain `import styles from './x.module.css'`
 *
 * In an ordinary Vite app, `.module.css` support is free: Vite's dev server
 * and `vite build` both intercept the import and hand back a JS module of
 * class names. This repo's site generators (index.ts, editor.ts,
 * fork-fixes.ts, pages.ts, blog.ts, dashboard.ts) don't run through either
 * of those — they're one-shot scripts executed directly by `tsx` (see
 * vite.config.ts's header comment for why: the dev server just re-runs
 * these same scripts and serves their output, rather than serving a live
 * Vite module graph), and `tsx`'s Node-loader-based transform has no CSS
 * handling at all. A bare `import './x.module.css'` from a `tsx`-run file
 * fails outright.
 *
 * `bundleForBrowser()` (./vite-bundle.ts) already solves the equivalent
 * problem for the browser-facing JS bundles these generators embed: it
 * calls Vite's `build()` API directly, standing in for a dev
 * server/full-app build the generator will never have. This module applies
 * the same trick to a single `.module.css` file — pointing `build()` at a
 * tiny virtual entry that re-exports the CSS module's default export, with
 * `write: false` to keep everything in memory — so a `*Css()` function can
 * delegate to a real `.module.css` file and reach Vite's genuine CSS
 * Modules implementation (scoped class names, real PostCSS/`lightningcss`
 * processing) instead of a hand-rolled template literal.
 *
 * ## Class names are left unhashed, deliberately
 *
 * `generateScopedName: '[local]'` keeps every output class name
 * byte-identical to the one written in the `.module.css` file — no content
 * hash suffix. That's the opposite of a typical CSS Modules setup, where
 * hashing is the whole point (collision-proof scoping). It's deliberate
 * here: #938 opens the seam for *one* `*Css()` function at a time, and this
 * repo's existing selectors (`.card`, `.pill`, `.section-eyebrow`, …) are
 * still referenced directly as string literals at call sites that haven't
 * been converted yet, and by tests. Hashing would silently break every one
 * of those until the whole component migrates in lockstep — exactly the
 * "convert everything in one PR" scope #938 explicitly defers. A future
 * PR that finishes converting a component's classes *and* every consumer
 * to import the classes map can safely turn hashing back on for that file.
 *
 * ## Disk cache
 *
 * A cold `build()` call costs roughly 100-150ms even for a tiny file (see
 * this issue's PR body for measurements) — negligible for one call per
 * generator run, but this function's caller (e.g. primitives.tsx) resolves
 * its `.module.css` once at module-load time via top-level `await`, and
 * Vitest's default per-test-file module isolation means that cost could
 * otherwise be paid again for every test file that transitively imports
 * that module. A small on-disk cache, keyed by the source file's content
 * hash plus this loader's own logic version, turns every call after the
 * first real one (across processes, not just within one) into a plain
 * `readFile` + `JSON.parse`. `.css-modules-cache/` follows the same
 * dot-prefixed, gitignored convention as `.fork-fixes-cache/` and
 * `.visual-diff-cache/`.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build as viteBuild, type Plugin } from 'vite'

/**
 * Bumped whenever this file's build configuration changes in a way that
 * could change a cached result (e.g. a different `generateScopedName`,
 * a different virtual-entry shape) — folded into the cache key so a stale
 * cache from before the change is never reused.
 */
const CACHE_VERSION = 1

/**
 * Resolves a `.module.css` URL to a real filesystem path.
 *
 * Vitest's jsdom test environment (this repo's marker for a test that
 * needs a live DOM — see config/vitest.config.ts's comment) transforms every
 * module a jsdom-environment test reaches as if it will run in a real
 * browser. Part of that: Vite rewrites `import.meta.url` to a synthetic
 * dev-server URL (`http://localhost:<port>/<repo-relative-path>`) instead
 * of the real `file://` path a plain Node/`tsx` execution — or a non-jsdom
 * Vitest test — gets. `primitives.tsx` (this seam's one real consumer
 * today) resolves its `.module.css` sibling via `new
 * URL('./primitives.module.css', import.meta.url)` at module-load time,
 * and `demo-primitives.test.ts` exercises it under exactly that jsdom
 * environment (it renders `<Card>`/`<Pill>`/etc via React Testing
 * Library), so `cssFileUrl.protocol` can't be assumed to always be
 * `'file:'`.
 *
 * The fallback below resolves the synthetic URL's `pathname` (which Vite
 * roots at the repo root either way) against `process.cwd()` — safe
 * specifically because that branch only ever runs inside a `vitest`
 * process, which is always invoked from the repo root, and never during a
 * real generator run.
 */
function toFilePath(url: URL): string {
  if (url.protocol === 'file:') return fileURLToPath(url)
  return resolvePath(process.cwd(), `.${url.pathname}`)
}

const CACHE_DIR = toFilePath(new URL('../.css-modules-cache/', import.meta.url))

export interface CssModuleResult<
  Classes extends Record<string, string> = Record<string, string>,
> {
  /** The compiled stylesheet text, ready to embed in a `<style>` element. */
  css: string
  /** Source class name -> output class name (identical today; see this
   * module's header comment on why hashing is off). */
  classes: Classes
}

const VIRTUAL_ENTRY_ID = '\0css-module-entry'

function virtualEntryPlugin(cssFilePath: string): Plugin {
  return {
    name: 'zombie-mermaid-css-module-entry',
    resolveId(id) {
      return id === VIRTUAL_ENTRY_ID ? VIRTUAL_ENTRY_ID : null
    },
    load(id) {
      if (id !== VIRTUAL_ENTRY_ID) return null
      return `export { default } from ${JSON.stringify(cssFilePath)}`
    },
  }
}

function cachePathFor(cssFilePath: string, source: string): string {
  const hash = createHash('sha256')
    .update(String(CACHE_VERSION))
    .update('\0')
    .update(cssFilePath)
    .update('\0')
    .update(source)
    .digest('hex')
  return resolvePath(CACHE_DIR, `${hash}.json`)
}

/**
 * Resolves `cssFileUrl` (a `.module.css` file, addressed the same way a
 * sibling import would be — `new URL('./x.module.css', import.meta.url)`)
 * through Vite's CSS Modules transform.
 *
 * `Classes` lets a caller pin the expected keys (see
 * primitives.tsx for the pattern) instead of getting back a bare
 * `Record<string, string>` — this repo doesn't yet generate a `.d.ts`
 * alongside each `.module.css` (a real typed-css-modules-style codegen
 * step is reasonable follow-up work once more than one file goes through
 * this seam), so the type is asserted by the caller, not inferred from the
 * file.
 */
export async function loadCssModule<
  Classes extends Record<string, string> = Record<string, string>,
>(cssFileUrl: URL): Promise<CssModuleResult<Classes>> {
  const cssFilePath = toFilePath(cssFileUrl)
  const source = await readFile(cssFilePath, 'utf8')
  const cachePath = cachePathFor(cssFilePath, source)

  const cached = await readFile(cachePath, 'utf8').catch(() => null)
  if (cached !== null) {
    return JSON.parse(cached) as CssModuleResult<Classes>
  }

  const result = await viteBuild({
    // Skip loading vite.config.ts — its plugin is dev-server-only and
    // irrelevant here, matching bundleForBrowser()'s own reasoning.
    configFile: false,
    logLevel: 'warn',
    plugins: [virtualEntryPlugin(cssFilePath)],
    css: {
      modules: {
        // See this file's header comment: hashing stays off until every
        // consumer of a given `*Css()` function's classes migrates.
        generateScopedName: '[local]',
      },
    },
    build: {
      write: false,
      cssCodeSplit: true,
      // Preserve the source's own formatting rather than collapsing it to
      // one line — this repo's generated `<style>` output has historically
      // been human-readable, and nothing depends on it being minified (the
      // real minification, where it matters, happens on the *browser js*
      // bundle via bundleForBrowser(), not on inlined page CSS).
      cssMinify: false,
      target: 'esnext',
      rollupOptions: {
        input: VIRTUAL_ENTRY_ID,
        // Without this, Rollup/Rolldown treats the virtual entry's
        // `export { default }` as unused (nothing outside this one-shot
        // build imports it) and tree-shakes the whole chunk down to an
        // empty module — verified empirically while building this seam.
        // `preserveEntrySignatures: 'strict'` keeps the entry's exports
        // intact regardless of external usage, which is exactly what an
        // entry point whose only purpose *is* its exports needs.
        treeshake: false,
        preserveEntrySignatures: 'strict',
        output: { format: 'es', entryFileNames: 'entry.js' },
      },
    },
  })

  const output = Array.isArray(result) ? result[0] : result
  if (!output || !('output' in output)) {
    throw new Error(
      `Vite build of ${cssFilePath} returned no output (unexpected watch mode?)`,
    )
  }
  const chunk = output.output.find((item) => item.type === 'chunk')
  const asset = output.output.find(
    (item) => item.type === 'asset' && item.fileName.endsWith('.css'),
  )
  if (!chunk || chunk.type !== 'chunk') {
    throw new Error(`Vite build of ${cssFilePath} produced no JS chunk`)
  }
  if (!asset || asset.type !== 'asset') {
    throw new Error(`Vite build of ${cssFilePath} produced no CSS asset`)
  }

  const dataUrl = `data:text/javascript;base64,${Buffer.from(chunk.code, 'utf8').toString('base64')}`
  const mod = (await import(dataUrl)) as { default: Classes }

  const css =
    typeof asset.source === 'string'
      ? asset.source
      : Buffer.from(asset.source).toString('utf8')
  const parsed: CssModuleResult<Classes> = { css, classes: mod.default }

  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(cachePath, JSON.stringify(parsed), 'utf8')

  return parsed
}
