/**
 * Builds the published `zombie-mermaid` package with Vite's library mode,
 * replacing `tsup` (see zombie-mermaid#309). This is a standalone Node
 * script rather than a single `vite.config.ts` because the JS output and
 * the `.d.ts`/`.d.cts` output need two genuinely different build shapes:
 *
 * - JS: each public entry point (`.`, `./ascii`) must be fully
 *   self-contained, with no shared runtime chunk between them — matching
 *   tsup's `splitting: false`. Rollup/Rolldown's default multi-entry
 *   behavior is the opposite: it factors shared modules (e.g. `parser.ts`,
 *   used by both `src/index.ts` and `src/ascii/index.ts`) into a separate
 *   chunk file. Running each entry as its own single-entry `vite build()`
 *   call avoids that — nothing is shared *across* calls, so nothing can be
 *   factored out.
 * - Types: `unplugin-dts`'s `bundleTypes` (the option that rolls a whole
 *   entry's types into one file, like tsup's dts step does) only resolves
 *   each entry's output filename against `package.json`'s `types` field
 *   when the build has a single lib entry — every single-entry build would
 *   otherwise collide on `dist/index.d.ts` regardless of which source file
 *   it's actually bundling. Feeding it BOTH entries in one multi-entry
 *   build sidesteps that (it names outputs after the entry keys instead),
 *   which also mirrors what tsup's own dts step already does: `ascii`'s
 *   declarations already share an internal chunk with `index`'s in the
 *   current tsup output, so a combined types pass isn't a new behavior.
 *
 * Matches tsup.config.ts's previous two build groups:
 *   1. Library entries (`index`, `ascii`, `mcp`) — dual ESM+CJS, `.d.ts`/`.d.cts`.
 *   2. CLI entry (`cli`) — ESM only, no types, shebang banner, executable.
 *
 * Usage: `pnpm run build` (`tsx scripts/build-lib.ts`).
 */

import {
  rm,
  chmod,
  readdir,
  rename,
  readFile,
  writeFile,
} from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { build, type LibraryFormats } from 'vite'
import dts from 'unplugin-dts/vite'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DIST = resolve(ROOT, 'dist')
const TYPES_TMP = resolve(ROOT, '.dts-tmp')

// Both are real npm dependencies (see package.json) kept external rather
// than bundled — matches tsup.config.ts's `external` list. Unlike esbuild
// (which tsup uses), Rollup/Rolldown's `external` only matches an exact
// import specifier, not a package-name prefix — `external: ['elkjs']`
// would NOT cover `src/elk-instance.ts`'s `import ELKBundled from
// 'elkjs/lib/elk.bundled.js'`, silently inlining elkjs's entire (huge)
// UMD bundle into `dist/index.js`/`dist/index.cjs`. A prefix-matching
// function closes that gap for any current or future subpath import.
//
// `@modelcontextprotocol/sdk` and `zod` are only needed by the `mcp` entry
// (and, transitively, the CLI's `mcp` subcommand, src/cli/mcp.ts) — kept
// external here too so they never end up bundled into `dist/index.*` or
// `dist/ascii.*`, matching tsup.config.ts's per-entry `external` lists.
function isExternal(id: string): boolean {
  return (
    id === 'elkjs' ||
    id.startsWith('elkjs/') ||
    id === 'entities' ||
    id.startsWith('entities/') ||
    id === '@modelcontextprotocol/sdk' ||
    id.startsWith('@modelcontextprotocol/sdk/') ||
    id === 'zod' ||
    id.startsWith('zod/')
  )
}

async function buildLibraryEntry(
  name: string,
  entryFile: string,
): Promise<void> {
  await build({
    root: ROOT,
    configFile: false,
    logLevel: 'warn',
    // No `public/` copying into a library build — those are demo-site
    // assets (favicons, OG image), never part of the published package.
    publicDir: false,
    build: {
      outDir: DIST,
      // Cleaned once up front, before any of these builds run (see main()
      // below) — each individual build must NOT empty the dir, or a later
      // entry's build would wipe out an earlier entry's output.
      emptyOutDir: false,
      target: 'es2022',
      sourcemap: true,
      lib: {
        entry: entryFile,
        formats: ['es', 'cjs'] as LibraryFormats[],
        fileName: (format) => `${name}.${format === 'es' ? 'js' : 'cjs'}`,
      },
      rollupOptions: {
        external: isExternal,
      },
    },
  })
}

