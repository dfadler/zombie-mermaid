// ============================================================================
// zombie-mermaid/ascii — thin re-export of @zombie-mermaid/ascii-renderer
//
// The umbrella's `./ascii` public entry point. As of #769,
// @zombie-mermaid/ascii-renderer is a real, independently-built dependency
// (see package.json and vite.config.lib.ts's `isExternal`) rather than
// bundled straight into dist/ascii.js — this file is the umbrella's own
// build entry for that public path, and re-exports the package's full
// public surface unchanged. Not itself imported by anything inside this
// repo; it only exists as a build entry (see the `ascii` environment in
// vite.config.lib.ts).
// ============================================================================

export * from '@zombie-mermaid/ascii-renderer'
