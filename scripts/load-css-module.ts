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
 * ## Hashing turns on per file, not globally
 *
 * `generateScopedName: '[local]'` keeps an output class name
 * byte-identical to the one written in the `.module.css` file — no content
 * hash suffix. That's the opposite of a typical CSS Modules setup, where
 * hashing is the whole point (collision-proof scoping). #938 started every
 * file on `[local]` deliberately: it opened the seam for *one* `*Css()`
 * function at a time, and this repo's existing selectors (`.card`, `.pill`,
 * `.section-eyebrow`, …) were still referenced directly as string literals
 * at call sites that hadn't converted yet, and by tests. Hashing would have
 * silently broken every one of those until the whole component migrated in
 * lockstep — exactly the "convert everything in one PR" scope #938
 * explicitly deferred.
 *
 * `HASHED_MODULE_CSS_BASENAMES` below is the opt-in list of files that have
 * since finished that migration (zombie-mermaid#969 turned on
 * `primitives.module.css`, the first entry) — every consumer confirmed to
 * import the compiled classes map rather than hardcode a selector string.
 * A `.module.css` file not listed there still gets `[local]`. Adding a file
 * to the list is therefore the actual "did we finish migrating" record this
 * repo has, and `__tests__/css-module-classes-usage.test.ts` enforces it:
 * it fails if any hashed file's source class names still show up as a bare
 * string literal outside that file's own generated classes module.
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
import { basename, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build as viteBuild, type Plugin } from 'vite'

/**
 * Bumped whenever this file's build configuration changes in a way that
 * could change a cached result (e.g. a different `generateScopedName`,
 * a different virtual-entry shape) — folded into the cache key so a stale
 * cache from before the change is never reused.
 */
const CACHE_VERSION = 2

/**
 * `.module.css` files (by basename) that have finished migrating every
 * consumer off string-literal class names and are safe to hash for real —
 * see this file's header comment. Add a file here only once
 * `__tests__/css-module-classes-usage.test.ts` (or an equivalent audit)
 * confirms nothing outside its generated classes module still hardcodes
 * one of its selectors.
 */
const HASHED_MODULE_CSS_BASENAMES = new Set(['primitives.module.css'])

/**
 * A real content hash, not one of Vite's `[hash]`-token string patterns:
 * this function's output has to be reproducible outside a Vite build too
 * (see `scripts/generate-primitives-classes.ts`, which writes the
 * committed classes map `primitives.tsx` imports without ever invoking
 * Vite), and Vite's own token substitution is an internal implementation
 * detail of whichever CSS backend (PostCSS vs. `lightningcss`) is active,
 * not a documented, stable format to depend on. Six hex characters of a
 * sha256 of the file path, its source, and the class name is short enough
 * to stay readable in a `className` attribute while changing whenever any
 * of those three inputs does.
 */
function hashedScopedName(name: string, filename: string, css: string): string {
  const hash = createHash('sha256')
    .update(filename)
    .update('\0')
    .update(css)
    .update('\0')
    .update(name)
    .digest('hex')
    .slice(0, 6)
  return `${name}_${hash}`
}

function generateScopedNameFor(
  cssFilePath: string,
): string | ((name: string, filename: string, css: string) => string) {
  return HASHED_MODULE_CSS_BASENAMES.has(basename(cssFilePath))
    ? hashedScopedName
    : '[local]'
}

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
  /** Source class name -> output class name — hashed or identical
   * depending on whether this file is in `HASHED_MODULE_CSS_BASENAMES`;
   * see this module's header comment. */
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
        // See this file's header comment: hashing turns on per file, once
        // every consumer of that file's classes has migrated.
        generateScopedName: generateScopedNameFor(cssFilePath),
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
