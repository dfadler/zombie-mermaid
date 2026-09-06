// ============================================================================
// PNG output — rasterizes an already-rendered SVG string via the optional
// `@resvg/resvg-js` native dependency (see package.json's
// `optionalDependencies`).
//
// Loaded lazily (`await import(...)`) so the vast majority of invocations —
// `--ascii`, `--svg`, `--html` — never touch the native binary. pnpm installs
// the optional dependency by default but silently skips it if the platform
// build fails, and `--no-optional` guarantees it's never pulled at all; in
// both of those cases the dynamic import throws, and this module turns that
// into one clear, actionable error instead of a bare "Cannot find package"
// stack trace. See GitHub issue #456 (item 4) for the design rationale.
// ============================================================================

/**
 * Rasterize `svg` to PNG bytes at the SVG's own declared pixel dimensions —
 * 1:1, no scaling. Callers are expected to have already resolved the SVG's
 * CSS custom properties (`renderMermaidSVG(..., { resolveColors: true })`):
 * resvg, like every non-browser SVG consumer, doesn't evaluate `var()`/
 * `color-mix()`, and would otherwise rasterize the whole theme to black.
 */
export async function renderPng(svg: string): Promise<Buffer> {
  let resvg: typeof import('@resvg/resvg-js')
  try {
    resvg = await import('@resvg/resvg-js')
  } catch (importError) {
    const detail =
      importError instanceof Error ? importError.message : String(importError)
    throw new Error(
      '--png requires the optional dependency "@resvg/resvg-js", which is not installed ' +
        '(it may have failed to build for this platform, or the install ran with ' +
        '--no-optional). Install it with `pnpm add @resvg/resvg-js` (or the npm/yarn ' +
        `equivalent) and try again.\n${detail}`,
    )
  }
  const rendered = await resvg.renderAsync(svg)
  return rendered.asPng()
}
