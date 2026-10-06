/**
 * Generates the shields.io "endpoint" badge data consumed by the README's
 * bundle-size badge: https://shields.io/badges/endpoint-badge — a small
 * JSON file, read directly from this repo's raw content on GitHub, that
 * tells shields.io what label/message/color to render. Unlike a static
 * `img.shields.io/badge/...` URL (which freezes whatever number was true
 * when someone typed it), the badge always reflects whatever this file
 * last committed, so refreshing the badge is "commit a new JSON file",
 * not "hand-edit a URL in README.md".
 *
 * Measures the gzipped size of `dist/index.js` — the main ESM entry point
 * (`import { renderMermaid } from 'zombie-mermaid'`) — together with the
 * workspace packages it imports (see TARGETS below), i.e. the number most
 * consumers actually experience, plus the same figure for each standalone
 * renderer package. This intentionally does *not* duplicate
 * scripts/check-bundle-size.ts's multi-file budget/gate logic (added by
 * issue #293, gzip-checking dist/index.{js,cjs}, dist/ascii.{js,cjs}, and
 * dist/cli.js against bundle-size-budget.json) — that script's job is
 * "fail CI on regression," this script's job is "report one number for
 * the badge." Once both scripts have landed on `main`, consider having
 * this one read its size straight from check-bundle-size.ts's own
 * measurement (or from bundle-size-budget.json's key list) instead of
 * hardcoding `dist/index.js` here, so the two can't silently drift.
 *
 * Usage: pnpm run build && tsx scripts/generate-bundle-badge.ts
 *
 * Wired into .github/workflows/publish.yml: runs after a successful npm
 * publish (i.e. once per actual release, not on every merge to main) so
 * the badge tracks what was actually shipped, then commits
 * badges/bundle-size.json back to main if the number changed.
 */

import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

// One badge per published package that advertises a size. Since the monorepo
// split, each package's `dist/index.js` is a thin entry that imports the
// other workspace packages as externals, so a package's own file understates
// what a consumer installs (the umbrella's is ~4 KB). Each badge therefore
// gzips the package's entry concatenated with the entries of every
// `@zombie-mermaid/*` package it (transitively) imports. Third-party
// dependencies are counted via SVG_DEPS below (issue #1320): the SVG
// renderer's real runtime weight is dominated by `elkjs`, which `dist/index.js`
// leaves external, so omitting it made the SVG badge look smaller than ASCII's.
const CORE = 'packages/core/dist/index.js'
const PARSER = 'packages/mermaid-parser/dist/index.js'
const ASCII = 'packages/ascii-renderer/dist/index.js'
const SVG = 'packages/svg-renderer/dist/index.js'

// Third-party runtime dependencies of the SVG renderer, resolved from its own
// package.json (pnpm doesn't hoist them to the root). `elkjs` is the single
// pre-bundled UMD file the renderer imports, so it can't be tree-shaken and is
// counted whole. `entities` is a library of many entry points of which the
// renderer imports only `decodeXML` (packages/svg-renderer/src/index.ts), so it
// is bundled and minified with just those exports, the way a consumer's bundler
// would tree-shake it (whole-build gzip counted ~35 KB of code nobody ships).
// Keep `exports` in sync with the renderer's actual imports from `entities`.
const SVG_DEPS = [
  { kind: 'file', specifier: 'elkjs/lib/elk.bundled.js' },
  { kind: 'tree-shaken', specifier: 'entities', exports: ['decodeXML'] },
] as const

type Dep = (typeof SVG_DEPS)[number]

const svgRequire = createRequire(
  new URL('../packages/svg-renderer/package.json', import.meta.url),
)

const SVG_PACKAGE_DIR = dirname(
  fileURLToPath(
    new URL('../packages/svg-renderer/package.json', import.meta.url),
  ),
)

async function readDep(dep: Dep): Promise<Buffer[]> {
  if (dep.kind === 'file') {
    return [await readFile(svgRequire.resolve(dep.specifier))]
  }
  const result = await build({
    stdin: {
      contents: `export { ${dep.exports.join(', ')} } from '${dep.specifier}'`,
      // Resolve from the SVG renderer's own node_modules (pnpm doesn't hoist).
      resolveDir: SVG_PACKAGE_DIR,
    },
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    conditions: ['import'],
    write: false,
    logLevel: 'silent',
  })
  return result.outputFiles.map((f) => Buffer.from(f.contents))
}

const TARGETS = [
  {
    entries: ['dist/index.js', CORE, PARSER, ASCII, SVG],
    deps: SVG_DEPS,
    output: 'badges/bundle-size.json',
    label: 'zombie-mermaid gzip (incl. deps)',
  },
  {
    entries: [ASCII, CORE, PARSER],
    deps: [] as readonly Dep[],
    output: 'badges/bundle-size-ascii-renderer.json',
    label: 'ascii-renderer gzip',
  },
  {
    entries: [SVG, CORE, PARSER],
    deps: SVG_DEPS,
    output: 'badges/bundle-size-svg-renderer.json',
    label: 'svg-renderer gzip (incl. deps)',
  },
]

function fmtKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}

await mkdir(new URL('../badges', import.meta.url), { recursive: true })

for (const { entries, deps, output, label } of TARGETS) {
  const parts: Buffer[] = []
  for (const entry of entries) {
    try {
      parts.push(await readFile(new URL(`../${entry}`, import.meta.url)))
    } catch {
      console.error(`Could not read ${entry} — run \`pnpm run build\` first.`)
      process.exit(1)
    }
  }

  for (const dep of deps) {
    try {
      parts.push(...(await readDep(dep)))
    } catch {
      console.error(
        `Could not read dependency ${dep.specifier} — run \`pnpm install\` first.`,
      )
      process.exit(1)
    }
  }

  const message = fmtKB(gzipSync(Buffer.concat(parts)).length)

  // shields.io endpoint badge schema: https://shields.io/badges/endpoint-badge
  const badge = { schemaVersion: 1, label, message, color: 'blue' }

  await writeFile(
    new URL(`../${output}`, import.meta.url),
    JSON.stringify(badge, null, 2) + '\n',
    'utf-8',
  )

  console.log(
    `${label}: ${message} (${entries.length} entries, ${deps.length} deps) -> wrote ${output}`,
  )
}
