/** @jsxRuntime automatic */
/**
 * `primitivesCss()` and `PrimitivesStyle()` — split out of primitives.tsx
 * (zombie-mermaid#938, part of the #931 umbrella: opening a CSS Modules
 * seam behind the `*Css()` string-generator functions).
 *
 * ## Why this is a separate file from the components it styles
 *
 * `primitives.tsx`'s `Card`/`Pill`/`SectionEyebrow`/`CTA` are shared
 * between SSR (`*-page.tsx`) and browser-hydrated (`*-app.tsx`) code —
 * every page's client bundle renders at least one of them. This module
 * resolves `primitives.module.css` through `scripts/css-module-hooks.mjs`'s
 * `compileModuleCss()` (zombie-mermaid#1103's Lightning CSS-based loader
 * hook, called directly rather than through a live `.module.css` import —
 * see that file's header comment for why), which reads the file itself via
 * `node:fs/promises` and calls into `lightningcss`'s native binding —
 * Node built-ins that don't exist in a browser.
 *
 * Module-level code runs on import regardless of which export a caller
 * actually wants, so if this file's `await compileModuleCss(...)` lived in
 * primitives.tsx instead, merely importing `Card` for a client bundle
 * would drag that whole Node dependency chain into the browser bundle too
 * — confirmed empirically while building this seam (zombie-mermaid#938):
 * `scripts/vite-bundle.ts`'s `bundleForBrowser()` (used to build every
 * page's client bundle) started warning that `child_process`/`fs`/`tty`
 * were "externalized for browser compatibility," and the resulting bundle
 * would throw the moment a real browser evaluated its top-level `await`.
 * Splitting this into its own file — imported only by the SSR-only
 * `*-page.tsx` files that actually call `primitivesCss()`/
 * `PrimitivesStyle()` — keeps that dependency out of every client bundle's
 * import graph entirely, rather than merely tree-shaken from it.
 *
 * `primitives.module.css`'s classes are hashed (zombie-mermaid#969; see
 * `scripts/css-module-hooks.mjs`'s `HASHED_MODULE_CSS_BASENAMES`), so the
 * compiled stylesheet's selectors and primitives.tsx's className values
 * only stay in sync because both are ultimately produced from this same
 * file's content — primitives.tsx imports the committed classes map
 * `scripts/generate-primitives-classes.ts` generates from it, rather than
 * a literal string.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileModuleCss } from '../../scripts/css-module-hooks.mjs'

/**
 * Resolves this file's `./primitives.module.css` sibling to a real
 * filesystem path.
 *
 * Vitest's jsdom test environment (`demo-primitives.test.ts` renders
 * `Card`/`Pill`/etc via React Testing Library, and needs a live DOM for
 * that) transforms every module a jsdom-environment test reaches as if it
 * will run in a real browser — part of that, Vite rewrites
 * `import.meta.url` to a synthetic dev-server URL
 * (`http://localhost:<port>/<repo-relative-path>`) instead of the real
 * `file://` path a plain Node/`tsx` execution — or a non-jsdom Vitest test
 * — gets, so `fileURLToPath` throws on it directly (mirrors the identical
 * problem the deleted `scripts/load-css-module.ts`'s own `toFilePath`
 * documented and solved the same way).
 */
function siblingCssPath(): string {
  const url = new URL('./primitives.module.css', import.meta.url)
  if (url.protocol === 'file:') return fileURLToPath(url)
  return resolvePath(process.cwd(), `.${url.pathname}`)
}

/**
 * `primitives.module.css` compiled once at module load. A top-level
 * `await` here means every module that imports this one (only SSR
 * `*-page.tsx` files today — see this file's header comment) waits on it
 * resolving once.
 */
const { css: PRIMITIVES_CSS } = await compileModuleCss(siblingCssPath())

/**
 * The `.card`, `.pill`, `.section-eyebrow`, and `.mono` rules, transcribed
 * from the sixteen showcase artboards' shared style preamble (see
 * primitives.tsx's header comment) into `primitives.module.css`.
 *
 * Emit this once per page, after tokens.tsx's `designBaseCss()` — the rules
 * reference the custom properties that block defines.
 */
export function primitivesCss(): string {
  return PRIMITIVES_CSS
}

/** {@link primitivesCss} in a `<style>` element, for a page's `<head>`. */
export function PrimitivesStyle() {
  return <style>{primitivesCss()}</style>
}
