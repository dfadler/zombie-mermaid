/**
 * Bundle a single browser-facing entry point through Vite's own `build()`
 * API, returning the result as an in-memory ES module string.
 *
 * Used by the bundle-size scripts and the visual-test harness (the site
 * build itself bundles its client entries as Vite environments, see
 * vite.site.config.ts). Vite's normal build pipeline is built around
 * `index.html` as the entry and writing a multi-file `dist/`, which doesn't
 * fit that model — but its underlying JS bundler is reachable directly via
 * `build()` with `rolldownOptions.input` pointed at a script instead of an
 * HTML file, `write: false` to keep the result in memory, and
 * `codeSplitting: false` to force a single output chunk (there is only one
 * entry point and no `import()` calls to split off). That's what this
 * wraps, standing in for the `esbuild.build()` calls these generators used
 * previously (Vite 8 build API: https://vite.dev/guide/api-javascript#build). See zombie-mermaid#310.
 */
import { fileURLToPath } from 'node:url'
import { build as viteBuild, type Plugin } from 'vite'

// Resolve workspace packages from source, mirroring tsconfig.json `paths` and
// config/vitest.config.ts. Their package.json `exports` point at `dist/`, so
// without this a stale (or missing) dist breaks the bundle, e.g. a
// `registerElk` MISSING_EXPORT (#1754).
const WORKSPACE_PACKAGES = [
  'core',
  'mermaid-parser',
  'svg-renderer',
  'ascii-renderer',
  'mcp',
]
const workspaceAliases = Object.fromEntries(
  WORKSPACE_PACKAGES.map((name) => [
    `@zombie-mermaid/${name}`,
    fileURLToPath(new URL(`../packages/${name}/src/index.ts`, import.meta.url)),
  ]),
)

export interface BundleForBrowserOptions {
  /**
   * Minify the output. Left off for scripts meant to stay readable in
   * devtools (unminified output also keeps source comments, since Vite/
   * Rollup — unlike esbuild — preserves them by default when not
   * minifying).
   */
  minify: boolean
  /**
   * Disable Rollup's tree-shaking for this bundle. Defaults to `true`
   * (tree-shaking on), matching every existing caller's behavior.
   *
   * Set `false` for a bundle whose entry point exists purely to run a
   * fixed set of modules for their top-level side effects (event listener
   * registration, DOM setup) rather than to export a computed value — e.g.
   * editor/js/index.ts, the entry editor.ts bundles in place of its old
   * hand-concatenated `editor/js/*.js` files (zombie-mermaid#766). This
   * repo's root package.json declares `"sideEffects": false` for the
   * *published* library's own tree-shaking guarantee to consumers; Vite/
   * Rollup honor that same field for any local module resolved from this
   * package, editor/js included, when deciding whether an unused module or
   * statement can be dropped. A concatenation-replacement bundle needs the
   * opposite guarantee — every statement in every included module must
   * survive untouched, exactly as blind string concatenation would have
   * kept it — so tree-shaking is fully disabled here rather than trusting
   * per-module `@__PURE__`-style analysis to reach the same conclusion.
   */
  treeshake?: boolean
  /** Output format; defaults to `'es'`. The visual harness needs `'iife'`. */
  format?: 'es' | 'iife'
}

/**
 * Bundle `entryPath` (an absolute path to a `.ts` file) for the browser as
 * a single ESM string, with no `<script>`/HTML handling involved.
 */
export async function bundleForBrowser(
  entryPath: string,
  options: BundleForBrowserOptions,
): Promise<string> {
  return buildChunk(entryPath, options)
}

const VIRTUAL_ENTRY = '\0virtual-entry'

/**
 * Bundle (and minify) an in-memory ES module `contents`, resolving its
 * imports from `resolveDir` — the Vite stand-in for esbuild's `stdin`
 * option, used by the bundle-size scripts (#2066).
 */
export function bundleSource(
  contents: string,
  resolveDir: string,
): Promise<string> {
  // No workspace aliases: these scripts measure what ships, i.e. `dist/`.
  return buildChunk(
    VIRTUAL_ENTRY,
    { minify: true },
    [
      {
        name: 'virtual-entry',
        resolveId(source, importer, opts) {
          if (source === VIRTUAL_ENTRY) return source
          if (importer !== VIRTUAL_ENTRY) return null
          return this.resolve(source, `${resolveDir}/__virtual__.js`, {
            ...opts,
            skipSelf: true,
          })
        },
        load: (id) => (id === VIRTUAL_ENTRY ? contents : null),
      },
    ],
    false,
    // Measure the entry chunk only: a real bundler splits lazy `import()`
    // chunks (e.g. the embedded font) off, so they aren't initial weight.
    true,
  )
}

async function buildChunk(
  entryPath: string,
  { minify, treeshake = true, format = 'es' }: BundleForBrowserOptions,
  plugins: Plugin[] = [],
  alias = true,
  codeSplitting = false,
): Promise<string> {
  const result = await viteBuild({
    plugins,
    // Skip loading vite.config.ts entirely — its plugin is dev-server-only
    // (rebuild-on-change + serving generated HTML) and irrelevant here.
    configFile: false,
    // Vite's own "building for production..." banner would otherwise mix
    // into these generators' own progress logging.
    logLevel: 'warn',
    resolve: { alias: alias ? workspaceAliases : {} },
    build: {
      write: false,
      minify,
      target: 'esnext',
      // Vite 8 renamed `rollupOptions` to `rolldownOptions`
      // (https://vite.dev/config/build-options#build-rolldownoptions).
      rolldownOptions: {
        input: entryPath,
        treeshake,
        // Keep the entry's exports: bundleSource entries are pure re-exports.
        preserveEntrySignatures: 'strict',
        output: {
          format,
          codeSplitting,
          entryFileNames: 'bundle.js',
        },
      },
    },
  })

  const output = Array.isArray(result) ? result[0] : result
  if (!output || !('output' in output)) {
    throw new Error(
      `Vite build of ${entryPath} returned no output (unexpected watch mode?)`,
    )
  }
  const chunk = output.output.find(
    (item) => item.type === 'chunk' && item.isEntry,
  )
  if (!chunk || chunk.type !== 'chunk') {
    throw new Error(`Vite build of ${entryPath} produced no JS chunk`)
  }
  return chunk.code
}
