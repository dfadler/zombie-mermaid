// Library build for @zombie-mermaid/mcp — see ../../vite.config.package.ts
// for the shared factory and its rationale (issue #769). Depends on
// @zombie-mermaid/core, @zombie-mermaid/mermaid-parser,
// @zombie-mermaid/svg-renderer, and @zombie-mermaid/ascii-renderer (already
// built first — see the root `build` script's order), and bundles two files
// outside its own `src/`: `packages/mcp/src/server.ts` imports
// `getPackageVersion` from the umbrella's `../../../src/package-info.ts`,
// and `packages/mcp/src/tools/render-svg.ts` imports the umbrella's own
// `renderMermaidSVG` from `../../../../src/index.ts` (the MCP server is a
// thin adapter around the library's real rendering entry point, not a
// second implementation of it) — both get compiled straight into this
// package's own dist, same as they're already compiled straight into the
// umbrella's own dist/mcp.js today. `serverConsumer: true` is required
// specifically for `src/package-info.ts`'s `createRequire(import.meta.url)`
// — see vite.config.package.ts's `serverConsumer` doc comment.
import { resolve } from 'node:path'
import { definePackageBuild } from '../../vite.config.package.ts'

export default definePackageBuild({
  root: import.meta.dirname,
  entry: resolve(import.meta.dirname, 'src/index.ts'),
  serverConsumer: true,
})
