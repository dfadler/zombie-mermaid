/**
 * Renders one Mermaid ASCII sample to stdout, given a `src/index.ts` module
 * path and a sample source. Used by scripts/ascii-terminal-capture.sh as the
 * command run inside a real PTY (via `asciinema record -c`) — this file has
 * to be a standalone module rather than an inline `node -e` string, since it
 * needs a dynamic `import()` of a *ref-specific* `src/index.ts` (the working
 * tree's, or one extracted from a base ref into a scratch directory).
 *
 * Usage: tsx ascii-render-runner.mjs <path-to-src/index.ts> <sample-index-or-file>
 *   <path-to-src/index.ts>    Module to import renderMermaidASCII from —
 *                             either the working tree's own, or a base ref's
 *                             src/ extracted via `git archive <ref> src | tar -x -C <dir>`.
 *   <sample-index-or-file>    A numeric index into the *working tree's*
 *                             samples-data.ts (samples always come from the
 *                             working tree, even when comparing an older
 *                             renderer — see scripts/visual-diff.ts's own
 *                             comment on why), or a path to a .mmd file for
 *                             a one-off diagram not in the catalog.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [, , indexModulePath, sampleArg] = process.argv

if (!indexModulePath || !sampleArg) {
  console.error(
    'usage: tsx ascii-render-runner.mjs <path-to-src/index.ts> <sample-index-or-file>',
  )
  process.exit(2)
}

const source = /^\d+$/.test(sampleArg)
  ? (await import(pathToFileURL(resolve('samples-data.ts')).href)).samples[
      Number(sampleArg)
    ].source
  : readFileSync(sampleArg, 'utf8')

// Resolve to an absolute file URL first — a relative specifier passed to
// import() resolves against this script's own URL, not process.cwd(), so a
// relative ./src/index.ts arg would otherwise land on the wrong ref's tree.
const { renderMermaidASCII } = await import(
  pathToFileURL(resolve(indexModulePath)).href
)

process.stdout.write(renderMermaidASCII(source, { colorMode: 'auto' }))
