/**
 * Builds the published `zombie-mermaid` package with Vite's library mode —
 * one declarative config, built with `vite build --app` (Vite's builder
 * mode, which builds every configured environment in order). Replaces the
 * imperative `scripts/build-lib.ts` (zombie-mermaid#404), which drove the
 * same six builds by hand as separate `vite build()` calls. See
 * zombie-mermaid#378 for the original tsup -> Vite move.
 *
 * Why six environments rather than one multi-entry `build.lib`: each public
 * JS entry (`.`, `./ascii`, `./mcp`) must be fully self-contained, with no
 * shared runtime chunk between them (tsup's `splitting: false`). Rolldown's
 * multi-entry default is the opposite — it factors modules shared between
 * entries (`parser.ts`, say) into a separate chunk — and its only
 * no-splitting switch, `output.codeSplitting: false`, is rejected outright
 * for multi-input builds (`[INVALID_OPTION] ... multiple inputs are not
 * supported when "output.codeSplitting" is false`, Rolldown 1.2.x). One
 * environment per entry keeps each build single-input, so nothing can be
 * shared across them — the same isolation the old script got from separate
 * `build()` calls, now expressed as config.
 *
 * Environment gotchas this config works around (each verified against the
 * old script's output byte-for-byte — keep them in mind when editing):
 *
 * - The top-level `build` block IS the `client` environment's config, and
 *   every other environment is `mergeConfig(topLevel, env)`. `mergeConfig`
 *   CONCATENATES arrays, so `lib.formats` (and any other array) must never
 *   be set at the top level: `formats: ['es', 'cjs']` up here would turn an
 *   environment's `['es']` into `['es', 'cjs', 'es']` — three passes, two of
 *   them writing the wrong format to the same filename, with the final
 *   bytes only "right" by write order. Every environment declares its own
 *   `formats` for that reason.
 * - `lib.entry` does live at the top level (as the `index` entry) because
 *   `vite build --app` resolves the config once up front, before any
 *   environment, with the bare top-level `build` — and unplugin-dts's
 *   `configResolved` warns ("may not need to generate declaration files")
 *   whenever it sees a config with no `lib`.
 * - Plugins that need `configResolved` must be registered at the top level
 *   and scoped with `applyToEnvironment`; a plugin *returned from*
 *   `applyToEnvironment` (or `perEnvironmentPlugin`) is attached after the
 *   config is already resolved and never receives that hook. unplugin-dts
 *   reads `build.lib.entry`/`build.outDir` there, so wrapping it the second
 *   way makes it silently fall back to `package.json`'s `types` path and
 *   emit a single `dist/index.d.ts` for whatever entry it saw first.
 * - Environments other than `client` default to `consumer: 'server'`
 *   (Vite's `build.ssr: true`): node: built-ins stay real imports instead
 *   of a browser shim (the CLI's `createRequire` breaks otherwise — #378),
 *   `minify` defaults to `false`, and `lib.fileName` is ignored in favor of
 *   the entry file's basename. That last one is why `mcp_es`/`mcp_cjs`/`cli`
 *   also set `output.entryFileNames` explicitly: `src/mcp/index.ts` would
 *   otherwise land on `dist/index.js`, clobbering the real `index` entry.
 *
 * Types: unplugin-dts's `bundleTypes` (one api-extractor-rolled `.d.ts` per
 * entry, like tsup's dts step) names its outputs after the entry keys only
 * for a multi-entry build; a single-entry build always resolves to
 * `package.json`'s `types` path, so three single-entry builds would all
 * collide on `dist/index.d.ts`. The `types` environment is therefore the
 * one multi-entry build here — its JS output is discarded
 * (`declarationOnly`), only the three bundled `.d.ts` files are kept, and
 * `afterBuild` writes each one's `.d.cts` twin (see `writeDctsTwins`).
 *
 * Usage: `pnpm run build` (`vite build --app --config vite.config.lib.ts`).
 */

