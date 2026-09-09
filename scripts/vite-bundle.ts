/**
 * Bundle a single browser-facing entry point through Vite's own `build()`
 * API, returning the result as an in-memory ES module string.
 *
 * index.ts and editor.ts each generate one self-contained HTML file with
 * the bundled client script inlined directly into a `<script
 * type="module">` tag (see vite.config.ts's header comment for why that
 * model is deliberate). Vite's normal build pipeline is built around
 * `index.html` as the entry and writing a multi-file `dist/`, which doesn't
 * fit that model — but its underlying JS bundler is reachable directly via
 * `build()` with `rollupOptions.input` pointed at a script instead of an
 * HTML file, `write: false` to keep the result in memory, and
 * `codeSplitting: false` to force a single output chunk (there is only one
 * entry point and no `import()` calls to split off). That's what this
 * wraps, standing in for the `esbuild.build()` calls these generators used
 * previously. See zombie-mermaid#310.
 */
import { build as viteBuild } from 'vite'

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
}

/**
 * Bundle `entryPath` (an absolute path to a `.ts` file) for the browser as
 * a single ESM string, with no `<script>`/HTML handling involved.
 */
export async function bundleForBrowser(
  entryPath: string,
  { minify, treeshake = true }: BundleForBrowserOptions,
): Promise<string> {
  const result = await viteBuild({
    // Skip loading vite.config.ts entirely — its plugin is dev-server-only
    // (rebuild-on-change + serving generated HTML) and irrelevant here.
    configFile: false,
    // Vite's own "building for production..." banner would otherwise mix
    // into these generators' own progress logging.
    logLevel: 'warn',
    build: {
      write: false,
      minify,
      target: 'esnext',
      rollupOptions: {
        input: entryPath,
        treeshake,
        output: {
          format: 'es',
          codeSplitting: false,
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
  const chunk = output.output.find((item) => item.type === 'chunk')
  if (!chunk || chunk.type !== 'chunk') {
    throw new Error(`Vite build of ${entryPath} produced no JS chunk`)
  }
  return chunk.code
}
