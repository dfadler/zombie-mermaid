// ============================================================================
// zombie-mermaid/mcp — thin re-export of @zombie-mermaid/mcp
//
// The umbrella's `./mcp` public entry point. As of #769, @zombie-mermaid/mcp
// is a real, independently-built dependency (see package.json and
// vite.config.lib.ts's `isExternal`) rather than bundled straight into
// dist/mcp.js — this file is the umbrella's own build entry for that public
// path, and re-exports the package's full public surface (`createMcpServer`)
// unchanged. Per the ADR (docs/decisions/monorepo-conversion.md / #622),
// @zombie-mermaid/mcp deliberately stays an internal dependency of this
// umbrella rather than getting its own differently-named public npm
// listing — this file is exactly that: `zombie-mermaid/mcp` is still the
// only path consumers use.
//
// Not itself imported by anything inside this repo (src/cli/mcp.ts imports
// @zombie-mermaid/mcp directly, same as this file does); it only exists as
// a build entry (see the `mcp_es`/`mcp_cjs` environments in
// vite.config.lib.ts).
// ============================================================================

export * from '@zombie-mermaid/mcp'
