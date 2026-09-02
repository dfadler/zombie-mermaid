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
}

/**
 * Bundle `entryPath` (an absolute path to a `.ts` file) for the browser as
 * a single ESM string, with no `<script>`/HTML handling involved.
 */
export async function bundleForBrowser(
  entryPath: string,
  { minify }: BundleForBrowserOptions,
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
