// Library build for @zombie-mermaid/core — see ../../vite.config.package.ts
// for the shared factory and its rationale (issue #769).
import { resolve } from 'node:path'
import { definePackageBuild } from '../../vite.config.package.ts'

export default definePackageBuild({
  root: import.meta.dirname,
  entry: resolve(import.meta.dirname, 'src/index.ts'),
})
