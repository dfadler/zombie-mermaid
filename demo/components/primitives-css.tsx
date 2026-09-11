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
 * resolves `primitives.module.css` through `scripts/load-css-module.ts`,
 * which calls Vite's own `build()` API and therefore depends on Node
 * built-ins (`fs`, `child_process`, …, transitively through `vite`/
 * `esbuild`) that don't exist in a browser.
 *
 * Module-level code runs on import regardless of which export a caller
 * actually wants, so if this file's `await loadCssModule(...)` lived in
 * primitives.tsx instead, merely importing `Card` for a client bundle
 * would drag that whole Node dependency chain into the browser bundle too
 * — confirmed empirically while building this seam:
 * `scripts/vite-bundle.ts`'s `bundleForBrowser()` (used to build every
 * page's client bundle) started warning that `child_process`/`fs`/`tty`
 * were "externalized for browser compatibility," and the resulting bundle
 * would throw the moment a real browser evaluated its top-level `await`
 * (`vite`'s `build()` fundamentally cannot run without those Node APIs).
 * Splitting this into its own file — imported only by the SSR-only
 * `*-page.tsx` files that actually call `primitivesCss()`/
 * `PrimitivesStyle()` — keeps that dependency out of every client bundle's
 * import graph entirely, rather than merely tree-shaken from it.
 *
 * `primitives.module.css`'s classes are unhashed
 * (`generateScopedName: '[local]'`, see `scripts/load-css-module.ts`), so
 * primitives.tsx's plain string literals (`'card'`, `'pill'`, …) and this
 * file's compiled stylesheet are guaranteed to name the same classes
 * without the two files needing to share any binding.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { loadCssModule } from '../../scripts/load-css-module.ts'

/**
 * `primitives.module.css` resolved once at module load. A top-level
 * `await` here means every module that imports this one (only SSR
 * `*-page.tsx` files today — see this file's header comment) waits on it
 * resolving once; `loadCssModule` caches the compiled result on disk so
 * that's a one-time cost per `primitives.module.css` content, not a Vite
 * build on every process start.
 */
const { css: PRIMITIVES_CSS } = await loadCssModule(
  new URL('./primitives.module.css', import.meta.url),
)

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
