/**
 * The build orchestrator every site generator's write epilogue now calls
 * instead of hand-rolling its own `mkdir` / `writeFile` / `console.log`
 * sequence. See zombie-mermaid#937 (part of the #931 umbrella).
 *
 * Before this file, each of the six one-shot site generators (index.ts,
 * editor.ts, dashboard.ts, fork-fixes.ts, pages.ts, blog.ts) ended with its
 * own near-identical epilogue: resolve an output path under
 * `siteOutDir()`, `mkdir` its parent directory, `writeFile` the rendered
 * HTML, and `console.log('Written to <path> (<n> KB)')` — byte-for-byte
 * identical logic in index.ts:104-118, editor.ts:190-192,
 * dashboard.ts:153-156, and fork-fixes.ts:357-360, with pages.ts/blog.ts
 * repeating the `mkdir`+`writeFile` half of it several times over (once per
 * generated diagram-type page / blog post, plus each page's CSS/JS
 * asset(s), sitemap.xml, and — for blog.ts — feed.xml).
 *
 * `generatePage()` owns exactly that: given an absolute output path (a
 * `file://` URL, so it composes directly with `siteOutDir()`) and the
 * content to write there, it creates the parent directory (so callers never
 * need their own preparatory `mkdir`), writes the file, and — by default —
 * logs the same `Written to <path> (<n> KB)` line the four single-page
 * generators always did. The optional `assets` array covers the one
 * variation on that shape that already existed before this file: a client
 * bundle written to its own `assets/*.js` path *before* the main file,
 * rather than inlined into it (index.ts's `index-page-client.js`,
 * pages.ts's `diagram-page.css`/`diagram-page-client.js`, blog.ts's
 * `blog.css`) — each asset gets the same mkdir-then-write treatment, in
 * array order, ahead of the main `content` write.
 *
 * Deliberately NOT wrapped here: the `bundleXClient()` functions each
 * generator defines (thin, but genuinely different callers of
 * `bundleForBrowser()` — different entry points, different `minify`/
 * `treeshake` options, and in editor.ts's `bundleBrowserScript()` a
 * bespoke try/catch-then-`process.exit(1)` on failure no other generator
 * has). Folding those into this module would either lose that per-generator
 * behavior or need an escape hatch that defeats the point of sharing code —
 * see this issue's PR description for the fuller reasoning. What's left
 * uncovered by design is exactly this: `generatePage()` targets the
 * genuinely shallow, byte-identical duplication (the epilogue), not the
 * bundling calls that precede it.
 *
 * `log: false` (used by every pages.ts/blog.ts call) exists because those
 * two generators already print their own aggregate summary line at the end
 * (`Wrote N diagram pages + hub page + sitemap.xml (...)`,
 * `Wrote N blog post(s) + index + feed.xml to ... `) — logging a second,
 * per-file "Written to..." line for every one of their many outputs would
 * be new console output, not a preserved one, so it stays off there. Only
 * the four generators that write exactly one primary HTML file
 * (index.ts/editor.ts/dashboard.ts/fork-fixes.ts) keep the per-file log,
 * matching their pre-refactor behavior exactly.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/** One extra file to write (with its parent directory created first)
 * before the main `content` in {@link GeneratePageOptions}. */
export interface GeneratePageAsset {
  /** Absolute output location for this asset. */
  outPath: URL
  /** The asset's contents (a bundled client script, a stylesheet, ...). */
  content: string
}

export interface GeneratePageOptions {
  /**
   * Absolute output location for `content` — typically built from
   * `siteOutDir()` (scripts/site-out-dir.ts) so it honors `SITE_OUT_DIR`.
   * Its parent directory is created (recursively) before writing.
   */
  outPath: URL
  /** The file's contents — rendered HTML, XML, or any other text output. */
  content: string
  /**
   * Extra files to write before `content`, each with its own parent
   * directory created first. Written in array order. See this module's
   * header comment for which existing generator calls need this (a client
   * bundle or stylesheet written to its own `assets/*` file instead of
   * being inlined into `content`).
   */
  assets?: GeneratePageAsset[]
  /**
   * Log `Written to <path> (<n> KB)` after writing `content`. Defaults to
   * `true`, matching every single-page generator's pre-refactor epilogue.
   * Pass `false` for a generator that writes many files per run and prints
   * its own aggregate summary instead (pages.ts, blog.ts) — see this
   * module's header comment.
   */
  log?: boolean
}

/**
 * Writes `content` to `outPath` (creating its parent directory first),
 * after writing any `assets` the same way. Returns the resolved filesystem
 * path `content` was written to.
 */
export async function generatePage({
  outPath,
  content,
  assets = [],
  log = true,
}: GeneratePageOptions): Promise<string> {
  for (const asset of assets) {
    await mkdir(new URL('./', asset.outPath), { recursive: true })
    await writeFile(asset.outPath, asset.content)
  }

  await mkdir(new URL('./', outPath), { recursive: true })
  await writeFile(outPath, content, 'utf8')

  const resolvedPath = fileURLToPath(outPath)
  if (log) {
    console.log(
      `Written to ${resolvedPath} (${(content.length / 1024).toFixed(1)} KB)`,
    )
  }
  return resolvedPath
}
