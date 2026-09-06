/**
 * Renders one Mermaid ASCII sample to stdout, given a `src/index.ts` module
 * path and a sample source. Used by scripts/ascii-terminal-capture.sh as the
 * command run inside a real PTY (via `asciinema record -c`) — this file has
 * to be a standalone module rather than an inline `node -e` string, since it
 * needs a dynamic `import()` of a *ref-specific* `src/index.ts` (the working
 * tree's, or one extracted from a base ref into a scratch directory).
 *
 * Usage: tsx ascii-render-runner.mjs [--size] <path-to-src/index.ts> <sample-index-or-file>
 *   --size                    Instead of the rendered output, print the
 *                             terminal size it needs as `<cols> <rows>` —
 *                             the widest line's display width (wide CJK/
 *                             emoji glyphs counted as two cells) and the
 *                             line count. The capture script sizes its
 *                             recording PTY from this so tall/wide samples
 *                             aren't clipped (see issue #483).
 *   <path-to-src/index.ts>    Module to import renderMermaidASCII from —
 *                             either the working tree's own, or a base ref's
 *                             src/ extracted via `git archive <ref> src | tar -x -C <dir>`.
 *   <sample-index-or-file>    A numeric index into the *working tree's*
 *                             samples-data.ts (samples always come from the
 *                             working tree, even when comparing an older
 *                             renderer — see scripts/visual-diff.ts's own
 *                             comment on why), or a path to a .mmd file for
 *                             a one-off diagram not in the catalog.
 *
 * Environment:
 *   ASCII_RENDER_OPTIONS      Optional JSON object of extra renderMermaidASCII
 *                             options merged over the default
 *                             `{ colorMode: 'auto' }` — e.g.
 *                             `'{"hyperlinks":true}'` to capture an opt-in
 *                             feature on the "after" side of a comparison.
 *                             Passed through the environment (which the PTY
 *                             asciinema spawns inherits) rather than argv so
 *                             scripts/ascii-terminal-capture.sh's positional
 *                             interface stays unchanged.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const sizeOnly = args[0] === '--size'
if (sizeOnly) args.shift()
const [indexModulePath, sampleArg] = args

if (!indexModulePath || !sampleArg) {
  console.error(
    'usage: tsx ascii-render-runner.mjs [--size] <path-to-src/index.ts> <sample-index-or-file>',
  )
  process.exit(2)
}

let source
if (/^\d+$/.test(sampleArg)) {
  const { samples } = await import(
    pathToFileURL(resolve('samples-data.ts')).href
  )
  const sample = samples[Number(sampleArg)]
  if (!sample) {
    console.error(
      `usage: sample index ${sampleArg} is out of range (samples-data.ts has ${samples.length} entries, indices 0-${samples.length - 1})`,
    )
    process.exit(2)
  }
  source = sample.source
} else {
  source = readFileSync(sampleArg, 'utf8')
}

// Resolve to an absolute file URL first — a relative specifier passed to
// import() resolves against this script's own URL, not process.cwd(), so a
// relative ./src/index.ts arg would otherwise land on the wrong ref's tree.
const { renderMermaidASCII } = await import(
  pathToFileURL(resolve(indexModulePath)).href
)

let extraOptions = {}
const rawOptions = process.env.ASCII_RENDER_OPTIONS
if (rawOptions !== undefined && rawOptions !== '') {
  let parsed
  try {
    parsed = JSON.parse(rawOptions)
  } catch {
    console.error(
      `usage: ASCII_RENDER_OPTIONS is not valid JSON: ${rawOptions}`,
    )
    process.exit(2)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.error(
      `usage: ASCII_RENDER_OPTIONS must be a JSON object, got: ${rawOptions}`,
    )
    process.exit(2)
  }
  extraOptions = parsed
}

if (sizeOnly) {
  // Measure with colors off so no ANSI escape bytes inflate the width. The
  // width function comes from the *working tree* (like samples-data.ts
  // above), not the ref under test: src/index.ts doesn't export it, and the
  // size of the recording PTY is a property of this tooling, not of the
  // renderer being compared. extraOptions is still applied here (e.g.
  // ASCII_RENDER_OPTIONS='{"hyperlinks":true}') so the PTY is sized to fit
  // whatever the "after" render will actually contain, OSC 8 escape bytes
  // included — see the ASCII_RENDER_OPTIONS doc comment above and
  // scripts/ascii-terminal-capture.sh's own note that the PTY inherits it.
  const { displayWidth } = await import(
    pathToFileURL(resolve('src/ascii/display-width.ts')).href
  )
  const lines = renderMermaidASCII(source, {
    colorMode: 'none',
    ...extraOptions,
  }).split('\n')
  const cols = Math.max(0, ...lines.map((line) => displayWidth(line)))
  process.stdout.write(`${cols} ${lines.length}\n`)
} else {
  process.stdout.write(
    renderMermaidASCII(source, { colorMode: 'auto', ...extraOptions }),
  )
}
