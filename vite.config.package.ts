/**
 * Shared Vite library-build factory for the five internal `@zombie-mermaid/*`
 * workspace packages (`core`, `mermaid-parser`, `svg-renderer`,
 * `ascii-renderer`, `mcp`) — issue #769, implementing the publish strategy
 * `docs/decisions/monorepo-conversion.md` / issue #622 recommend: each
 * package gets a real, independent build instead of being bundled straight
 * into the umbrella's `dist/*.js` (see `vite.config.lib.ts`, which now
 * treats all five as external rather than inlining them).
 *
 * Each package's own `packages/<name>/vite.config.ts` is a few lines that
 * just calls `definePackageBuild()` below with that package's entry —
 * everything else (dual ESM/CJS JS, one rolled-up `.d.ts`/`.d.cts` pair,
 * what counts as "external") is shared here so the five don't drift.
 *
 * Modeled directly on `vite.config.lib.ts` (the umbrella's own build) and
 * reusing its hard-won gotchas rather than rediscovering them:
 *
 * - `vite build --app` (Vite's builder mode) builds every configured
 *   environment. The top-level `build` block still needs a `lib.entry` even
 *   though every real environment below restates its own `formats`, purely
 *   to stop unplugin-dts's `configResolved` hook warning that the config
 *   has no `lib` — see vite.config.lib.ts's header for the fuller version
 *   of this.
 * - Every environment here is custom-named (`es`/`cjs`/`dts`), never the
 *   literal `client` — so every one of them defaults to `consumer:
 *   'server'` unless told otherwise, and (per that default) `lib.fileName`
 *   is silently ignored in favor of the entry file's own basename unless
 *   `rolldownOptions.output.entryFileNames` is also set. `core`/
 *   `mermaid-parser`/`svg-renderer`/`ascii-renderer` opt into
 *   `consumer: 'client'` (matching vite.config.lib.ts's own `ascii`
 *   environment) since none of their bundled closure touches a Node
 *   built-in, which sidesteps entryFileNames entirely. `mcp` is the one
 *   exception (see `serverConsumer` below).
 *
 * Build ORDER matters, unlike the JS half: each package's own `.d.ts` step
 * resolves any `@zombie-mermaid/*` sibling it depends on through normal
 * package resolution (that sibling's package.json `exports`/`types`, which
 * point at *its* `dist/index.d.ts` post-#769) — so a dependency must
 * already be built before a dependent's dts step runs, or api-extractor
 * will fail trying to resolve a package.json that still points at nothing
 * (or, pre-#769, at raw `.ts` source it can't analyse — see
 * vite.config.lib.ts's dts plugin comment for that exact failure mode).
 * The root `build` script enforces this order: core -> mermaid-parser ->
 * svg-renderer -> ascii-renderer -> mcp -> umbrella.
 *
 * Usage: `vite build --app --config packages/<name>/vite.config.ts`.
 */

import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig, type LibraryFormats } from 'vite'
import dts from 'unplugin-dts/vite'

const REPO_ROOT = import.meta.dirname

export interface PackageBuildOptions {
  /** The package's own directory — pass `import.meta.dirname` from that package's `vite.config.ts`. */
  root: string
  /** Absolute path to the package's single source entry (its `src/index.ts`). */
  entry: string
  /**
   * Set for a package whose bundled (non-external, non-relative) module
   * closure touches a real Node built-in that must not be browser-shimmed
   * — currently only `@zombie-mermaid/mcp`, via its reach-through into the
   * umbrella's `src/package-info.ts` (`createRequire(import.meta.url)`).
   * Mirrors `consumer: 'server'` in vite.config.lib.ts's `mcp_es`/`mcp_cjs`
   * environments, including the same `import.meta.url` CJS shim (see that
   * file's `mcp_cjs` comment for why it's needed) — applied here to this
   * package's own `cjs` environment only, never `es`.
   *
   * @default false
   */
  serverConsumer?: boolean
}