/**
 * Builds the `mcp` entry (`src/mcp/index.ts` -> `dist/mcp.{js,cjs}`). Split
 * into two separate `build()` calls, unlike `buildLibraryEntry`'s single
 * dual-format call, because the CJS half needs extra handling that would be
 * wrong to apply to the ESM half:
 *
 * - `ssr: true` on both — this entry transitively imports `node:module`
 *   (via `src/package-info.ts`, used by `src/mcp/server.ts` for
 *   `Implementation.version`); without it Vite's browser-oriented default
 *   externalizes that behind a non-functional shim (see `buildCli`'s own
 *   comment on the same issue).
 * - The CJS half additionally needs a fix for `src/package-info.ts`'s
 *   `createRequire(import.meta.url)`: `import.meta` isn't valid syntax in
 *   CJS, and Rolldown's CJS output — unlike esbuild (tsup) or classic
 *   Rollup, neither of which needed this — doesn't auto-polyfill a bare
 *   `import.meta.url` access; left alone it silently rewrites `import.meta`
 *   to `{}`, turning `createRequire(import.meta.url)` into
 *   `createRequire(undefined)`, which throws at runtime
 *   (`dist/mcp.cjs`'s `getPackageVersion()` would crash any CJS consumer
 *   the moment `createMcpServer()` runs). `define` rewrites the expression
 *   to a placeholder identifier at build time; `rollupOptions.output.intro`
 *   defines that identifier for real, using CJS's own `__filename` (via
 *   `pathToFileURL`) — the same fallback tsup's `shims: true` provided for
 *   this exact file under esbuild (see the removed tsup.config.ts's
 *   comment on the `mcp` entry, in git history).
 * - `rollupOptions.output.entryFileNames` is set explicitly, duplicating
 *   `lib.fileName` — under `ssr: true`, Vite/Rolldown silently ignores
 *   `lib.fileName` and instead names the output chunk after the entry
 *   file's own basename. `src/mcp/index.ts` and `src/index.ts` both have
 *   basename `index`, so without this override both `build()` calls below
 *   would emit `dist/index.js`/`dist/index.cjs` — silently clobbering the
 *   real `index` entry's output (verified: reproduced the collision, then
 *   confirmed `entryFileNames` fixes it, before adding this override).
 */
async function buildMcpEntry(): Promise<void> {
  const entryFile = resolve(ROOT, 'src/mcp/index.ts')

  await build({
    root: ROOT,
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    build: {
      outDir: DIST,
      emptyOutDir: false,
      target: 'es2022',
      sourcemap: true,
      ssr: true,
      lib: {
        entry: entryFile,
        formats: ['es'] as LibraryFormats[],
        fileName: () => 'mcp.js',
      },
      rollupOptions: {
        external: isExternal,
        output: {
          entryFileNames: 'mcp.js',
        },
      },
    },
  })

  await build({
    root: ROOT,
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    define: {
      'import.meta.url': '__zombie_mermaid_import_meta_url__',
    },
    build: {
      outDir: DIST,
      emptyOutDir: false,
      target: 'es2022',
      sourcemap: true,
      ssr: true,
      lib: {
        entry: entryFile,
        formats: ['cjs'] as LibraryFormats[],
        fileName: () => 'mcp.cjs',
      },
      rollupOptions: {
        external: isExternal,
        output: {
          entryFileNames: 'mcp.cjs',
          intro:
            'var __zombie_mermaid_import_meta_url__ = ' +
            'require("node:url").pathToFileURL(__filename).href;',
        },
      },
    },
  })
}

async function buildCli(): Promise<void> {
  const entryFile = resolve(ROOT, 'src/cli.ts')
  await build({
    root: ROOT,
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    build: {
      outDir: DIST,
      emptyOutDir: false,
      target: 'es2022',
      // Vite's library mode defaults to a browser-oriented build: it
      // "externalizes" node: built-ins (node:module, node:http, node:fs/
      // promises — all used by the CLI's own `src/cli.ts`/`src/cli/**`)
      // behind a browser polyfill shim instead of leaving them as real
      // Node imports — `createRequire` from that shim isn't callable,
      // breaking the CLI at startup (`(0, n.createRequire) is not a
      // function`). `ssr: true` switches Vite to its Node-targeted
      // resolution, which imports node: built-ins for real instead.
      ssr: true,
      // tsup's CLI config used sourcemap: false — the CLI is a standalone
      // executable, not a debugged-by-consumers library entry.
      sourcemap: false,
      lib: {
        entry: entryFile,
        formats: ['es'] as LibraryFormats[],
        fileName: () => 'cli.js',
      },
      rollupOptions: {
        external: isExternal,
        output: {
          // Matches tsup's `banner: { js: '#!/usr/bin/env node' }` — lets
          // `dist/cli.js` run directly via the `bin` mechanism.
          banner: '#!/usr/bin/env node',
          // Under `ssr: true`, Vite/Rolldown ignores `lib.fileName` and
          // names the output chunk after the entry file's own basename
          // instead (harmless here only because `src/cli.ts`'s basename
          // already happens to be `cli` — see `buildMcpEntry`'s doc
          // comment, which hit the same behavior for real when its entry's
          // basename didn't match). Set explicitly so this doesn't become a
          // silent collision risk if the CLI entry ever moves/renames.
          entryFileNames: 'cli.js',
        },
      },
    },
  })
  // tsup marks its shebang-banner CLI output executable; Rollup/Vite don't.
  await chmod(resolve(DIST, 'cli.js'), 0o755)
}

