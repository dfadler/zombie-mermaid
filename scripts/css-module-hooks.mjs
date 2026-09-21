/**
 * Node module customization hooks (zombie-mermaid#1103) that let a plain
 * `import styles from './x.module.css'` resolve under `tsx`, without
 * changing how the site generators execute (see this file's registration
 * entry, css-module-register.mjs, and #965's revised-plan comment for the
 * full "why not a runner swap" reasoning).
 *
 * Only `load` needs to intercept anything: the default ESM resolver already
 * turns a relative `./x.module.css` specifier into a `file:` URL just fine
 * (resolution doesn't need to know the file's content type), it's only the
 * *format* step — deciding how to interpret the file's bytes — where a bare
 * `.css` extension has no built-in handling and would otherwise throw
 * `ERR_UNKNOWN_FILE_EXTENSION`. Everything that isn't a `.module.css`
 * specifier is handed straight through to whatever hook is registered
 * underneath this one (`nextLoad`) — chained after tsx's own hook, so its
 * `.ts`/`.tsx` handling is untouched.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { transform } from 'lightningcss'

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

/** @param {string} url */
function isModuleCss(url) {
  return url.endsWith('.module.css')
}

export async function load(url, context, nextLoad) {
  if (!isModuleCss(url)) return nextLoad(url, context)

  const filePath = fileURLToPath(url)
  const source = await readFile(filePath)
  const basename = filePath.split('/').pop() ?? filePath
  const pattern = HASHED_MODULE_CSS_BASENAMES.has(basename)
    ? HASHED_PATTERN
    : UNHASHED_PATTERN

  const { code, exports } = transform({
    filename: filePath,
    code: source,
    cssModules: { pattern },
  })

  /** @type {Record<string, string>} */
  const classes = {}
  for (const [sourceName, info] of Object.entries(exports ?? {})) {
    classes[sourceName] = info.name
  }

  const css = Buffer.from(code).toString('utf8')
  const moduleSource = `export const css = ${JSON.stringify(css)};\nexport default ${JSON.stringify(classes)};\n`

  return { format: 'module', source: moduleSource, shortCircuit: true }
}
