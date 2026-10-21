/**
 * Compiles a `.module.css` file through Lightning CSS (zombie-mermaid#1103):
 * the one compile step behind `demo/components/primitives-css.tsx` (SSR/build
 * time) and `scripts/generate-primitives-classes.ts`. It is a plain function
 * call rather than a Node loader hook (the old `node --import` registration
 * was retired with the tsx site generators): Vitest's and the site build's
 * own bundlers intercept a bare `.module.css` import with their own CSS
 * Modules handling (differently hashed classes, no compiled-CSS export), so a
 * direct call is what keeps the output identical whichever runner imports it.
 */
import { readFile } from 'node:fs/promises'
import { basename, relative, sep } from 'node:path'
import { transform } from 'lightningcss'

/**
 * The repo root, used to turn an absolute `filePath` into a stable,
 * checkout-independent one before handing it to Lightning CSS (see
 * `compileModuleCss`'s `filename` comment for why).
 *
 * Deliberately `process.cwd()`, not something derived from this file's own
 * `import.meta.url`: this module imports the bare `lightningcss` package, so
 * Vite's dependency pre-bundling rewrites its `import.meta.url` to a
 * synthetic `dist/index.js`-style path with no relation to this file's real
 * on-disk location whenever it's reached indirectly under Vitest (e.g. via
 * primitives-css.tsx, under demo-primitives.test.ts) — confirmed
 * empirically, `new URL('..', import.meta.url)` in that case resolves
 * nowhere near the repo root. Every caller here already runs with the repo
 * root as its working directory (a `pnpm run` script, Vitest, or this
 * tsx script), matching the same assumption
 * primitives-css.tsx's `siblingCssPath()` already makes.
 */
const REPO_ROOT = process.cwd()

/**
 * `.module.css` files (by basename) whose classes are scoped with a content
 * hash rather than left as the literal source name — mirrors
 * `scripts/load-css-module.ts`'s own `HASHED_MODULE_CSS_BASENAMES` opt-in
 * list (zombie-mermaid#969's convention: a file only hashes once every
 * consumer imports the compiled classes map instead of a hardcoded selector
 * string). The two lists are independent copies, not shared code — #968
 * deletes `load-css-module.ts` entirely once it switches this seam's one
 * real consumer over, so nothing here can import from it.
 */
const HASHED_MODULE_CSS_BASENAMES = new Set(['primitives.module.css'])

/**
 * The Lightning CSS `cssModules.pattern` used for the hashed set, above.
 * Not the same hash *value* `load-css-module.ts` computes (that one hashes
 * repo-relative-path+source+name with sha256, for cross-machine stability)
 * — Lightning CSS's own `[hash]` is a content hash it computes internally,
 * which is just as collision-proof for scoping purposes. Nothing depends on
 * matching the old bridge's exact hash bytes: `__tests__/
 * css-module-classes-usage.test.ts` compares a file's committed generated
 * classes map against a *fresh* build, not a hardcoded literal, so it's
 * self-consistent regardless of which hashing scheme produced it.
 */
const HASHED_PATTERN = '[local]_[hash]'
const UNHASHED_PATTERN = '[local]'

/**
 * A conservative, comment-blind scan for a local `@import` rule. Lightning
 * CSS's `transform()` (unlike its `bundle()`/`bundleAsync()` APIs) doesn't
 * inline an `@import`'s rules into the compiled output — it leaves the
 * at-rule as-is, so the `css` this hook exports would silently stop being
 * the complete, self-contained stylesheet every existing consumer expects
 * (the old `load-css-module.ts` bridge bundled `@import` transitively, via
 * Vite's own `build()`). No `.module.css` file in this repo uses `@import`
 * today (zombie-mermaid#1103's own scope note), so failing loudly here
 * costs nothing yet and avoids a silently-incomplete stylesheet once one
 * does — full bundling support is real, scoped follow-up work, not
 * something to half-implement inline.
 */
const IMPORT_RULE_PATTERN = /@import\s/i

/**
 * True if any class this file exports composes another (`composes: foo`).
 * Lightning CSS reports a composed reference in `info.composes`
 * (zombie-mermaid#1103's review found this file previously read only
 * `info.name`, silently dropping composition) — resolving local, global,
 * and cross-file composition correctly is real follow-up work, so this
 * hook fails loudly instead of exporting a classes map missing the
 * composed styles a consumer's className would otherwise (wrongly) claim
 * to include.
 */
function hasComposition(exports) {
  return Object.values(exports ?? {}).some((info) => info.composes.length > 0)
}

/**
 * Compiles a `.module.css` file at `filePath` (an absolute filesystem path)
 * through Lightning CSS, the same way for every caller.
 *
 * @param {string} filePath
 * @returns {Promise<{ css: string, classes: Record<string, string> }>}
 */
export async function compileModuleCss(filePath) {
  const source = await readFile(filePath)

  if (IMPORT_RULE_PATTERN.test(source.toString('utf8'))) {
    throw new Error(
      `${filePath}: '@import' is not supported by the .module.css loader hook (zombie-mermaid#1103) — Lightning CSS's transform() doesn't bundle it, so the compiled stylesheet would be incomplete. Inline the imported rules, or extend the hook to use Lightning CSS's bundle()/bundleAsync() API instead.`,
    )
  }

  // node:path's basename(), not a manual `split('/').pop()` — a caller may
  // pass a path in the host platform's own separator, which on Windows is a
  // backslash that `split('/')` never matches, silently leaving the whole
  // path as the "basename" and always missing HASHED_MODULE_CSS_BASENAMES
  // (zombie-mermaid#1103's review caught this — the Vite re-exec path in
  // vite.config.ts can reach this hook on Windows too).
  const moduleBasename = basename(filePath)
  const pattern = HASHED_MODULE_CSS_BASENAMES.has(moduleBasename)
    ? HASHED_PATTERN
    : UNHASHED_PATTERN

  // Lightning CSS's `[hash]` is derived from the `filename` passed in, so an
  // absolute `filePath` (which varies by checkout location — a different
  // clone, a different CI runner, a different git worktree) would give the
  // *same* CSS module a different hash per machine. That breaks the whole
  // point of primitives-classes.ts's committed classes map (zombie-mermaid
  // #968/#969): it's generated once and must keep matching whatever hash
  // primitives-css.tsx computes live at SSR/build time, possibly on a
  // different machine entirely. A repo-root-relative, forward-slash-
  // normalized path keeps the hash identical across machines instead.
  const relativeFilePath = relative(REPO_ROOT, filePath).split(sep).join('/')

  const { code, exports } = transform({
    filename: relativeFilePath,
    code: source,
    cssModules: { pattern },
  })

  if (hasComposition(exports)) {
    throw new Error(
      `${filePath}: 'composes:' is not supported by the .module.css loader hook (zombie-mermaid#1103) — it would silently drop the composed class(es) from the exported classes map. Resolve the composition inline, or extend the hook to read Lightning CSS's CSSModuleExport.composes.`,
    )
  }

  /** @type {Record<string, string>} */
  const classes = {}
  for (const [sourceName, info] of Object.entries(exports ?? {})) {
    classes[sourceName] = info.name
  }

  const css = Buffer.from(code).toString('utf8')
  return { css, classes }
}
