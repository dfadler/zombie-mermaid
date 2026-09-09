// Library build for @zombie-mermaid/svg-renderer — see
// ../../vite.config.package.ts for the shared factory and its rationale
// (issue #769). Depends on @zombie-mermaid/core and
// @zombie-mermaid/mermaid-parser, which must already be built (see the
// root `build` script's order).
import { resolve } from 'node:path'
import { definePackageBuild } from '../../vite.config.package.ts'

export default definePackageBuild({
  root: import.meta.dirname,
  entry: resolve(import.meta.dirname, 'src/index.ts'),
})
