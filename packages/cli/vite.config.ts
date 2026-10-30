/**
 * Builds `@zombie-mermaid/cli` (#1946): the same `src/cli.ts` the umbrella's
 * `cli` environment (config/vite.config.lib.ts) bundles, published on its own
 * so `npx @zombie-mermaid/cli` doesn't install the library's other entries.
 * One source, two bundles — the CLI is not forked. Relative imports (including
 * the reach-through into sibling packages' `src/`) are bundled; every bare
 * specifier stays external and must be a `dependencies` entry of this package.
 */
import { chmod } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = import.meta.dirname

export default defineConfig({
  root,
  publicDir: false,
  logLevel: 'warn',
  plugins: [
    {
      name: 'zombie-mermaid:cli-executable',
      async closeBundle() {
        await chmod(resolve(root, 'dist/cli.js'), 0o755)
      },
    },
  ],
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
    minify: true,
    sourcemap: false,
    ssr: resolve(root, '../../src/cli.ts'),
    rolldownOptions: {
      external: (id: string) => !/^(\.|\/|[A-Za-z]:[\\/])/.test(id),
      output: {
        banner: '#!/usr/bin/env node',
        entryFileNames: 'cli.js',
      },
    },
  },
})
