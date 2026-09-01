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
  // MCP server build — its own entry (-> dist/mcp.*) so embedding the MCP
  // server (`zombie-mermaid/mcp`) is a separate opt-in from the root/ascii
  // exports, and so @modelcontextprotocol/sdk + zod (only needed here)
  // never end up in those bundles. `clean: false` because the library
  // build above already clears dist/ once per `tsup` invocation.
  //
  // `shims: true` — src/package-info.ts uses `createRequire(import.meta.url)`
  // to read package.json, which only works as-written under ESM;
  // `import.meta.url` is empty in a cjs bundle. tsup's cjs shim replaces
  // it with a `__filename`-derived equivalent so dist/mcp.cjs resolves the
  // same path correctly instead of throwing at runtime.
  {
    entry: { mcp: 'src/mcp/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    target: 'es2022',
    outDir: 'dist',
    external: ['elkjs', 'entities', '@modelcontextprotocol/sdk', 'zod'],
    shims: true,
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
    external: ['elkjs', 'entities', '@modelcontextprotocol/sdk', 'zod'],
    banner: { js: '#!/usr/bin/env node' },
  },
])
