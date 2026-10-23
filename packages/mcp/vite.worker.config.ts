// Second build for @zombie-mermaid/mcp: the render worker (#1856), emitted as
// dist/render-worker.js next to index.js/index.cjs. Run AFTER vite.config.ts
// (whose build empties dist/). One self-contained ESM file serves both the ESM
// and CJS entries: Worker loads it by URL, and .js is ESM in this package.
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { sharedBuild } from '../../vite.config.package.ts'

export default defineConfig({
  root: import.meta.dirname,
  publicDir: false,
  logLevel: 'warn',
  build: {
    ...sharedBuild,
    outDir: resolve(import.meta.dirname, 'dist'),
    ssr: resolve(import.meta.dirname, 'src/tools/render-worker.ts'),
    rolldownOptions: {
      ...sharedBuild.rolldownOptions,
      // Bundle relative sources only; bare specifiers resolve from node_modules at runtime.
      external: (id: string) => !/^(\.|\/|[A-Za-z]:[\\/])/.test(id),
      output: {
        ...sharedBuild.rolldownOptions.output,
        format: 'es',
        entryFileNames: 'render-worker.js',
      },
    },
  },
})