/**
 * Generates `index.d.ts`, `ascii.d.ts`, and `mcp.d.ts` in one combined,
 * multi-entry build (see the module doc comment for why this has to be
 * separate from the JS builds above). Runs into a throwaway directory since
 * this pass's *JS* output isn't the real one — only the `.d.ts` files it writes get
 * kept, and only in the ESM ('es') format: `unplugin-dts`'s per-format
 * `.d.cts` output only kicks in when each format gets its own `outDir`
 * (it doesn't when both formats share one, as they do here to match
 * tsup's flat `dist/` layout), so this only asks for 'es'.
 *
 * The `.d.cts` twin is produced afterward, in main(), by copying the
 * `.d.ts` file byte-for-byte — safe because `bundleTypes` rolls each entry
 * into one fully self-contained file with no *relative* imports to other
 * declaration files whose extension would need to differ between the ESM
 * and CJS variant (unlike tsup's own `index.d.ts`/`index.d.cts`, which only
 * differed in the extension of an internal cross-file import). A bare
 * package-specifier import (e.g. `import { ElkNode } from 'elkjs'`, surfaced
 * once `LayoutCache`'s public type started referencing it) is fine to
 * duplicate verbatim too — Node resolves a bare specifier the same way
 * regardless of the importing file's own module format, so only a
 * *relative* import (`./`, `../`) would need special-casing here.
 */
async function buildTypes(): Promise<void> {
  await build({
    root: ROOT,
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    plugins: [
      dts({
        tsconfigPath: resolve(ROOT, 'tsconfig.json'),
        // Never process test files reachable via tsconfig's broad
        // `src/**/*` include — they aren't part of the public API and
        // some rely on devDependency-only ambient types (vitest, jsdom).
        exclude: ['src/__tests__/**', '**/*.test.ts'],
        // Roll each entry's declarations into a single bundled `.d.ts`
        // (via @microsoft/api-extractor), matching tsup's dts output —
        // one file per public entry point, not one per source module.
        bundleTypes: true,
      }),
    ],
    build: {
      outDir: TYPES_TMP,
      emptyOutDir: true,
      target: 'es2022',
      sourcemap: false,
      lib: {
        entry: {
          index: resolve(ROOT, 'src/index.ts'),
          ascii: resolve(ROOT, 'src/ascii/index.ts'),
          mcp: resolve(ROOT, 'src/mcp/index.ts'),
        },
        formats: ['es'] as LibraryFormats[],
      },
      rollupOptions: {
        external: isExternal,
      },
    },
  })

  const dtsFiles = (await readdir(TYPES_TMP)).filter((file) =>
    file.endsWith('.d.ts'),
  )
  if (dtsFiles.length !== 3) {
    throw new Error(
      `Expected exactly index.d.ts, ascii.d.ts, and mcp.d.ts in ${TYPES_TMP}, found: ${dtsFiles.join(', ')}`,
    )
  }
  const contents = await Promise.all(
    dtsFiles.map((file) => readFile(resolve(TYPES_TMP, file), 'utf-8')),
  )
  for (const [i, file] of dtsFiles.entries()) {
    if (
      /^(?:import|export\s+[^;]*from)\s[^;]*from\s*['"]\.\.?\//m.test(
        contents[i]!,
      )
    ) {
      throw new Error(
        `${file} has a relative import/re-export — no longer safe to duplicate verbatim ` +
          `as its .d.cts twin. Update buildTypes()'s .d.cts generation to handle that.`,
      )
    }
  }
  await Promise.all(
    dtsFiles.flatMap((file, i) => {
      const dctsFile = file.replace(/\.d\.ts$/, '.d.cts')
      return [
        rename(resolve(TYPES_TMP, file), resolve(DIST, file)),
        writeFile(resolve(DIST, dctsFile), contents[i]!),
      ]
    }),
  )
  await rm(TYPES_TMP, { recursive: true, force: true })
}

async function main(): Promise<void> {
  await rm(DIST, { recursive: true, force: true })
  await buildLibraryEntry('index', resolve(ROOT, 'src/index.ts'))
  await buildLibraryEntry('ascii', resolve(ROOT, 'src/ascii/index.ts'))
  await buildMcpEntry()
  await buildCli()
  await buildTypes()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