// `\bfrom\b` once, not `from` twice — the previous
// `(?:import|export\s+[^;]*from)\s[^;]*from\s*['"]...` shape required the
// `export` branch to contain the literal "from" twice, so a single-`from`
// relative re-export (`export * from './flowchart'`,
// `export { X } from '../core'`) matched neither alternative and silently
// passed the afterBuild guard below. Caught in PR review (#769) — this
// invariant matters more once these packages are actually published.
const RELATIVE_IMPORT_RE = /^(?:import|export)\s[^;]*\bfrom\s*['"]\.\.?\//m

/**
 * External predicate shared by every package build: bundle only local
 * (relative) source files — including a reach-through outside this
 * package's own `src/` directory, for `ascii-renderer`/`mcp` — and leave
 * every bare-specifier import external, whether it's a sibling
 * `@zombie-mermaid/*` package or a real npm dependency. This is the
 * opposite default from a typical app bundle (Vite's library mode bundles
 * dependencies unless told not to); it's correct here because every bare
 * specifier these five packages import is a real, declared `dependencies`
 * entry meant to be resolved by whatever installs the package for real —
 * see each `packages/<name>/package.json`.
 *
 * A resolved absolute path is always local, never external — `/` covers
 * POSIX; a Windows absolute path starts with a drive letter (`C:\`, `C:/`)
 * instead, which — unlike `.`/`/` — would otherwise be misclassified as a
 * bare external specifier and bundled as if it were a package. This repo's
 * own CI never hits this (Linux runners), but a resolved id can take this
 * shape on a Windows contributor's machine — caught in PR review (#769).
 */
const WINDOWS_ABSOLUTE_PATH_RE = /^[A-Za-z]:[\\/]/

function isExternal(id: string): boolean {
  if (
    id.startsWith('.') ||
    id.startsWith('/') ||
    WINDOWS_ABSOLUTE_PATH_RE.test(id)
  ) {
    return false
  }
  return true
}

const ES_ONLY: LibraryFormats[] = ['es']
const CJS_ONLY: LibraryFormats[] = ['cjs']

export function definePackageBuild(options: PackageBuildOptions) {
  const { root, entry, serverConsumer = false } = options
  const DIST = resolve(root, 'dist')

  return defineConfig({
    root,
    publicDir: false,
    logLevel: 'warn',
    builder: {},
    plugins: [
      {
        ...dts({
          // tsconfig.build.json, not tsconfig.json — the latter overrides
          // `@zombie-mermaid/*` to resolve to source (for live typecheck
          // and the editor; see its own comment), which this dts step must
          // NOT inherit. A build's dts step has to resolve those imports
          // the same way a real downstream consumer would: through each
          // dependency's own built `dist/index.d.ts` (its package.json
          // `exports`/`types`), not straight through to source. Plain JSON
          // (tsc's tsconfig files normally tolerate `//` comments, but this
          // one is kept strict so any parser can read it) — the override is
          // just the one `paths` block below; nothing else differs from
          // tsconfig.json, which `extends` already inherits.
          //
          // Only vite.config.package.ts (this file) uses it — the umbrella
          // build (vite.config.lib.ts) resolves `tsconfig.json` directly,
          // since #769's rework reverted it to bundling `packages/*` by
          // source rather than through their built output.
          tsconfigPath: resolve(REPO_ROOT, 'tsconfig.build.json'),
          exclude: ['src/__tests__/**', '**/*.test.ts'],
          // Rolls this package's entire public surface into one
          // self-contained `.d.ts`, regardless of how many source files —
          // or, for ascii-renderer/mcp, how many directories outside this
          // package's own `src/` — it's assembled from. See this file's
          // header for why that matters for those two packages
          // specifically. Any `@zombie-mermaid/*` sibling this package
          // actually depends on is left as a normal external `import` in
          // the output, not inlined — unlike vite.config.lib.ts's own dts
          // config, nothing here lists `bundledPackages`.
          bundleTypes: true,
          declarationOnly: true,
          afterBuild: async (emitted) => {
            const files = [...emitted.keys()].filter((file) =>
              file.endsWith('.d.ts'),
            )
            if (files.length !== 1) {
              throw new Error(
                `Expected exactly one .d.ts from this package's types build, found: ${
                  files.join(', ') || '(none)'
                }`,
              )
            }
            const file = files[0]!
            const content = emitted.get(file)!
            if (RELATIVE_IMPORT_RE.test(content)) {
              throw new Error(
                `${file} has a relative import/re-export — a single-entry ` +
                  `bundleTypes output should never have one (see this ` +
                  `file's header). Investigate before duplicating it as its ` +
                  `.d.cts twin.`,
              )
            }
            await writeFile(file.replace(/\.d\.ts$/, '.d.cts'), content)
          },
        }),
        applyToEnvironment: (env: { name: string }) => env.name === 'dts',
      },
    ],
    build: {
      outDir: DIST,
      emptyOutDir: false,
      target: 'es2022',
      sourcemap: true,
      // Present only so unplugin-dts's configResolved hook doesn't warn
      // about a lib-less config before any environment is resolved — see
      // this file's header. Every real environment below sets its own
      // `formats`/`fileName`, which fully replace (not merge with) this.
      lib: {
        entry,
        fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
      },
      rolldownOptions: { external: isExternal },
    },
    environments: {
      // Named 'client' deliberately, not e.g. 'es': `vite build --app`
      // always resolves an implicit default 'client' environment from the
      // (formats-less) top-level `build` block above, even when it's never
      // referenced anywhere else — and that default's `formats` resolves
      // to Vite's own `['es', 'umd']`, which fails immediately
      // ("build.lib.name is required when output formats include umd").
      // Naming this environment 'client' overrides that implicit default
      // with real `formats` instead of leaving it to build (and fail) on
      // its own — vite.config.lib.ts never hits this because its own
      // `client` environment is the umbrella's real `index` entry.
      client: {
        consumer: serverConsumer ? 'server' : 'client',
        build: {
          emptyOutDir: true,
          lib: { entry, formats: ES_ONLY, fileName: () => 'index.js' },
          ...(serverConsumer
            ? { rolldownOptions: { output: { entryFileNames: 'index.js' } } }
            : {}),
        },
      },
      cjs: {
        consumer: serverConsumer ? 'server' : 'client',
        // See the `serverConsumer` doc comment: only the CJS half needs
        // this — `import.meta.url` is valid in the ES output as-is.
        ...(serverConsumer
          ? {
              define: {
                'import.meta.url': '__zombie_mermaid_import_meta_url__',
              },
            }
          : {}),
        build: {
          lib: { entry, formats: CJS_ONLY, fileName: () => 'index.cjs' },
          rolldownOptions: {
            output: {
              ...(serverConsumer ? { entryFileNames: 'index.cjs' } : {}),
              ...(serverConsumer
                ? {
                    intro:
                      'var __zombie_mermaid_import_meta_url__ = ' +
                      'require("node:url").pathToFileURL(__filename).href;',
                  }
                : {}),
            },
          },
        },
      },
      dts: {
        consumer: 'client',
        build: {
          sourcemap: false,
          lib: { entry, formats: ES_ONLY },
        },
      },
    },
  })
}