import { chmod, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { defineConfig, type LibraryFormats, type Plugin } from 'vite'
import dts from 'unplugin-dts/vite'

const ROOT = import.meta.dirname
const DIST = resolve(ROOT, 'dist')

// Both are real npm dependencies (see package.json) kept external rather
// than bundled. Unlike esbuild (which tsup used), Rolldown's `external`
// only matches an exact import specifier, not a package-name prefix —
// `external: ['elkjs']` would NOT cover `src/elk-instance.ts`'s
// `import ELKBundled from 'elkjs/lib/elk.bundled.js'`, silently inlining
// elkjs's entire (huge) UMD bundle into `dist/index.js`/`dist/index.cjs`.
// A prefix-matching function closes that gap for any current or future
// subpath import.
//
// `@modelcontextprotocol/sdk` and `zod` are only needed by the `mcp` entry
// (and, transitively, the CLI's `mcp` subcommand, src/cli/mcp.ts) — kept
// external here too so they never end up bundled into `dist/index.*` or
// `dist/ascii.*`.
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

// Vite's library builds default to ['es', 'umd'] for a single entry (and
// umd needs a global name), so every environment spells its formats out —
// and, per the header comment, only ever at the environment level.
const ES_AND_CJS: LibraryFormats[] = ['es', 'cjs']
const ES_ONLY: LibraryFormats[] = ['es']
const CJS_ONLY: LibraryFormats[] = ['cjs']

// tsup marked its shebang-banner CLI output executable; Rollup/Vite don't.
const cliExecutable: Plugin = {
  name: 'zombie-mermaid:cli-executable',
  applyToEnvironment: (env) => env.name === 'cli',
  async closeBundle() {
    await chmod(resolve(DIST, 'cli.js'), 0o755)
  },
}

const RELATIVE_IMPORT_RE =
  /^(?:import|export\s+[^;]*from)\s[^;]*from\s*['"]\.\.?\//m

/**
 * Writes `index.d.cts`, `ascii.d.cts`, and `mcp.d.cts` as byte-for-byte
 * copies of the bundled `.d.ts` files unplugin-dts just emitted (its own
 * per-format `.d.cts` output only kicks in when each format gets its own
 * `outDir`, which they don't here — `dist/` is flat, matching tsup).
 *
 * Copying verbatim is safe because `bundleTypes` rolls each entry into one
 * fully self-contained file with no *relative* imports to other declaration
 * files whose extension would need to differ between the ESM and CJS
 * variant (unlike tsup's own `index.d.ts`/`index.d.cts`, which only
 * differed in the extension of an internal cross-file import). A bare
 * package-specifier import (e.g. `import { ElkNode } from 'elkjs'`, surfaced
 * once `LayoutCache`'s public type started referencing it) is fine to
 * duplicate too — Node resolves a bare specifier the same way regardless of
 * the importing file's own module format — so only a relative import
 * (`./`, `../`) trips the guard below.
 */
async function writeDctsTwins(emitted: Map<string, string>): Promise<void> {
  const files = [...emitted.keys()].filter((file) => file.endsWith('.d.ts'))
  const found = files.map((file) => basename(file)).sort()
  const expected = ['ascii.d.ts', 'index.d.ts', 'mcp.d.ts']
  if (found.join() !== expected.join()) {
    throw new Error(
      `Expected exactly ${expected.join(', ')} from the types build, found: ${found.join(', ') || '(none)'}`,
    )
  }
  await Promise.all(
    files.map((file) => {
      const content = emitted.get(file)!
      if (RELATIVE_IMPORT_RE.test(content)) {
        throw new Error(
          `${basename(file)} has a relative import/re-export — no longer safe to duplicate verbatim ` +
            `as its .d.cts twin. Update writeDctsTwins() to handle that.`,
        )
      }
      return writeFile(file.replace(/\.d\.ts$/, '.d.cts'), content)
    }),
  )
}

export default defineConfig({
  root: ROOT,
  // No `public/` copying into a library build — those are demo-site assets
  // (favicons, OG image), never part of the published package.
  publicDir: false,
  logLevel: 'warn',
  // Opt into building every environment below (what `vite build --app`
  // also implies); without this, `vite build` builds `client` alone.
  builder: {},
  plugins: [
    {
      ...dts({
        tsconfigPath: resolve(ROOT, 'tsconfig.json'),
        // Never process test files reachable via tsconfig's broad
        // `src/**/*` include — they aren't part of the public API and
        // some rely on devDependency-only ambient types (vitest, jsdom).
        exclude: ['src/__tests__/**', '**/*.test.ts'],
        // Roll each entry's declarations into a single bundled `.d.ts`
        // (via @microsoft/api-extractor), matching tsup's dts output —
        // one file per public entry point, not one per source module.
        bundleTypes: true,
        // Drop the `types` environment's JS from its bundle before it's
        // written: that JS is a multi-entry build with shared chunks (see
        // the header), never the real output — and it would land on the
        // same `dist/index.js` etc. the real entries already wrote.
        declarationOnly: true,
        afterBuild: writeDctsTwins,
      }),
      applyToEnvironment: (env) => env.name === 'types',
    },
    cliExecutable,
  ],
  build: {
    outDir: DIST,
    // `client` (the first environment built) empties `dist/` once; every
    // later environment must NOT, or it would wipe the earlier entries'
    // output.
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: true,
    // The `index` entry — this top-level block is the `client` environment
    // (see the header for why the entry has to be here and `formats`
    // can't be).
    lib: {
      entry: resolve(ROOT, 'src/index.ts'),
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rolldownOptions: {
      external: isExternal,
    },
  },
  environments: {
    client: {
      build: {
        emptyOutDir: true,
        lib: { formats: ES_AND_CJS },
      },
    },
    ascii: {
      // Browser-oriented like `index`, not Vite's server default for a
      // non-client environment.
      consumer: 'client',
      build: {
        lib: {
          entry: resolve(ROOT, 'src/ascii/index.ts'),
          formats: ES_AND_CJS,
          fileName: (format) => `ascii.${format === 'es' ? 'js' : 'cjs'}`,
        },
      },
    },
    // `mcp` is split into an ESM and a CJS environment (unlike `index`/
    // `ascii`'s single dual-format builds) because the CJS half needs a
    // `define`/`intro` pair that would be wrong to apply to the ESM half.
    // Both are server-consumer builds: this entry transitively imports
    // `node:module` (via `src/package-info.ts`, used by `src/mcp/server.ts`
    // for `Implementation.version`).
    mcp_es: {
      build: {
        lib: {
          entry: resolve(ROOT, 'src/mcp/index.ts'),
          formats: ES_ONLY,
          fileName: () => 'mcp.js',
        },
        rolldownOptions: {
          output: { entryFileNames: 'mcp.js' },
        },
      },
    },
    mcp_cjs: {
      // `src/package-info.ts`'s `createRequire(import.meta.url)`:
      // `import.meta` isn't valid syntax in CJS, and Rolldown's CJS output
      // — unlike esbuild (tsup) or classic Rollup, neither of which needed
      // this — doesn't auto-polyfill a bare `import.meta.url` access; left
      // alone it silently rewrites `import.meta` to `{}`, turning
      // `createRequire(import.meta.url)` into `createRequire(undefined)`,
      // which throws at runtime (`dist/mcp.cjs`'s `getPackageVersion()`
      // would crash any CJS consumer the moment `createMcpServer()` runs).
      // `define` rewrites the expression to a placeholder identifier at
      // build time; `output.intro` defines that identifier for real, using
      // CJS's own `__filename` (via `pathToFileURL`) — the same fallback
      // tsup's `shims: true` provided for this exact file under esbuild.
      define: {
        'import.meta.url': '__zombie_mermaid_import_meta_url__',
      },
      build: {
        lib: {
          entry: resolve(ROOT, 'src/mcp/index.ts'),
          formats: CJS_ONLY,
          fileName: () => 'mcp.cjs',
        },
        rolldownOptions: {
          output: {
            entryFileNames: 'mcp.cjs',
            intro:
              'var __zombie_mermaid_import_meta_url__ = ' +
              'require("node:url").pathToFileURL(__filename).href;',
          },
        },
      },
    },
    cli: {
      build: {
        // A server-consumer build ships unminified by default (full
        // identifier names, comments, tab indentation) — that alone blew
        // `dist/cli.js` past its bundle-size budget (137.3 KB vs ~94 KB
        // gzipped for the same module set under tsup); it wasn't
        // dependency bloat, `isExternal` already keeps
        // `@modelcontextprotocol/sdk`/`zod` out. Minifying restores parity
        // with the other entries.
        minify: 'esbuild',
        // tsup's CLI config used sourcemap: false — the CLI is a standalone
        // executable, not a debugged-by-consumers library entry.
        sourcemap: false,
        lib: {
          entry: resolve(ROOT, 'src/cli.ts'),
          formats: ES_ONLY,
          fileName: () => 'cli.js',
        },
        rolldownOptions: {
          output: {
            // Matches tsup's `banner: { js: '#!/usr/bin/env node' }` — lets
            // `dist/cli.js` run directly via the `bin` mechanism.
            banner: '#!/usr/bin/env node',
            entryFileNames: 'cli.js',
          },
        },
      },
    },
    // Declarations only — see the header and `writeDctsTwins`. Left on
    // Vite's server-consumer default deliberately: its JS never ships, so
    // there's nothing to minify or shim node: built-ins for.
    types: {
      build: {
        sourcemap: false,
        lib: {
          entry: {
            index: resolve(ROOT, 'src/index.ts'),
            ascii: resolve(ROOT, 'src/ascii/index.ts'),
            mcp: resolve(ROOT, 'src/mcp/index.ts'),
          },
          formats: ES_ONLY,
        },
      },
    },
  },
})
