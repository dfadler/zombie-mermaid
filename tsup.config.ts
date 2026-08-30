import { defineConfig } from 'tsup'

export default defineConfig([
  // Library build (dual ESM/CJS, see package.json `exports`).
  // `src/ascii/index.ts` builds as its own entry (-> dist/ascii.*) so
  // ASCII-only consumers importing `zombie-mermaid/ascii` never pull in
  // elkjs, which the SVG path (src/index.ts) statically imports.
  {
    entry: { index: 'src/index.ts', ascii: 'src/ascii/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    outDir: 'dist',
    external: ['elkjs', 'entities'],
  },
  // CLI build — a standalone executable, not part of the package's
  // `exports` map, so it only needs ESM (matches package.json's
  // "type": "module") with a shebang banner so it runs directly via the
  // `bin` mechanism.
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    target: 'es2022',
    outDir: 'dist',
    external: ['elkjs', 'entities'],
    banner: { js: '#!/usr/bin/env node' },
  },
])
